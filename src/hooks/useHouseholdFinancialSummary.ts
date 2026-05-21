import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MonthlyFinancialSummary } from "@/components/household/dashboard/CFODashboard";

export const financialSummaryKeys = {
  all: ["financial-summary"] as const,
  monthly: (householdId: string) =>
    ["financial-summary", "monthly", householdId] as const,
};

export function useMonthlyFinancialSummary(householdId: string | null) {
  return useQuery<MonthlyFinancialSummary[], Error>({
    queryKey: householdId
      ? financialSummaryKeys.monthly(householdId)
      : ["financial-summary", "none"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");

      // Query the monthly_financial_summary view
      const { data, error } = await supabase
        .from("monthly_financial_summary")
        .select("*")
        .eq("household_id", householdId)
        .order("month", { ascending: false })
        .limit(24); // Last 2 years

      if (error) {
        console.error("Failed to fetch financial summary:", error);
        throw error;
      }

      return (data || []).map((row) => ({
        householdId: row.household_id,
        month: row.month,
        income: Number(row.income) || 0,
        expenses: Number(row.expenses) || 0,
        netCashFlow: Number(row.net_cash_flow) || 0,
        fixedCosts: Number(row.fixed_costs) || 0,
        discretionarySpend: Number(row.discretionary_spend) || 0,
        recurringCosts: Number(row.recurring_costs) || 0,
        subscriptionCosts: Number(row.subscription_costs) || 0,
        burnRatePct: Number(row.burn_rate_pct) || 0,
        // New KPIs
        savingsRatePct: Number((row as any).savings_rate_pct) || 0,
        dtiRatioPct: Number((row as any).dti_ratio_pct) || 0,
        debtPayments: Number((row as any).debt_payments) || 0,
        liquidAssets: Number((row as any).liquid_assets) || 0,
        emergencyFundMonths: Number((row as any).emergency_fund_months) || 0,
        runwayMonths:
          (row as any).runway_months !== null
            ? Number((row as any).runway_months)
            : null,
      }));
    },
    enabled: !!householdId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
