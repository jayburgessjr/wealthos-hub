import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Loader2, CreditCard, TrendingDown,
  AlertTriangle, Calculator,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────

interface Debt {
  id: string;
  user_id: string;
  name: string;
  type: string;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
  extra_payment: number;
  notes: string | null;
  created_at: string;
}

interface DebtForm {
  name: string;
  type: string;
  balance: string;
  interest_rate: string;
  minimum_payment: string;
  extra_payment: string;
  notes: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEBT_TYPES = [
  "Credit Card", "Student Loan", "Auto Loan",
  "Mortgage", "Personal Loan", "Medical", "Other",
];

const TYPE_COLORS: Record<string, string> = {
  "Credit Card": "bg-red-500/10 text-red-400 border-red-500/20",
  "Student Loan": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Auto Loan": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Mortgage": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Personal Loan": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Medical": "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Other": "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const emptyForm: DebtForm = {
  name: "", type: DEBT_TYPES[0], balance: "", interest_rate: "",
  minimum_payment: "", extra_payment: "0", notes: "",
};

// ── Shared helpers ───────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDec = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
const selectCls = `${inputCls} appearance-none`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon }: {
  label: string; value: string; sub?: string; icon?: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon size={14} className="text-muted-foreground" />}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Payoff engine ────────────────────────────────────────────────────────────

interface PayoffResult {
  id: string;
  name: string;
  months: number;
  totalInterest: number;
  order: number;
}

function computePayoffSchedule(
  debts: Debt[],
  strategy: "avalanche" | "snowball",
  extraBudget = 0,
): { results: PayoffResult[]; totalMonths: number; totalInterest: number } {
  if (!debts.length) return { results: [], totalMonths: 0, totalInterest: 0 };

  // Sort by strategy
  const sorted = [...debts].sort((a, b) =>
    strategy === "avalanche"
      ? b.interest_rate - a.interest_rate
      : a.balance - b.balance,
  );

  // Working copies
  const accounts = sorted.map(d => ({
    id: d.id,
    name: d.name,
    balance: d.balance,
    rate: d.interest_rate / 100 / 12,
    minPayment: d.minimum_payment + d.extra_payment,
    paidOffMonth: 0,
    interest: 0,
  }));

  const results: PayoffResult[] = [];
  let month = 0;
  const MAX_MONTHS = 600;
  let freed = extraBudget;

  while (accounts.some(a => a.balance > 0) && month < MAX_MONTHS) {
    month++;

    // Apply freed minimum payments to the focus account (first unpaid)
    const focusIdx = accounts.findIndex(a => a.balance > 0);

    accounts.forEach((acc, idx) => {
      if (acc.balance <= 0) return;
      const interest = acc.balance * acc.rate;
      acc.interest += interest;
      acc.balance += interest;

      let payment = acc.minPayment;
      if (idx === focusIdx) payment += freed;
      payment = Math.min(payment, acc.balance);
      acc.balance -= payment;
      acc.balance = Math.max(0, acc.balance);

      if (acc.balance <= 0 && !acc.paidOffMonth) {
        acc.paidOffMonth = month;
        // The minimum payment for this debt gets freed up for the next
        freed += acc.minPayment;
      }
    });
  }

  accounts.forEach((acc, idx) => {
    results.push({
      id: acc.id,
      name: acc.name,
      months: acc.paidOffMonth || month,
      totalInterest: acc.interest,
      order: idx + 1,
    });
  });

  const totalMonths = Math.max(...results.map(r => r.months));
  const totalInterest = results.reduce((s, r) => s + r.totalInterest, 0);
  return { results, totalMonths, totalInterest };
}

function computeWeightedAvgRate(debts: Debt[]): number {
  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  if (!totalBalance) return 0;
  return debts.reduce((s, d) => s + d.interest_rate * d.balance, 0) / totalBalance;
}

