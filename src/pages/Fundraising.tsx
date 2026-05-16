import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { TrendingUp, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface FundraisingRound {
  id: string;
  user_id: string;
  company_name: string;
  round_type: string;
  target_amount: number;
  raised_amount: number;
  pre_money_valuation: number | null;
  status: string;
  close_date: string | null;
  notes: string | null;
  created_at: string;
}

const ROUND_TYPES = [
  "Pre-Seed", "Seed", "Series A", "Series B", "Series C",
  "Bridge", "SAFE", "Convertible Note",
];

const STATUSES = ["Planning", "Open", "Closed"];

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

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals }).format(n);

const fmtM = (n: number) => `$${(n / 1e6).toFixed(1)}M`;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    "Planning": "bg-muted/50 text-muted-foreground border-border",
    "Open": "bg-primary/15 text-primary border-primary/30",
    "Closed": "bg-green-500/15 text-green-400 border-green-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] ?? map["Planning"]}`}>
      {status}
    </span>
  );
}

interface RoundForm {
  company_name: string;
  round_type: string;
  target_amount: string;
  raised_amount: string;
  pre_money_valuation: string;
  status: string;
  close_date: string;
  notes: string;
}

const emptyForm: RoundForm = {
  company_name: "",
  round_type: ROUND_TYPES[0],
  target_amount: "",
  raised_amount: "",
  pre_money_valuation: "",
  status: "Planning",
  close_date: "",
  notes: "",
};

