import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitMerge, ChevronRight, DollarSign, BarChart2, TrendingUp,
  Clock, Activity, Calculator, Layers, Plus, Trash2, Pencil, Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

type Signal = "Bullish" | "Bearish" | "Neutral";
type DealStatus = "Announced" | "Pending" | "Closed";

interface MaDeal {
  id: string;
  target: string;
  acquirer: string;
  deal_size: string;
  deal_type: string;
  ev_ebitda: string;
  premium: string;
  status: DealStatus;
  signal: Signal;
  notes: string;
}

interface MaComp {
  id: string;
  target: string;
  acquirer: string;
  year: number;
  sector: string;
  ev_b: number;
  ev_revenue: string;
  ev_ebitda: string;
  premium: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEAL_TYPES = ["Strategic", "LBO", "Carve-out", "Merger of Equals", "Privatization", "Other"];
const SECTORS = ["Technology", "Healthcare", "Fintech", "Consumer", "Real Estate", "Energy", "Media", "Industrial", "Biotech", "SaaS", "Gaming", "Other"];

// ── Helpers ────────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
const selectCls = `${inputCls} appearance-none`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SignalBadge({ signal }: { signal: Signal }) {
  if (signal === "Bullish") return <Badge variant="outline" className="bg-bullish/10 text-bullish border-bullish/20">Bullish</Badge>;
  if (signal === "Bearish") return <Badge variant="outline" className="bg-bearish/10 text-bearish border-bearish/20">Bearish</Badge>;
  return <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Neutral</Badge>;
}

function StatusBadge({ status }: { status: DealStatus }) {
  const cls = status === "Closed"
    ? "bg-muted text-muted-foreground border-border"
    : status === "Pending"
    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
    : "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return <Badge variant="outline" className={cls}>{status}</Badge>;
}

function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button size="sm" variant="outline" onClick={onAdd}>
        <Plus size={14} className="mr-1.5" /> Add First Entry
      </Button>
    </div>
  );
}

// ── Deal Modal ─────────────────────────────────────────────────────────────────

