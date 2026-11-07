import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import type { MoneySnapshot } from "@/lib/money/engine";

const toNum = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

const MONTHLY_FACTOR: Record<string, number> = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1, quarterly: 1 / 3, annual: 1 / 12, yearly: 1 / 12 };

// Reads only tables the signed-in user can already read under RLS.
export function useMoneySnapshot() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["money-snapshot", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<{ snapshot: MoneySnapshot; hasHousehold: boolean }> => {
      const db = supabase as any; // some household tables are not in the generated types
      const today = new Date().toISOString().slice(0, 10);

      const { data: profile } = await db.from("profiles").select("household_id").eq("id", user!.id).maybeSingle();
      const householdId: string | null = profile?.household_id ?? null;

      const portfolio = await db.from("portfolios").select("total_capital").eq("user_id", user!.id).maybeSingle();
      const investCapital = toNum(portfolio.data?.total_capital);

      if (!householdId) {
        return { hasHousehold: false, snapshot: { accounts: [], debts: [], subscriptions: [], bills: [], monthlyIncome: 0, investCapital, today } };
      }

      const [acc, debts, subs, bills, income] = await Promise.all([
        db.from("bank_accounts").select("name,type,current_balance").eq("household_id", householdId).eq("is_active", true),
        db.from("debts").select("name,current_balance,interest_rate,monthly_payment,payment_bill_id,sync_to_bill").eq("household_id", householdId).eq("is_active", true),
        db.from("subscriptions").select("name,amount,frequency").eq("household_id", householdId),
        db.from("bills").select("name,amount,due_date,payment_status,frequency").eq("household_id", householdId),
        db.from("income_sources").select("expected_amount,frequency").eq("household_id", householdId).eq("is_active", true),
      ]);
      for (const r of [acc, debts, bills, income]) if (r.error) throw r.error;

      const monthlyIncome = (income.data ?? []).reduce(
        (t: number, i: any) => t + toNum(i.expected_amount) * (MONTHLY_FACTOR[String(i.frequency ?? "monthly").toLowerCase()] ?? 1),
        0,
      );

      return {
        hasHousehold: true,
        snapshot: {
          today,
          investCapital,
          monthlyIncome,
          accounts: (acc.data ?? []).map((a: any) => ({ name: a.name, type: String(a.type ?? "").toLowerCase(), balance: toNum(a.current_balance) })),
          debts: (debts.data ?? []).map((d: any) => ({ name: d.name, balance: toNum(d.current_balance), rate: d.interest_rate == null ? null : toNum(d.interest_rate), monthlyPayment: toNum(d.monthly_payment), linkedToBill: !!d.payment_bill_id && d.sync_to_bill !== false })),
          // subscriptions table may not exist yet on a fresh project; treat as empty
          subscriptions: subs.error ? [] : (subs.data ?? []).map((s: any) => ({ name: s.name, amount: toNum(s.amount), frequency: s.frequency === "annual" ? "annual" : "monthly" })),
          bills: (bills.data ?? []).map((b: any) => ({ name: b.name, amount: toNum(b.amount), monthlyAmount: toNum(b.amount) * (MONTHLY_FACTOR[String(b.frequency ?? "monthly").toLowerCase()] ?? 1), dueDate: String(b.due_date ?? today).slice(0, 10), paid: b.payment_status === "paid" })),
        },
      };
    },
  });
}
