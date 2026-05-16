import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Loader2, PiggyBank, Calculator, TrendingUp,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────

interface RetirementAccount {
  id: string;
  user_id: string;
  account_name: string;
  account_type: string;
  provider: string;
  current_balance: number;
  annual_contribution: number;
  employer_match_pct: number;
  expected_return_pct: number;
  notes: string | null;
  created_at: string;
}

interface AccountForm {
  account_name: string;
  account_type: string;
  provider: string;
  current_balance: string;
  annual_contribution: string;
  employer_match_pct: string;
  expected_return_pct: string;
  notes: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ["401k", "IRA", "Roth IRA", "SEP-IRA", "Pension", "Other"];

const TYPE_COLORS: Record<string, string> = {
  "401k": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "IRA": "bg-green-500/10 text-green-400 border-green-500/20",
  "Roth IRA": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "SEP-IRA": "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "Pension": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Other": "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const emptyForm: AccountForm = {
  account_name: "", account_type: ACCOUNT_TYPES[0], provider: "",
  current_balance: "", annual_contribution: "", employer_match_pct: "0",
  expected_return_pct: "7", notes: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

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

// ── Retirement Calculator Logic ───────────────────────────────────────────────

interface RetirementCalcInputs {
  currentAge: number;
  targetAge: number;
  currentSavings: number;
  monthlyContribution: number;
  expectedReturnPct: number;
}

interface Milestone {
  age: number;
  balance: number;
  yearsFromNow: number;
}

function computeRetirementProjection(inputs: RetirementCalcInputs): {
  projectedBalance: number;
  milestones: Milestone[];
} {
  const { currentAge, targetAge, currentSavings, monthlyContribution, expectedReturnPct } = inputs;
  const monthlyRate = expectedReturnPct / 100 / 12;
  const years = Math.max(0, targetAge - currentAge);
  const months = years * 12;

  const fvCurrent = currentSavings * Math.pow(1 + monthlyRate, months);
  const fvContrib = monthlyRate > 0
    ? monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    : monthlyContribution * months;

  const projectedBalance = fvCurrent + fvContrib;

  const milestones: Milestone[] = [];
  for (let age = currentAge + 5; age <= targetAge; age += 5) {
    const m = (age - currentAge) * 12;
    const fvC = currentSavings * Math.pow(1 + monthlyRate, m);
    const fvP = monthlyRate > 0
      ? monthlyContribution * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate)
      : monthlyContribution * m;
    milestones.push({ age, balance: fvC + fvP, yearsFromNow: age - currentAge });
  }

  return { projectedBalance, milestones };
}

// ── SS Break-Even Calculator Logic ────────────────────────────────────────────

function computeBreakEven(benefitA: number, ageA: number, benefitB: number, ageB: number): number | null {
  // Solve: benefitA × (t - ageA) = benefitB × (t - ageB)
  // → (benefitA - benefitB) × t = benefitA × ageA - benefitB × ageB
  const denom = benefitA - benefitB;
  if (Math.abs(denom) < 0.01) return null;
  const breakEvenAge = (benefitA * ageA - benefitB * ageB) / denom;
  return breakEvenAge > 0 ? breakEvenAge : null;
}

// ── Account Modal ─────────────────────────────────────────────────────────────

function AccountModal({
  open, onClose, userId, existing,
}: { open: boolean; onClose: () => void; userId: string; existing: RetirementAccount | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AccountForm>(
    existing
      ? {
          account_name: existing.account_name,
          account_type: existing.account_type,
          provider: existing.provider ?? "",
          current_balance: String(existing.current_balance),
          annual_contribution: String(existing.annual_contribution),
          employer_match_pct: String(existing.employer_match_pct ?? 0),
          expected_return_pct: String(existing.expected_return_pct ?? 7),
          notes: existing.notes ?? "",
        }
      : emptyForm,
  );

  const set = (k: keyof AccountForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        account_name: form.account_name.trim(),
        account_type: form.account_type,
        provider: form.provider.trim() || null,
        current_balance: parseFloat(form.current_balance) || 0,
        annual_contribution: parseFloat(form.annual_contribution) || 0,
        employer_match_pct: parseFloat(form.employer_match_pct) || 0,
        expected_return_pct: parseFloat(form.expected_return_pct) || 7,
        notes: form.notes.trim() || null,
      };
      if (existing) {
        const { error } = await supabase.from("retirement_accounts").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("retirement_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retirement_accounts"] });
      toast.success(existing ? "Account updated" : "Account added");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.account_name.trim() && form.current_balance;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Account" : "Add Retirement Account"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Account Name">
            <input className={inputCls} value={form.account_name} onChange={set("account_name")} placeholder="e.g. Fidelity 401k" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account Type">
              <select className={selectCls} value={form.account_type} onChange={set("account_type")}>
                {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Provider">
              <input className={inputCls} value={form.provider} onChange={set("provider")} placeholder="Fidelity, Vanguard…" />
            </Field>
          </div>
          <Field label="Current Balance ($)">
            <input className={inputCls} type="number" min="0" step="0.01" value={form.current_balance} onChange={set("current_balance")} placeholder="0" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Annual Contribution ($)">
              <input className={inputCls} type="number" min="0" step="0.01" value={form.annual_contribution} onChange={set("annual_contribution")} placeholder="0" />
            </Field>
            <Field label="Employer Match (%)">
              <input className={inputCls} type="number" min="0" max="100" step="0.01" value={form.employer_match_pct} onChange={set("employer_match_pct")} placeholder="0" />
            </Field>
          </div>
          <Field label="Expected Annual Return (%)">
            <input className={inputCls} type="number" min="0" max="30" step="0.1" value={form.expected_return_pct} onChange={set("expected_return_pct")} placeholder="7" />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Retirement Calculator Section ─────────────────────────────────────────────

function RetirementCalculator() {
  const [inputs, setInputs] = useState({
    currentAge: "35",
    targetAge: "65",
    currentSavings: "50000",
    monthlyContribution: "1000",
    expectedReturnPct: "7",
  });

  const set = (k: keyof typeof inputs) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setInputs(prev => ({ ...prev, [k]: e.target.value }));

  const result = useMemo(() => {
    const parsed = {
      currentAge: parseInt(inputs.currentAge) || 0,
      targetAge: parseInt(inputs.targetAge) || 65,
      currentSavings: parseFloat(inputs.currentSavings) || 0,
      monthlyContribution: parseFloat(inputs.monthlyContribution) || 0,
      expectedReturnPct: parseFloat(inputs.expectedReturnPct) || 7,
    };
    if (parsed.targetAge <= parsed.currentAge) return null;
    return computeRetirementProjection(parsed);
  }, [inputs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator size={15} className="text-primary" />
          Retirement Calculator
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Independent projection — adjust inputs without affecting your account records.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Current Age">
            <input className={inputCls} type="number" min="18" max="90" value={inputs.currentAge} onChange={set("currentAge")} />
          </Field>
          <Field label="Target Age">
            <input className={inputCls} type="number" min="18" max="100" value={inputs.targetAge} onChange={set("targetAge")} />
          </Field>
          <Field label="Current Savings ($)">
            <input className={inputCls} type="number" min="0" value={inputs.currentSavings} onChange={set("currentSavings")} />
          </Field>
          <Field label="Monthly Contribution ($)">
            <input className={inputCls} type="number" min="0" value={inputs.monthlyContribution} onChange={set("monthlyContribution")} />
          </Field>
          <Field label="Expected Return (%)">
            <input className={inputCls} type="number" min="0" max="30" step="0.1" value={inputs.expectedReturnPct} onChange={set("expectedReturnPct")} />
          </Field>
        </div>

        {result ? (
          <>
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Projected Balance at Age {inputs.targetAge}
              </p>
              <p className="mt-1 text-3xl font-bold text-primary">{fmt(result.projectedBalance)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Over {parseInt(inputs.targetAge) - parseInt(inputs.currentAge)} years at {inputs.expectedReturnPct}% annual return
              </p>
            </div>

            {result.milestones.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  5-Year Milestones
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-6">Age</th>
                        <th className="pb-2 pr-6">Years from Now</th>
                        <th className="pb-2 text-right">Projected Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.milestones.map(m => (
                        <tr key={m.age} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-6 font-medium text-foreground">{m.age}</td>
                          <td className="py-2 pr-6 text-muted-foreground">{m.yearsFromNow} yrs</td>
                          <td className="py-2 text-right tabular-nums font-semibold text-primary">{fmt(m.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Enter a target age greater than your current age to see projections.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Social Security Break-Even Calculator ─────────────────────────────────────

function SocialSecurityCalculator() {
  const [inputs, setInputs] = useState({
    benefit62: "1200",
    benefit67: "1700",
    benefit70: "2100",
  });

  const set = (k: keyof typeof inputs) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setInputs(prev => ({ ...prev, [k]: e.target.value }));

  const results = useMemo(() => {
    const b62 = parseFloat(inputs.benefit62) || 0;
    const b67 = parseFloat(inputs.benefit67) || 0;
    const b70 = parseFloat(inputs.benefit70) || 0;
    const be62vs67 = computeBreakEven(b62, 62, b67, 67);
    const be67vs70 = computeBreakEven(b67, 67, b70, 70);
    return { b62, b67, b70, be62vs67, be67vs70 };
  }, [inputs]);

  const fmtAge = (age: number | null) => {
    if (age === null) return "No crossover";
    const years = Math.floor(age);
    const months = Math.round((age - years) * 12);
    return `Age ${years}${months > 0 ? ` & ${months} mo` : ""}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp size={15} className="text-primary" />
          Social Security Break-Even Calculator
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Find the age where delaying Social Security pays off more than claiming early.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Monthly Benefit at 62 ($)">
            <input className={inputCls} type="number" min="0" value={inputs.benefit62} onChange={set("benefit62")} />
          </Field>
          <Field label="Monthly Benefit at 67 ($)">
            <input className={inputCls} type="number" min="0" value={inputs.benefit67} onChange={set("benefit67")} />
          </Field>
          <Field label="Monthly Benefit at 70 ($)">
            <input className={inputCls} type="number" min="0" value={inputs.benefit70} onChange={set("benefit70")} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              62 vs 67 Break-Even
            </p>
            <p className="text-xl font-bold text-foreground">{fmtAge(results.be62vs67)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {results.be62vs67
                ? "After this age, claiming at 67 pays more total than claiming at 62."
                : "Benefits are equal — no crossover exists."}
            </p>
            {results.be62vs67 && results.b62 > 0 && results.b67 > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Foregone income at 62:{" "}
                <span className="font-medium text-foreground">
                  {fmt(results.b62 * (67 - 62) * 12)} over 5 years
                </span>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              67 vs 70 Break-Even
            </p>
            <p className="text-xl font-bold text-foreground">{fmtAge(results.be67vs70)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {results.be67vs70
                ? "After this age, claiming at 70 pays more total than claiming at 67."
                : "Benefits are equal — no crossover exists."}
            </p>
            {results.be67vs70 && results.b67 > 0 && results.b70 > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Foregone income at 67:{" "}
                <span className="font-medium text-foreground">
                  {fmt(results.b67 * (70 - 67) * 12)} over 3 years
                </span>
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground border-t border-border pt-3">
          Break-even assumes no investment return on foregone benefits. Longevity, health, and
          investment returns all factor into the real decision.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Retirement() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RetirementAccount | null>(null);

  const { data: accounts = [], isLoading } = useQuery<RetirementAccount[]>({
    queryKey: ["retirement_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retirement_accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as RetirementAccount[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("retirement_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retirement_accounts"] });
      toast.success("Account removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0);
    const totalAnnualContrib = accounts.reduce((s, a) => s + a.annual_contribution, 0);
    const totalEmployerMatch = accounts.reduce(
      (s, a) => s + a.annual_contribution * (a.employer_match_pct / 100),
      0,
    );
    // Aggregate projection at 65 using each account's own expected return (assumes 30yr horizon)
    const projectedAt65 = accounts.reduce((sum, a) => {
      const months = 30 * 12;
      const monthlyRate = a.expected_return_pct / 100 / 12;
      const monthlyContrib = (a.annual_contribution * (1 + a.employer_match_pct / 100)) / 12;
      const fvCurrent = a.current_balance * Math.pow(1 + monthlyRate, months);
      const fvContrib = monthlyRate > 0
        ? monthlyContrib * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
        : monthlyContrib * months;
      return sum + fvCurrent + fvContrib;
    }, 0);
    return { totalBalance, totalAnnualContrib, totalEmployerMatch, projectedAt65 };
  }, [accounts]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (a: RetirementAccount) => { setEditing(a); setModalOpen(true); };

  if (!user) return null;

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
      <div className="space-y-6 p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <PiggyBank size={22} className="text-primary" />
              Retirement
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track your retirement accounts, project your nest egg, and optimize Social Security timing.
            </p>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus size={14} className="mr-1.5" /> Add Account
          </Button>
        </motion.div>

        {/* KPIs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <KpiCard label="Total Retirement Balance" value={fmt(kpis.totalBalance)} icon={PiggyBank} />
          <KpiCard label="Annual Contributions" value={fmt(kpis.totalAnnualContrib)} sub="employee contributions" />
          <KpiCard label="Employer Match" value={fmt(kpis.totalEmployerMatch)} sub="estimated annual match" icon={TrendingUp} />
          <KpiCard
            label="Projected at 65"
            value={accounts.length ? fmt(kpis.projectedAt65) : "—"}
            sub="30-yr aggregate projection"
          />
        </motion.div>

        {/* Accounts Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PiggyBank size={15} className="text-primary" />
                Retirement Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={22} className="animate-spin text-muted-foreground" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
                  <PiggyBank size={32} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No retirement accounts yet. Add your first to get started.</p>
                  <Button size="sm" variant="outline" onClick={openAdd}>
                    <Plus size={14} className="mr-1.5" /> Add First Account
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-4">Account</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Provider</th>
                        <th className="pb-2 pr-4 text-right">Balance</th>
                        <th className="pb-2 pr-4 text-right">Annual Contrib</th>
                        <th className="pb-2 pr-4 text-right">Employer Match</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {accounts.map(a => (
                        <tr key={a.id} className="group hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4 font-medium text-foreground">{a.account_name}</td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant="outline"
                              className={`text-xs ${TYPE_COLORS[a.account_type] ?? TYPE_COLORS["Other"]}`}
                            >
                              {a.account_type}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">{a.provider || "—"}</td>
                          <td className="py-3 pr-4 text-right tabular-nums font-medium text-primary">
                            {fmt(a.current_balance)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                            {fmt(a.annual_contribution)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                            {a.employer_match_pct > 0
                              ? <span className="text-primary">{a.employer_match_pct}%</span>
                              : "—"}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                                <Pencil size={13} />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-bearish hover:text-bearish"
                                onClick={() => deleteMutation.mutate(a.id)}
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
                        <td colSpan={3} className="pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Totals
                        </td>
                        <td className="pt-3 text-right tabular-nums font-bold text-primary">
                          {fmt(accounts.reduce((s, a) => s + a.current_balance, 0))}
                        </td>
                        <td className="pt-3 text-right tabular-nums font-semibold text-foreground">
                          {fmt(accounts.reduce((s, a) => s + a.annual_contribution, 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Retirement Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <RetirementCalculator />
        </motion.div>

        {/* Social Security Break-Even */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SocialSecurityCalculator />
        </motion.div>
      </div>

      <AccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={user.id}
        existing={editing}
      />
      </SubscriptionGate>
    </DashboardLayout>
  );
}