function DealModal({ open, onClose, existing, userId }: {
  open: boolean; onClose: () => void; existing?: MaDeal; userId: string;
}) {
  const qc = useQueryClient();
  const [target, setTarget]       = useState(existing?.target ?? "");
  const [acquirer, setAcquirer]   = useState(existing?.acquirer ?? "");
  const [dealSize, setDealSize]   = useState(existing?.deal_size ?? "");
  const [dealType, setDealType]   = useState(existing?.deal_type ?? "Strategic");
  const [evEbitda, setEvEbitda]   = useState(existing?.ev_ebitda ?? "");
  const [premium, setPremium]     = useState(existing?.premium ?? "");
  const [status, setStatus]       = useState<DealStatus>(existing?.status ?? "Announced");
  const [signal, setSignal]       = useState<Signal>(existing?.signal ?? "Neutral");
  const [notes, setNotes]         = useState(existing?.notes ?? "");
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    if (!target.trim() || !acquirer.trim()) { toast.error("Target and acquirer are required"); return; }
    setSaving(true);
    const payload = { user_id: userId, target: target.trim(), acquirer: acquirer.trim(), deal_size: dealSize, deal_type: dealType, ev_ebitda: evEbitda, premium, status, signal, notes };
    const { error } = existing
      ? await supabase.from("ma_deals").update(payload).eq("id", existing.id)
      : await supabase.from("ma_deals").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ma_deals", userId] });
    toast.success(existing ? "Deal updated." : "Deal added.");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Deal" : "Add M&A Deal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target Company">
              <input className={inputCls} value={target} onChange={e => setTarget(e.target.value)} placeholder="Acme Corp" />
            </Field>
            <Field label="Acquirer">
              <input className={inputCls} value={acquirer} onChange={e => setAcquirer(e.target.value)} placeholder="BigCo Inc" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deal Size">
              <input className={inputCls} value={dealSize} onChange={e => setDealSize(e.target.value)} placeholder="$10B" />
            </Field>
            <Field label="Deal Type">
              <select className={selectCls} value={dealType} onChange={e => setDealType(e.target.value)}>
                {DEAL_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="EV/EBITDA">
              <input className={inputCls} value={evEbitda} onChange={e => setEvEbitda(e.target.value)} placeholder="14.2x" />
            </Field>
            <Field label="Premium">
              <input className={inputCls} value={premium} onChange={e => setPremium(e.target.value)} placeholder="32%" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select className={selectCls} value={status} onChange={e => setStatus(e.target.value as DealStatus)}>
                {(["Announced", "Pending", "Closed"] as DealStatus[]).map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Signal">
              <select className={selectCls} value={signal} onChange={e => setSignal(e.target.value as Signal)}>
                {(["Bullish", "Neutral", "Bearish"] as Signal[]).map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea className={`${inputCls} resize-none`} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Thesis, risk factors..." />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            {existing ? "Save Changes" : "Add Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Comp Modal ─────────────────────────────────────────────────────────────────

function CompModal({ open, onClose, existing, userId }: {
  open: boolean; onClose: () => void; existing?: MaComp; userId: string;
}) {
  const qc = useQueryClient();
  const [target, setTarget]       = useState(existing?.target ?? "");
  const [acquirer, setAcquirer]   = useState(existing?.acquirer ?? "");
  const [year, setYear]           = useState(String(existing?.year ?? new Date().getFullYear()));
  const [sector, setSector]       = useState(existing?.sector ?? "Technology");
  const [evB, setEvB]             = useState(String(existing?.ev_b ?? ""));
  const [evRevenue, setEvRevenue] = useState(existing?.ev_revenue ?? "");
  const [evEbitda, setEvEbitda]   = useState(existing?.ev_ebitda ?? "");
  const [premium, setPremium]     = useState(existing?.premium ?? "");
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    if (!target.trim() || !acquirer.trim()) { toast.error("Target and acquirer are required"); return; }
    setSaving(true);
    const payload = { user_id: userId, target: target.trim(), acquirer: acquirer.trim(), year: parseInt(year) || new Date().getFullYear(), sector, ev_b: parseFloat(evB) || null, ev_revenue: evRevenue, ev_ebitda: evEbitda, premium };
    const { error } = existing
      ? await supabase.from("ma_comps").update(payload).eq("id", existing.id)
      : await supabase.from("ma_comps").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ma_comps", userId] });
    toast.success(existing ? "Comp updated." : "Comp added.");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Comparable" : "Add Comparable Transaction"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target">
              <input className={inputCls} value={target} onChange={e => setTarget(e.target.value)} placeholder="Acme Corp" />
            </Field>
            <Field label="Acquirer">
              <input className={inputCls} value={acquirer} onChange={e => setAcquirer(e.target.value)} placeholder="BigCo Inc" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input className={inputCls} type="number" value={year} onChange={e => setYear(e.target.value)} />
            </Field>
            <Field label="Sector">
              <select className={selectCls} value={sector} onChange={e => setSector(e.target.value)}>
                {SECTORS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="EV ($B)">
              <input className={inputCls} type="number" step={0.1} value={evB} onChange={e => setEvB(e.target.value)} placeholder="10.5" />
            </Field>
            <Field label="Premium">
              <input className={inputCls} value={premium} onChange={e => setPremium(e.target.value)} placeholder="32%" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="EV / Revenue">
              <input className={inputCls} value={evRevenue} onChange={e => setEvRevenue(e.target.value)} placeholder="5.2x" />
            </Field>
            <Field label="EV / EBITDA">
              <input className={inputCls} value={evEbitda} onChange={e => setEvEbitda(e.target.value)} placeholder="14.2x or n/m" />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            {existing ? "Save Changes" : "Add Comp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MergersAcquisitions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  const [dealModal, setDealModal] = useState<{ open: boolean; existing?: MaDeal }>({ open: false });
  const [compModal, setCompModal] = useState<{ open: boolean; existing?: MaComp }>({ open: false });

  // Accretion / dilution state
  const [acquirerEPS, setAcquirerEPS]         = useState(4.5);
  const [shares, setShares]                   = useState(500);
  const [targetNetIncome, setTargetNetIncome] = useState(200);
  const [dealPrice, setDealPrice]             = useState(3);
  const [cashPct, setCashPct]                 = useState(50);
  const [synergies, setSynergies]             = useState(50);
  const [integrationCosts, setIntegrationCosts] = useState(30);
  const [interestRate, setInterestRate]       = useState(5.5);

  // Synergy state
  const [revenueSynergies, setRevenueSynergies] = useState(30);
  const [costSynergies, setCostSynergies]       = useState(50);
  const [taxRate, setTaxRate]                   = useState(25);
  const [multiple, setMultiple]                 = useState(12);

  const dealsQuery = useQuery({
    queryKey: ["ma_deals", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ma_deals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as MaDeal[];
    },
    enabled: !!userId,
  });

  const compsQuery = useQuery({
    queryKey: ["ma_comps", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ma_comps").select("*").eq("user_id", userId).order("year", { ascending: false });
      if (error) throw error;
      return data as MaComp[];
    },
    enabled: !!userId,
  });

  const deleteDeal = useMutation({
    mutationFn: (id: string) => supabase.from("ma_deals").delete().eq("id", id).then(r => { if (r.error) throw r.error; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ma_deals", userId] }); toast.success("Deal removed."); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteComp = useMutation({
    mutationFn: (id: string) => supabase.from("ma_comps").delete().eq("id", id).then(r => { if (r.error) throw r.error; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ma_comps", userId] }); toast.success("Comp removed."); },
    onError: (e: any) => toast.error(e.message),
  });

  const deals = dealsQuery.data ?? [];
  const comps = compsQuery.data ?? [];

  // Computed KPIs
  const stockPct = 100 - cashPct;
  const newSharesIssued = (dealPrice * 1_000_000_000 * (stockPct / 100)) / (acquirerEPS * 20);
  const debtCostM = (dealPrice * 1_000_000_000 * (cashPct / 100) * (interestRate / 100)) / 1_000_000;
  const proFormaNetIncomeM = acquirerEPS * shares + targetNetIncome - debtCostM + synergies - integrationCosts;
  const proFormaSharesM = shares + newSharesIssued / 1_000_000;
  const proFormaEPS = proFormaSharesM > 0 ? proFormaNetIncomeM / proFormaSharesM : 0;
  const epsImpactPct = acquirerEPS > 0 ? ((proFormaEPS - acquirerEPS) / acquirerEPS) * 100 : 0;
  const isAccretive = epsImpactPct >= 0;
  const year3EPS = proFormaSharesM > 0 ? (acquirerEPS * shares + targetNetIncome - debtCostM + synergies * 1.5 - integrationCosts * 0.2) / proFormaSharesM : 0;
  const year3ImpactPct = acquirerEPS > 0 ? ((year3EPS - acquirerEPS) / acquirerEPS) * 100 : 0;

  const totalSynergyM = revenueSynergies + costSynergies;
  const afterTaxSynergyM = totalSynergyM * (1 - taxRate / 100);
  const npvSynergyM = afterTaxSynergyM * multiple;
  const synergyPctOfDeal = dealPrice > 0 ? (npvSynergyM / (dealPrice * 1000)) * 100 : 0;

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
            <GitMerge className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight">Mergers &amp; Acquisitions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Deal intelligence, synergy modeling, and transaction analysis</p>
          </div>
        </div>

        {/* Strategy Brief */}
        <Card className="border-l-4 border-l-primary border-border bg-card px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground leading-snug max-w-xl">
              Track your M&A deal watchlist, run accretion/dilution analysis, model synergies, and log comparable transactions for valuation benchmarking.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/decisions" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                Decision Hub <ChevronRight size={11} />
              </Link>
              <Link to="/screener" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                Screener <ChevronRight size={11} />
              </Link>
            </div>
          </div>
        </Card>

        {/* KPIs from user data */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Deals Tracked",    value: String(deals.length),                                                icon: <Activity size={14} /> },
            { label: "Active / Pending", value: String(deals.filter(d => d.status !== "Closed").length),           icon: <TrendingUp size={14} /> },
            { label: "Comps Logged",     value: String(comps.length),                                              icon: <BarChart2 size={14} /> },
            { label: "Pro Forma EPS",    value: proFormaSharesM > 0 ? `$${proFormaEPS.toFixed(2)}` : "—",          icon: <DollarSign size={14} /> },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider">
                <span>{stat.label}</span>
                {stat.icon}
              </div>
              <span className="font-mono text-2xl font-black text-primary">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Active Deal Tracker */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Deal Tracker</h2>
            <Button size="sm" variant="outline" onClick={() => setDealModal({ open: true })}>
              <Plus size={14} className="mr-1.5" /> Add Deal
            </Button>
          </div>
          {dealsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading...</div>
          ) : deals.length === 0 ? (
            <EmptyState label="No deals tracked yet. Add deals you're watching." onAdd={() => setDealModal({ open: true })} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      {["Target", "Acquirer", "Deal Size", "Type", "EV/EBITDA", "Premium", "Status", "Signal", ""].map(h => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map(deal => (
                      <tr key={deal.id} className="border-b border-border/40 transition-colors hover:bg-accent/20">
                        <td className="px-4 py-3 font-mono text-sm font-black text-foreground whitespace-nowrap">{deal.target}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{deal.acquirer}</td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-foreground">{deal.deal_size}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{deal.deal_type}</td>
                        <td className="px-4 py-3 font-mono text-sm">{deal.ev_ebitda}</td>
                        <td className="px-4 py-3 font-mono text-sm text-primary">{deal.premium}</td>
                        <td className="px-4 py-3"><StatusBadge status={deal.status} /></td>
                        <td className="px-4 py-3"><SignalBadge signal={deal.signal} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setDealModal({ open: true, existing: deal })} className="text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => deleteDeal.mutate(deal.id)} className="text-muted-foreground hover:text-bearish transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Calculators */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Accretion / Dilution */}
          <Card className="bg-card border border-border p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Accretion / Dilution</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Acquirer EPS ($)",       val: acquirerEPS,       set: setAcquirerEPS,       step: 0.1 },
                { label: "Shares Outstanding (M)", val: shares,            set: setShares,            step: 10  },
                { label: "Target Net Income ($M)", val: targetNetIncome,   set: setTargetNetIncome,   step: 10  },
                { label: "Deal Price ($B)",         val: dealPrice,         set: setDealPrice,         step: 0.5 },
                { label: "Cash Financing (%)",      val: cashPct,           set: (v: number) => setCashPct(Math.min(100, Math.max(0, v))), step: 5 },
                { label: "Interest Rate (%)",       val: interestRate,      set: setInterestRate,      step: 0.1 },
                { label: "Cost Synergies ($M)",     val: synergies,         set: setSynergies,         step: 5   },
                { label: "Integration Costs ($M)",  val: integrationCosts,  set: setIntegrationCosts,  step: 5   },
              ].map(f => (
                <Field key={f.label} label={f.label}>
                  <input type="number" step={f.step} value={f.val} onChange={e => f.set(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
                </Field>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Stock mix: {stockPct.toFixed(0)}% equity / {cashPct.toFixed(0)}% cash</p>
            <div className="border-t border-border pt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pro Forma EPS</p>
                <p className="font-mono text-lg font-black text-foreground">${proFormaEPS.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">EPS Impact</p>
                <p className={`font-mono text-lg font-black ${isAccretive ? "text-bullish" : "text-bearish"}`}>
                  {isAccretive ? "+" : ""}{epsImpactPct.toFixed(1)}% <span className="text-xs font-normal">({isAccretive ? "Accretive" : "Dilutive"})</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Year 1 EPS</p>
                <p className="font-mono text-base font-black text-foreground">${proFormaEPS.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Year 3 EPS</p>
                <p className={`font-mono text-base font-black ${year3ImpactPct >= 0 ? "text-bullish" : "text-bearish"}`}>
                  ${year3EPS.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">({year3ImpactPct >= 0 ? "+" : ""}{year3ImpactPct.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          </Card>

          {/* Synergy Calculator */}
          <Card className="bg-card border border-border p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Synergy Calculator</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Revenue Synergies ($M/yr)", val: revenueSynergies, set: setRevenueSynergies, step: 5   },
                { label: "Cost Synergies ($M/yr)",    val: costSynergies,    set: setCostSynergies,    step: 5   },
                { label: "Tax Rate (%)",               val: taxRate,          set: setTaxRate,          step: 1   },
                { label: "EBITDA Multiple (x)",        val: multiple,         set: setMultiple,         step: 0.5 },
              ].map(f => (
                <Field key={f.label} label={f.label}>
                  <input type="number" step={f.step} value={f.val} onChange={e => f.set(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
                </Field>
              ))}
            </div>
            <div className="border-t border-border pt-4 space-y-3">
              {[
                { label: "After-tax synergy value", value: `$${afterTaxSynergyM.toLocaleString(undefined, { maximumFractionDigits: 1 })}M / yr`, cls: "text-foreground" },
                { label: `NPV at ${multiple}x`,      value: `$${npvSynergyM.toLocaleString(undefined, { maximumFractionDigits: 0 })}M`,           cls: "text-primary" },
                { label: "% of deal price",          value: `${synergyPctOfDeal.toFixed(1)}%`,                                                    cls: synergyPctOfDeal >= 20 ? "text-bullish" : "text-muted-foreground" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className={`font-mono font-semibold ${r.cls}`}>{r.value}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
              Rule of thumb: synergy NPV should represent at least 20% of deal price.
              Currently at <span className={synergyPctOfDeal >= 20 ? "text-bullish font-medium" : "text-bearish font-medium"}>{synergyPctOfDeal.toFixed(1)}%</span>.
            </div>
          </Card>
        </div>

        {/* Comparable Transactions */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Comparable Transactions</h2>
            <Button size="sm" variant="outline" onClick={() => setCompModal({ open: true })}>
              <Plus size={14} className="mr-1.5" /> Add Comp
            </Button>
          </div>
          {compsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading...</div>
          ) : comps.length === 0 ? (
            <EmptyState label="No comp transactions logged yet. Add deals to build your comps table." onAdd={() => setCompModal({ open: true })} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      {["Target", "Acquirer", "Year", "Sector", "EV ($B)", "EV/Revenue", "EV/EBITDA", "Premium", ""].map(h => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comps.map(tx => (
                      <tr key={tx.id} className="border-b border-border/40 transition-colors hover:bg-accent/20">
                        <td className="px-4 py-3 font-mono text-sm font-black text-foreground whitespace-nowrap">{tx.target}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{tx.acquirer}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{tx.year}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{tx.sector}</td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-foreground">{tx.ev_b ? `$${tx.ev_b}B` : "—"}</td>
                        <td className="px-4 py-3 font-mono text-sm">{tx.ev_revenue || "—"}</td>
                        <td className="px-4 py-3 font-mono text-sm">{tx.ev_ebitda || "—"}</td>
                        <td className="px-4 py-3 font-mono text-sm text-primary">{tx.premium || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCompModal({ open: true, existing: tx })} className="text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => deleteComp.mutate(tx.id)} className="text-muted-foreground hover:text-bearish transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </motion.div>

      <DealModal open={dealModal.open} existing={dealModal.existing} userId={userId} onClose={() => setDealModal({ open: false })} />
      <CompModal open={compModal.open} existing={compModal.existing} userId={userId} onClose={() => setCompModal({ open: false })} />
    </DashboardLayout>
  );
}