function RoundModal({
  open, onClose, userId, existing,
}: { open: boolean; onClose: () => void; userId: string; existing: FundraisingRound | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<RoundForm>(
    existing
      ? {
          company_name: existing.company_name,
          round_type: existing.round_type,
          target_amount: String(existing.target_amount),
          raised_amount: String(existing.raised_amount),
          pre_money_valuation: existing.pre_money_valuation != null ? String(existing.pre_money_valuation) : "",
          status: existing.status,
          close_date: existing.close_date ?? "",
          notes: existing.notes ?? "",
        }
      : emptyForm,
  );

  const set = (k: keyof RoundForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        company_name: form.company_name.trim(),
        round_type: form.round_type,
        target_amount: parseFloat(form.target_amount) || 0,
        raised_amount: parseFloat(form.raised_amount) || 0,
        pre_money_valuation: form.pre_money_valuation ? parseFloat(form.pre_money_valuation) : null,
        status: form.status,
        close_date: form.close_date || null,
        notes: form.notes.trim() || null,
      };
      if (existing) {
        const { error } = await supabase.from("fundraising_rounds").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fundraising_rounds").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fundraising_rounds"] });
      toast.success(existing ? "Round updated" : "Round added");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Round" : "Add Round"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Company Name">
            <input className={inputCls} value={form.company_name} onChange={set("company_name")} placeholder="e.g. Acme Inc." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Round Type">
              <select className={selectCls} value={form.round_type} onChange={set("round_type")}>
                {ROUND_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={selectCls} value={form.status} onChange={set("status")}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target Amount ($)">
              <input className={inputCls} type="number" min="0" value={form.target_amount} onChange={set("target_amount")} placeholder="0" />
            </Field>
            <Field label="Raised Amount ($)">
              <input className={inputCls} type="number" min="0" value={form.raised_amount} onChange={set("raised_amount")} placeholder="0" />
            </Field>
          </div>
          <Field label="Pre-Money Valuation ($)">
            <input className={inputCls} type="number" min="0" value={form.pre_money_valuation} onChange={set("pre_money_valuation")} placeholder="Optional" />
          </Field>
          <Field label="Close Date">
            <input className={inputCls} type="date" value={form.close_date} onChange={set("close_date")} />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.company_name || !form.target_amount || mutation.isPending}
          >
            {mutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Round"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DilutionCalculator() {
  const [preMoney, setPreMoney] = useState("5");
  const [investment, setInvestment] = useState("2");
  const [founderShares, setFounderShares] = useState("10");
  const [optionPool, setOptionPool] = useState("10");

  const pre = (parseFloat(preMoney) || 0) * 1e6;
  const inv = (parseFloat(investment) || 0) * 1e6;
  const post = pre + inv;
  const fShares = (parseFloat(founderShares) || 0) * 1e6;
  const opPct = (parseFloat(optionPool) || 0) / 100;

  const pricePerShare = pre > 0 && fShares > 0 ? pre / fShares : 0;
  const newShares = pricePerShare > 0 ? inv / pricePerShare : 0;
  const totalShares = fShares + newShares + fShares * opPct;
  const founderPct = totalShares > 0 ? (fShares / totalShares) * 100 : 0;
  const investorPct = totalShares > 0 ? (newShares / totalShares) * 100 : 0;
  const poolPct = totalShares > 0 ? ((fShares * opPct) / totalShares) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Dilution Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Pre-Money Val ($M)">
            <input className={inputCls} type="number" step="0.1" value={preMoney} onChange={e => setPreMoney(e.target.value)} />
          </Field>
          <Field label="Investment ($M)">
            <input className={inputCls} type="number" step="0.1" value={investment} onChange={e => setInvestment(e.target.value)} />
          </Field>
          <Field label="Founder Shares (M)">
            <input className={inputCls} type="number" step="0.1" value={founderShares} onChange={e => setFounderShares(e.target.value)} />
          </Field>
          <Field label="Option Pool (%)">
            <input className={inputCls} type="number" step="1" value={optionPool} onChange={e => setOptionPool(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
              <span className="text-sm text-muted-foreground">Post-Money Valuation</span>
              <span className="text-sm font-semibold text-foreground">{fmtM(post)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
              <span className="text-sm text-muted-foreground">Price Per Share</span>
              <span className="text-sm font-semibold text-foreground">{pricePerShare > 0 ? fmt(pricePerShare, 4) : "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
              <span className="text-sm text-muted-foreground">New Shares Issued</span>
              <span className="text-sm font-semibold text-foreground">{newShares > 0 ? `${(newShares / 1e6).toFixed(2)}M` : "—"}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Post-Round Cap Table</p>
            {[
              { label: "Founders", pct: founderPct, color: "bg-primary" },
              { label: "Investors", pct: investorPct, color: "bg-blue-500" },
              { label: "Option Pool", pct: poolPct, color: "bg-amber-500" },
            ].map(row => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-semibold text-foreground">{row.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Fundraising() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FundraisingRound | null>(null);

  const { data: rounds = [], isLoading } = useQuery<FundraisingRound[]>({
    queryKey: ["fundraising_rounds", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fundraising_rounds")
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
      const { error } = await supabase.from("fundraising_rounds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fundraising_rounds"] });
      toast.success("Round removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = useMemo(() => {
    const totalTarget = rounds.reduce((s, r) => s + r.target_amount, 0);
    const totalRaised = rounds.reduce((s, r) => s + r.raised_amount, 0);
    const avg = rounds.length > 0 ? totalTarget / rounds.length : 0;
    const active = rounds.filter(r => r.status === "Open").length;
    return { totalTarget, totalRaised, avg, active };
  }, [rounds]);

  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(r: FundraisingRound) { setEditing(r); setModalOpen(true); }

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
            <TrendingUp size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Fundraising</h1>
            <p className="text-sm text-muted-foreground">Round tracking, cap table modeling, and investor pipeline</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total Target" value={fmt(kpis.totalTarget)} />
          <KpiCard label="Total Raised" value={fmt(kpis.totalRaised)} />
          <KpiCard label="Avg Round Size" value={kpis.avg > 0 ? fmt(kpis.avg) : "—"} />
          <KpiCard label="Active Rounds" value={String(kpis.active)} />
        </div>

        {/* Rounds table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Rounds</CardTitle>
            <Button size="sm" onClick={openAdd}>
              <Plus size={14} className="mr-1.5" /> Add Round
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={20} />
              </div>
            ) : rounds.length === 0 ? (
              <EmptyState label="No rounds tracked yet. Add your first fundraising round." onAdd={openAdd} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <th className="pb-2 text-left">Company</th>
                      <th className="pb-2 text-left">Round</th>
                      <th className="pb-2 text-right">Target</th>
                      <th className="pb-2 text-right">Raised</th>
                      <th className="pb-2 text-left min-w-[100px]">Progress</th>
                      <th className="pb-2 text-right">Pre-Money</th>
                      <th className="pb-2 text-right">Post-Money</th>
                      <th className="pb-2 text-left">Status</th>
                      <th className="pb-2 text-left">Close</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rounds.map(r => {
                      const pct = r.target_amount > 0 ? Math.min((r.raised_amount / r.target_amount) * 100, 100) : 0;
                      const postMoney = r.pre_money_valuation != null ? r.pre_money_valuation + r.raised_amount : null;
                      return (
                        <tr key={r.id} className="group">
                          <td className="py-3 font-medium text-foreground">{r.company_name}</td>
                          <td className="py-3 text-muted-foreground">{r.round_type}</td>
                          <td className="py-3 text-right text-foreground">{fmt(r.target_amount)}</td>
                          <td className="py-3 text-right text-foreground">{fmt(r.raised_amount)}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="py-3 text-right text-muted-foreground">
                            {r.pre_money_valuation != null ? fmt(r.pre_money_valuation) : "—"}
                          </td>
                          <td className="py-3 text-right text-muted-foreground">
                            {postMoney != null ? fmt(postMoney) : "—"}
                          </td>
                          <td className="py-3">{statusBadge(r.status)}</td>
                          <td className="py-3 text-muted-foreground">
                            {r.close_date ? new Date(r.close_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                                <Pencil size={13} />
                              </Button>
                              <Button
                                size="icon" variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(r.id)}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dilution calculator */}
        <DilutionCalculator />

        {/* SAFE vs Priced Round */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SAFE vs Priced Round</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">SAFE (Simple Agreement for Future Equity)</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />No interest or maturity date — no immediate debt obligation.</li>
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Converts to equity at the next priced round, usually with a valuation cap or discount (typically 15–20%).</li>
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Faster and cheaper to execute — minimal legal fees ($1K–$3K).</li>
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Best for pre-product or pre-revenue companies raising $50K–$2M.</li>
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Investor has no board seat and limited rights until conversion.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Priced Equity Round (Seed / Series A+)</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />Sets a firm valuation and issues shares immediately — investors know their exact ownership.</li>
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />Higher legal complexity: term sheets, preferred stock terms, liquidation preferences ($15K–$50K legal fees).</li>
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />Often includes investor protections: pro-rata rights, information rights, board representation.</li>
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />Required by most institutional VCs at Series A+ ($2M+ rounds).</li>
                  <li className="flex gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />Typical terms: 1× non-participating liquidation preference, standard anti-dilution.</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <p className="text-xs text-amber-400 font-medium">General rule of thumb: Use a SAFE for rounds under $2M or pre-revenue. Switch to a priced round when institutional VCs are involved or you need clean capitalization before an M&A process.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {user && (
        <RoundModal
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