// ── Debt Modal ───────────────────────────────────────────────────────────────

function DebtModal({
  open, onClose, userId, existing,
}: { open: boolean; onClose: () => void; userId: string; existing: Debt | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<DebtForm>(
    existing
      ? {
          name: existing.name,
          type: existing.type,
          balance: String(existing.balance),
          interest_rate: String(existing.interest_rate),
          minimum_payment: String(existing.minimum_payment),
          extra_payment: String(existing.extra_payment ?? 0),
          notes: existing.notes ?? "",
        }
      : emptyForm,
  );

  const set = (k: keyof DebtForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        name: form.name.trim(),
        type: form.type,
        balance: parseFloat(form.balance) || 0,
        interest_rate: parseFloat(form.interest_rate) || 0,
        minimum_payment: parseFloat(form.minimum_payment) || 0,
        extra_payment: parseFloat(form.extra_payment) || 0,
        notes: form.notes.trim() || null,
      };
      if (existing) {
        const { error } = await supabase.from("debts").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("debts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debts"] });
      toast.success(existing ? "Debt updated" : "Debt added");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.name.trim() && form.balance && form.interest_rate && form.minimum_payment;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Debt" : "Add Debt"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Name">
            <input className={inputCls} value={form.name} onChange={set("name")} placeholder="e.g. Chase Sapphire" />
          </Field>
          <Field label="Type">
            <select className={selectCls} value={form.type} onChange={set("type")}>
              {DEBT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Balance ($)">
              <input className={inputCls} type="number" min="0" step="0.01" value={form.balance} onChange={set("balance")} placeholder="0" />
            </Field>
            <Field label="Interest Rate (%)">
              <input className={inputCls} type="number" min="0" step="0.01" max="100" value={form.interest_rate} onChange={set("interest_rate")} placeholder="0.00" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min Payment ($/mo)">
              <input className={inputCls} type="number" min="0" step="0.01" value={form.minimum_payment} onChange={set("minimum_payment")} placeholder="0" />
            </Field>
            <Field label="Extra Payment ($/mo)">
              <input className={inputCls} type="number" min="0" step="0.01" value={form.extra_payment} onChange={set("extra_payment")} placeholder="0" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Debt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Payoff Strategy Card ─────────────────────────────────────────────────────

function PayoffCard({
  title, results, totalMonths, totalInterest,
}: {
  title: string;
  results: PayoffResult[];
  totalMonths: number;
  totalInterest: number;
}) {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator size={15} className="text-primary" />
          {title}
        </CardTitle>
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Total payoff: <span className="font-semibold text-foreground">{totalMonths} mo</span>
          </span>
          <span className="text-muted-foreground">
            Total interest: <span className="font-semibold text-bearish">{fmtDec(totalInterest)}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {results.map(r => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {r.order}
                </span>
                <span className="text-foreground">{r.name}</span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {r.months} mo · <span className="text-bearish">{fmtDec(r.totalInterest)}</span>
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function DebtManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  const { data: debts = [], isLoading } = useQuery<Debt[]>({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Debt[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debts"] });
      toast.success("Debt removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
    const totalMin = debts.reduce((s, d) => s + d.minimum_payment, 0);
    const avgRate = computeWeightedAvgRate(debts);
    const { totalMonths } = computePayoffSchedule(debts, "avalanche");
    return { totalDebt, totalMin, avgRate, totalMonths };
  }, [debts]);

  const avalanche = useMemo(() => computePayoffSchedule(debts, "avalanche"), [debts]);
  const snowball = useMemo(() => computePayoffSchedule(debts, "snowball"), [debts]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (d: Debt) => { setEditing(d); setModalOpen(true); };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CreditCard size={22} className="text-primary" />
              Debt Manager
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track balances, compare payoff strategies, and accelerate your debt-free date.
            </p>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus size={14} className="mr-1.5" /> Add Debt
          </Button>
        </motion.div>

        {/* KPIs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <KpiCard label="Total Debt" value={fmt(kpis.totalDebt)} icon={TrendingDown} />
          <KpiCard label="Monthly Min Payment" value={fmt(kpis.totalMin)} sub="across all debts" />
          <KpiCard label="Weighted Avg Rate" value={`${kpis.avgRate.toFixed(2)}%`} sub="balance-weighted" />
          <KpiCard
            label="Months to Payoff"
            value={debts.length ? `${kpis.totalMonths} mo` : "—"}
            sub="avalanche method"
            icon={Calculator}
          />
        </motion.div>

        {/* Debts Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle size={15} className="text-primary" />
                Your Debts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={22} className="animate-spin text-muted-foreground" />
                </div>
              ) : debts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
                  <CreditCard size={32} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No debts tracked yet. Add your first debt to get started.</p>
                  <Button size="sm" variant="outline" onClick={openAdd}>
                    <Plus size={14} className="mr-1.5" /> Add First Debt
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4 text-right">Balance</th>
                        <th className="pb-2 pr-4 text-right">Rate</th>
                        <th className="pb-2 pr-4 text-right">Min / mo</th>
                        <th className="pb-2 pr-4 text-right">Extra / mo</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {debts.map(d => (
                        <tr key={d.id} className="group hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4 font-medium text-foreground">{d.name}</td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant="outline"
                              className={`text-xs ${TYPE_COLORS[d.type] ?? TYPE_COLORS["Other"]}`}
                            >
                              {d.type}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-bearish font-medium">
                            {fmt(d.balance)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                            {d.interest_rate.toFixed(2)}%
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                            {fmt(d.minimum_payment)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                            {d.extra_payment > 0 ? (
                              <span className="text-primary">+{fmt(d.extra_payment)}</span>
                            ) : "—"}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(d)}>
                                <Pencil size={13} />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-bearish hover:text-bearish"
                                onClick={() => deleteMutation.mutate(d.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td colSpan={2} className="pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Totals
                        </td>
                        <td className="pt-3 text-right tabular-nums font-bold text-bearish">
                          {fmt(debts.reduce((s, d) => s + d.balance, 0))}
                        </td>
                        <td />
                        <td className="pt-3 text-right tabular-nums font-semibold text-foreground">
                          {fmt(debts.reduce((s, d) => s + d.minimum_payment, 0))}
                        </td>
                        <td className="pt-3 text-right tabular-nums font-semibold text-primary">
                          {debts.some(d => d.extra_payment > 0)
                            ? `+${fmt(debts.reduce((s, d) => s + d.extra_payment, 0))}`
                            : "—"}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Payoff Calculators */}
        {debts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="mb-3">
              <h2 className="text-base font-semibold text-foreground">Payoff Strategy Comparison</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Both strategies use your current min + extra payments. Freed-up payments roll to the next debt.
              </p>
            </div>
            <div className="flex gap-4 flex-col md:flex-row">
              <PayoffCard
                title="Avalanche (Highest Rate First)"
                results={avalanche.results}
                totalMonths={avalanche.totalMonths}
                totalInterest={avalanche.totalInterest}
              />
              <PayoffCard
                title="Snowball (Lowest Balance First)"
                results={snowball.results}
                totalMonths={snowball.totalMonths}
                totalInterest={snowball.totalInterest}
              />
            </div>
            {avalanche.totalInterest < snowball.totalInterest && (
              <p className="mt-2 text-xs text-muted-foreground">
                Avalanche saves you{" "}
                <span className="font-semibold text-primary">
                  {fmtDec(snowball.totalInterest - avalanche.totalInterest)}
                </span>{" "}
                in interest vs. Snowball.
              </p>
            )}
          </motion.div>
        )}
      </div>

      {/* Modal */}
      <DebtModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={user.id}
        existing={editing}
      />
    </DashboardLayout>
  );
}
