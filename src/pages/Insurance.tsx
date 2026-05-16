import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Shield, Plus, Pencil, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface InsurancePolicy {
  id: string;
  user_id: string;
  name: string;
  policy_type: string;
  provider: string | null;
  premium_amount: number;
  premium_frequency: string;
  coverage_amount: number | null;
  renewal_date: string | null;
  notes: string | null;
  created_at: string;
}

const POLICY_TYPES = [
  "Life", "Health", "Disability", "Auto",
  "Homeowners", "Renters", "Umbrella", "Business", "Other",
];

const FREQUENCIES = ["monthly", "quarterly", "annual"];

const COVERAGE_TYPES = [
  { label: "Life Insurance", type: "Life" },
  { label: "Health", type: "Health" },
  { label: "Disability", type: "Disability" },
  { label: "Auto", type: "Auto" },
  { label: "Homeowners / Renters", types: ["Homeowners", "Renters"] },
  { label: "Umbrella", type: "Umbrella" },
];

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

function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button size="sm" variant="outline" onClick={onAdd}>
        <Plus size={14} className="mr-1.5" /> Add First Entry
      </Button>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function annualCost(policy: InsurancePolicy): number {
  const mult = policy.premium_frequency === "monthly" ? 12
    : policy.premium_frequency === "quarterly" ? 4
    : 1;
  return policy.premium_amount * mult;
}

function renewalColor(dateStr: string | null): string {
  if (!dateStr) return "text-muted-foreground";
  const days = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  if (days < 30) return "text-red-400";
  if (days < 90) return "text-amber-400";
  return "text-muted-foreground";
}

interface PolicyForm {
  name: string;
  policy_type: string;
  provider: string;
  premium_amount: string;
  premium_frequency: string;
  coverage_amount: string;
  renewal_date: string;
  notes: string;
}

const emptyForm: PolicyForm = {
  name: "",
  policy_type: POLICY_TYPES[0],
  provider: "",
  premium_amount: "",
  premium_frequency: "monthly",
  coverage_amount: "",
  renewal_date: "",
  notes: "",
};

function PolicyModal({
  open, onClose, userId, existing,
}: { open: boolean; onClose: () => void; userId: string; existing: InsurancePolicy | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PolicyForm>(
    existing
      ? {
          name: existing.name,
          policy_type: existing.policy_type,
          provider: existing.provider ?? "",
          premium_amount: String(existing.premium_amount),
          premium_frequency: existing.premium_frequency,
          coverage_amount: existing.coverage_amount != null ? String(existing.coverage_amount) : "",
          renewal_date: existing.renewal_date ?? "",
          notes: existing.notes ?? "",
        }
      : emptyForm,
  );

  const set = (k: keyof PolicyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        name: form.name.trim(),
        policy_type: form.policy_type,
        provider: form.provider.trim() || null,
        premium_amount: parseFloat(form.premium_amount) || 0,
        premium_frequency: form.premium_frequency,
        coverage_amount: form.coverage_amount ? parseFloat(form.coverage_amount) : null,
        renewal_date: form.renewal_date || null,
        notes: form.notes.trim() || null,
      };
      if (existing) {
        const { error } = await supabase.from("insurance_policies").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("insurance_policies").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance_policies"] });
      toast.success(existing ? "Policy updated" : "Policy added");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Policy" : "Add Policy"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Policy Name">
            <input className={inputCls} value={form.name} onChange={set("name")} placeholder="e.g. State Farm Auto" />
          </Field>
          <Field label="Type">
            <select className={selectCls} value={form.policy_type} onChange={set("policy_type")}>
              {POLICY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Provider">
            <input className={inputCls} value={form.provider} onChange={set("provider")} placeholder="Insurance company name" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Premium ($)">
              <input className={inputCls} type="number" min="0" value={form.premium_amount} onChange={set("premium_amount")} placeholder="0" />
            </Field>
            <Field label="Frequency">
              <select className={selectCls} value={form.premium_frequency} onChange={set("premium_frequency")}>
                {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Coverage Amount ($)">
            <input className={inputCls} type="number" min="0" value={form.coverage_amount} onChange={set("coverage_amount")} placeholder="Optional" />
          </Field>
          <Field label="Renewal Date">
            <input className={inputCls} type="date" value={form.renewal_date} onChange={set("renewal_date")} />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.name || !form.premium_amount || mutation.isPending}
          >
            {mutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Insurance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InsurancePolicy | null>(null);

  const { data: policies = [], isLoading } = useQuery<InsurancePolicy[]>({
    queryKey: ["insurance_policies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_policies")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("insurance_policies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance_policies"] });
      toast.success("Policy removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const totalAnnual = policies.reduce((sum, p) => sum + annualCost(p), 0);
    const totalCoverage = policies.reduce((sum, p) => sum + (p.coverage_amount ?? 0), 0);
    const nextRenewal = policies
      .filter(p => p.renewal_date)
      .sort((a, b) => new Date(a.renewal_date!).getTime() - new Date(b.renewal_date!).getTime())[0];
    return { totalAnnual, totalCoverage, count: policies.length, nextRenewal };
  }, [policies]);

  function hasType(types: string | string[]) {
    const arr = Array.isArray(types) ? types : [types];
    return policies.some(p => arr.includes(p.policy_type));
  }

  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(p: InsurancePolicy) { setEditing(p); setModalOpen(true); }

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Insurance</h1>
            <p className="text-sm text-muted-foreground">Coverage tracking, gap analysis, and premium management</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total Annual Premiums" value={fmt(kpis.totalAnnual)} />
          <KpiCard label="Total Coverage" value={kpis.totalCoverage > 0 ? fmt(kpis.totalCoverage) : "—"} />
          <KpiCard label="Policies" value={String(kpis.count)} />
          <KpiCard
            label="Next Renewal"
            value={kpis.nextRenewal?.renewal_date
              ? new Date(kpis.nextRenewal.renewal_date).toLocaleDateString()
              : "—"}
            sub={kpis.nextRenewal?.name}
          />
        </div>

        {/* Coverage gap checklist */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coverage Gap Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COVERAGE_TYPES.map(ct => {
                const covered = hasType((ct as any).types ?? ct.type);
                return (
                  <div
                    key={ct.label}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${covered ? "border-green-500/30 bg-green-500/5" : "border-border bg-muted/20"}`}
                  >
                    {covered
                      ? <CheckCircle2 size={15} className="shrink-0 text-green-400" />
                      : <XCircle size={15} className="shrink-0 text-muted-foreground/40" />}
                    <span className={`text-xs font-medium ${covered ? "text-foreground" : "text-muted-foreground"}`}>
                      {ct.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Policies table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Policies</CardTitle>
            <Button size="sm" onClick={openAdd}>
              <Plus size={14} className="mr-1.5" /> Add Policy
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={20} />
              </div>
            ) : policies.length === 0 ? (
              <EmptyState label="No policies tracked yet. Add your first policy to start gap analysis." onAdd={openAdd} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <th className="pb-2 text-left">Name</th>
                      <th className="pb-2 text-left">Type</th>
                      <th className="pb-2 text-left">Provider</th>
                      <th className="pb-2 text-right">Premium</th>
                      <th className="pb-2 text-left">Freq</th>
                      <th className="pb-2 text-right">Annual</th>
                      <th className="pb-2 text-right">Coverage</th>
                      <th className="pb-2 text-left">Renewal</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {policies.map(p => (
                      <tr key={p.id} className="group">
                        <td className="py-3 font-medium text-foreground">{p.name}</td>
                        <td className="py-3 text-muted-foreground">{p.policy_type}</td>
                        <td className="py-3 text-muted-foreground">{p.provider ?? "—"}</td>
                        <td className="py-3 text-right text-foreground">{fmt(p.premium_amount)}</td>
                        <td className="py-3 text-muted-foreground capitalize">{p.premium_frequency}</td>
                        <td className="py-3 text-right text-foreground">{fmt(annualCost(p))}</td>
                        <td className="py-3 text-right text-muted-foreground">
                          {p.coverage_amount != null ? fmt(p.coverage_amount) : "—"}
                        </td>
                        <td className={`py-3 ${renewalColor(p.renewal_date)}`}>
                          {p.renewal_date ? new Date(p.renewal_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                              <Pencil size={13} />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(p.id)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coverage Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { type: "Life Insurance", rule: "10–12× your gross annual income. Term is cheaper; permanent builds cash value." },
                { type: "Disability", rule: "60–70% of gross income. Most employer plans cover only 60%; supplement if needed." },
                { type: "Umbrella", rule: "$1M+ if your net worth exceeds $500K. Covers excess liability above auto/home limits." },
                { type: "Health", rule: "Minimum: ACA-compliant plan with an out-of-pocket max. HSA-eligible HDHP if healthy." },
                { type: "Homeowners", rule: "Replacement cost value, not market value. Inflation guard rider recommended." },
                { type: "Long-Term Care", rule: "Consider at age 50–55. Average claim: 2–3 years at $100K+/yr." },
              ].map(r => (
                <div key={r.type} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                  <p className="text-xs font-semibold text-foreground">{r.type}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.rule}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {user && (
        <PolicyModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          userId={user.id}
          existing={editing}
        />
      )}
      </SubscriptionGate>
    </DashboardLayout>
  );
}
