import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, ChevronRight, TrendingUp, TrendingDown,
  Circle, Calculator, Layers, Plus, Trash2, Pencil, Loader2,
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

type DealStage = "Sourcing" | "Due Diligence" | "LOI / Negotiation" | "Closed";
type PortfolioStatus = "Active" | "Exited" | "Watch";

interface PeDeal {
  id: string;
  company: string;
  sector: string;
  size_mm: number;
  stage: DealStage;
  notes: string;
}

interface PePortfolio {
  id: string;
  company: string;
  sector: string;
  invested_mm: number;
  current_mm: number;
  vintage_year: number;
  status: PortfolioStatus;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PIPELINE_STAGES: DealStage[] = ["Sourcing", "Due Diligence", "LOI / Negotiation", "Closed"];

const STAGE_COLOR: Record<DealStage, string> = {
  "Sourcing":          "text-muted-foreground",
  "Due Diligence":     "text-watch",
  "LOI / Negotiation": "text-primary",
  "Closed":            "text-bullish",
};

const SECTORS = [
  "Technology", "Healthcare", "Fintech", "Consumer", "Real Estate",
  "Logistics", "Manufacturing", "CleanTech", "Industrial", "Transportation", "Other",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusBadgeClass(status: PortfolioStatus) {
  if (status === "Active") return "bg-primary/15 text-primary border-primary/30";
  if (status === "Exited") return "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30";
  return "bg-bearish/15 text-bearish border-bearish/30";
}

function irrColor(irr: number) {
  if (irr >= 20) return "text-bullish";
  if (irr >= 0) return "text-watch";
  return "text-bearish";
}

function moicColor(moic: number) {
  if (moic >= 2) return "text-bullish";
  if (moic >= 1) return "text-foreground";
  return "text-bearish";
}

function calcMoic(invested: number, current: number) {
  return invested > 0 ? current / invested : 0;
}

function calcIRR(invested: number, current: number, vintage: number) {
  const years = new Date().getFullYear() - vintage;
  if (invested <= 0 || years <= 0) return 0;
  return (Math.pow(current / invested, 1 / years) - 1) * 100;
}

// ── Empty state ────────────────────────────────────────────────────────────────

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

// ── Input helper ───────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
const selectCls = `${inputCls} appearance-none`;

// ── Add/Edit Deal Modal ────────────────────────────────────────────────────────

function DealModal({
  open, onClose, existing, userId,
}: {
  open: boolean;
  onClose: () => void;
  existing?: PeDeal;
  userId: string;
}) {
  const qc = useQueryClient();
  const [company, setCompany] = useState(existing?.company ?? "");
  const [sector, setSector] = useState(existing?.sector ?? "Technology");
  const [sizeMm, setSizeMm] = useState(String(existing?.size_mm ?? ""));
  const [stage, setStage] = useState<DealStage>(existing?.stage ?? "Sourcing");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!company.trim()) { toast.error("Company name is required"); return; }
    setSaving(true);
    const payload = {
      user_id: userId, company: company.trim(), sector,
      size_mm: parseFloat(sizeMm) || null, stage, notes,
    };
    const { error } = existing
      ? await supabase.from("pe_deals").update(payload).eq("id", existing.id)
      : await supabase.from("pe_deals").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["pe_deals", userId] });
    toast.success(existing ? "Deal updated." : "Deal added.");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Deal" : "Add Pipeline Deal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Company Name">
            <input className={inputCls} value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sector">
              <select className={selectCls} value={sector} onChange={e => setSector(e.target.value)}>
                {SECTORS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Deal Size ($M)">
              <input className={inputCls} type="number" value={sizeMm} onChange={e => setSizeMm(e.target.value)} placeholder="100" />
            </Field>
          </div>
          <Field label="Stage">
            <select className={selectCls} value={stage} onChange={e => setStage(e.target.value as DealStage)}>
              {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Notes (optional)">
            <textarea className={`${inputCls} resize-none`} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Key observations..." />
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

// ── Add/Edit Portfolio Modal ───────────────────────────────────────────────────

function PortfolioModal({
  open, onClose, existing, userId,
}: {
  open: boolean;
  onClose: () => void;
  existing?: PePortfolio;
  userId: string;
}) {
  const qc = useQueryClient();
  const [company, setCompany]     = useState(existing?.company ?? "");
  const [sector, setSector]       = useState(existing?.sector ?? "Technology");
  const [invested, setInvested]   = useState(String(existing?.invested_mm ?? ""));
  const [current, setCurrent]     = useState(String(existing?.current_mm ?? ""));
  const [vintage, setVintage]     = useState(String(existing?.vintage_year ?? new Date().getFullYear()));
  const [status, setStatus]       = useState<PortfolioStatus>(existing?.status ?? "Active");
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    if (!company.trim()) { toast.error("Company name is required"); return; }
    setSaving(true);
    const payload = {
      user_id: userId, company: company.trim(), sector,
      invested_mm: parseFloat(invested) || 0,
      current_mm: parseFloat(current) || 0,
      vintage_year: parseInt(vintage) || new Date().getFullYear(),
      status,
    };
    const { error } = existing
      ? await supabase.from("pe_portfolio").update(payload).eq("id", existing.id)
      : await supabase.from("pe_portfolio").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["pe_portfolio", userId] });
    toast.success(existing ? "Company updated." : "Company added.");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Portfolio Company" : "Add Portfolio Company"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Company Name">
            <input className={inputCls} value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sector">
              <select className={selectCls} value={sector} onChange={e => setSector(e.target.value)}>
                {SECTORS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Vintage Year">
              <input className={inputCls} type="number" value={vintage} onChange={e => setVintage(e.target.value)} placeholder="2023" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invested ($M)">
              <input className={inputCls} type="number" value={invested} onChange={e => setInvested(e.target.value)} placeholder="50" />
            </Field>
            <Field label="Current Value ($M)">
              <input className={inputCls} type="number" value={current} onChange={e => setCurrent(e.target.value)} placeholder="100" />
            </Field>
          </div>
          <Field label="Status">
            <select className={selectCls} value={status} onChange={e => setStatus(e.target.value as PortfolioStatus)}>
              {(["Active", "Exited", "Watch"] as PortfolioStatus[]).map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            {existing ? "Save Changes" : "Add Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── IRR Calculator ─────────────────────────────────────────────────────────────

function IrrCalculator() {
  const [invested, setInvested]     = useState(1000000);
  const [currentValue, setCurrentValue] = useState(2400000);
  const [years, setYears]           = useState(5);

  const irr = invested > 0 && years > 0 && currentValue > 0
    ? ((Math.pow(currentValue / invested, 1 / years) - 1) * 100).toFixed(1)
    : "—";

  return (
    <Card className="border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Calculator size={14} className="text-muted-foreground" />
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">IRR Calculator</h3>
      </div>
      <div className="space-y-4">
        <Field label="Invested ($)">
          <input type="number" value={invested} onChange={e => setInvested(Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Current Value ($)">
          <input type="number" value={currentValue} onChange={e => setCurrentValue(Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Hold Period (years)">
          <input type="number" value={years} min={1} onChange={e => setYears(Number(e.target.value))} className={inputCls} />
        </Field>
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Computed IRR</p>
        <p className="font-mono text-4xl font-black text-primary">{irr !== "—" ? `${irr}%` : "—"}</p>
      </div>
    </Card>
  );
}

// ── MOIC → IRR Calculator ──────────────────────────────────────────────────────

function MoicToIrr() {
  const [moic, setMoic]         = useState(2.4);
  const [holdYears, setHoldYears] = useState(5);

  const irr = moic > 0 && holdYears > 0
    ? ((Math.pow(moic, 1 / holdYears) - 1) * 100).toFixed(1)
    : "—";

  return (
    <Card className="border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Calculator size={14} className="text-muted-foreground" />
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">MOIC → IRR</h3>
      </div>
      <div className="space-y-4">
        <Field label="MOIC (x)">
          <input type="number" step={0.1} value={moic} onChange={e => setMoic(Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Hold Period (years)">
          <input type="number" value={holdYears} min={1} onChange={e => setHoldYears(Number(e.target.value))} className={inputCls} />
        </Field>
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Equivalent IRR</p>
        <p className="font-mono text-4xl font-black text-primary">{irr !== "—" ? `${irr}%` : "—"}</p>
      </div>
    </Card>
  );
}

// ── LP / GP Economics ──────────────────────────────────────────────────────────

function LpGpEconomics() {
  const [fundSizeMM, setFundSizeMM] = useState(100);
  const [mgmtFeePct, setMgmtFeePct] = useState(2);
  const [carryPct, setCarryPct]     = useState(20);

  const annualMgmtFee = (fundSizeMM * mgmtFeePct) / 100;
  const profit = fundSizeMM;
  const gpCarry = (profit * carryPct) / 100;
  const lpNet = fundSizeMM * 2 - gpCarry - annualMgmtFee * 5;
  const lpNetReturn = ((lpNet / fundSizeMM - 1) * 100).toFixed(1);

  return (
    <Card className="border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-muted-foreground" />
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">LP / GP Economics</h3>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Fund Size ($M)">
          <input type="number" value={fundSizeMM} onChange={e => setFundSizeMM(Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Mgmt Fee (%)">
          <input type="number" step={0.5} value={mgmtFeePct} onChange={e => setMgmtFeePct(Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Carry (%)">
          <input type="number" step={1} value={carryPct} onChange={e => setCarryPct(Number(e.target.value))} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Annual Mgmt Fee</p>
          <p className="font-mono text-xl font-black text-foreground">${annualMgmtFee.toLocaleString(undefined, { maximumFractionDigits: 1 })}M</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">GP Carry (2x exit)</p>
          <p className="font-mono text-xl font-black text-primary">${gpCarry.toLocaleString(undefined, { maximumFractionDigits: 1 })}M</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">LP Net Return</p>
          <p className={`font-mono text-xl font-black ${Number(lpNetReturn) >= 0 ? "text-bullish" : "text-bearish"}`}>{lpNetReturn}%</p>
        </div>
      </div>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PrivateEquity() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  const [dealModal, setDealModal]         = useState<{ open: boolean; existing?: PeDeal }>({ open: false });
  const [portfolioModal, setPortfolioModal] = useState<{ open: boolean; existing?: PePortfolio }>({ open: false });

  const dealsQuery = useQuery({
    queryKey: ["pe_deals", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pe_deals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PeDeal[];
    },
    enabled: !!userId,
  });

  const portfolioQuery = useQuery({
    queryKey: ["pe_portfolio", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pe_portfolio")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PePortfolio[];
    },
    enabled: !!userId,
  });

  const deleteDeal = useMutation({
    mutationFn: (id: string) => supabase.from("pe_deals").delete().eq("id", id).then(r => { if (r.error) throw r.error; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pe_deals", userId] }); toast.success("Deal removed."); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePortfolio = useMutation({
    mutationFn: (id: string) => supabase.from("pe_portfolio").delete().eq("id", id).then(r => { if (r.error) throw r.error; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pe_portfolio", userId] }); toast.success("Company removed."); },
    onError: (e: any) => toast.error(e.message),
  });

  const deals = dealsQuery.data ?? [];
  const portfolio = portfolioQuery.data ?? [];

  // Computed KPIs from portfolio
  const totalInvested = portfolio.reduce((s, c) => s + c.invested_mm, 0);
  const totalCurrent  = portfolio.reduce((s, c) => s + c.current_mm, 0);
  const portfolioMoic = totalInvested > 0 ? (totalCurrent / totalInvested).toFixed(2) : "—";
  const avgIRR = portfolio.length > 0
    ? (portfolio.reduce((s, c) => s + calcIRR(c.invested_mm, c.current_mm, c.vintage_year), 0) / portfolio.length).toFixed(1)
    : "—";

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">

        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Building2 size={12} className="text-muted-foreground" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Alternatives</span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">Private Equity</h2>
          <p className="mt-1 text-sm text-muted-foreground">Deal pipeline, portfolio performance, and fund economics</p>
        </div>

        {/* Strategy Brief */}
        <div className="rounded-xl border border-amber-500/40 bg-card px-4 py-3" style={{ borderLeftWidth: "4px", borderLeftColor: "rgb(245 158 11)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex shrink-0 items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1">
                <TrendingUp size={12} className="text-amber-400" />
                <span className="font-mono text-xs font-black uppercase tracking-wider text-amber-400">VINTAGE 2023–24</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug max-w-xl">
                Global PE dry powder at $3.9T. Rising rates compressing exit multiples — focus on operationally-driven value creation.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/decisions" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                Decision Hub <ChevronRight size={11} />
              </Link>
              <Link to="/strategy-allocator" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                Strategy Allocator <ChevronRight size={11} />
              </Link>
            </div>
          </div>
        </div>

        {/* KPIs — computed from user data */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Portfolio MOIC",    value: portfolioMoic !== "—" ? `${portfolioMoic}x` : "—",  up: true },
            { label: "Avg Gross IRR",     value: avgIRR !== "—" ? `${avgIRR}%` : "—",               up: true },
            { label: "Total Invested",    value: totalInvested > 0 ? `$${totalInvested.toLocaleString()}M` : "—", up: true },
            { label: "Portfolio Companies", value: String(portfolio.length),                          up: true },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{stat.label}</p>
              <p className="font-mono text-2xl font-black text-primary">{stat.value}</p>
              {stat.up
                ? <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp size={9} className="text-bullish" /> Live from your data</p>
                : <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><TrendingDown size={9} className="text-bearish" /> Add companies below</p>
              }
            </motion.div>
          ))}
        </div>

        {/* Deal Pipeline */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Deal Pipeline</h3>
            <Button size="sm" variant="outline" onClick={() => setDealModal({ open: true })}>
              <Plus size={14} className="mr-1.5" /> Add Deal
            </Button>
          </div>
          {dealsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading...</div>
          ) : deals.length === 0 ? (
            <EmptyState label="No deals in your pipeline yet." onAdd={() => setDealModal({ open: true })} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE_STAGES.map(stage => {
                const stageDeal = deals.filter(d => d.stage === stage);
                return (
                  <div key={stage} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">{stage}</p>
                      <Badge variant="outline" className="font-mono text-xs border-border text-muted-foreground">{stageDeal.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {stageDeal.length === 0 && (
                        <p className="text-xs text-muted-foreground/50 italic">No deals</p>
                      )}
                      {stageDeal.map(deal => (
                        <div key={deal.id} className="group rounded-lg border border-border/60 bg-background p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <Circle size={7} className={`shrink-0 fill-current ${STAGE_COLOR[stage]}`} />
                              <p className="font-mono text-xs font-bold text-foreground leading-tight truncate">{deal.company}</p>
                            </div>
                            <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                              <button onClick={() => setDealModal({ open: true, existing: deal })} className="text-muted-foreground hover:text-primary transition-colors">
                                <Pencil size={11} />
                              </button>
                              <button onClick={() => deleteDeal.mutate(deal.id)} className="text-muted-foreground hover:text-bearish transition-colors">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-accent/40 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{deal.sector}</span>
                            {deal.size_mm && <span className="font-mono text-xs font-black text-foreground">${deal.size_mm}M</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Portfolio Companies */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Portfolio Companies</h3>
            <Button size="sm" variant="outline" onClick={() => setPortfolioModal({ open: true })}>
              <Plus size={14} className="mr-1.5" /> Add Company
            </Button>
          </div>
          {portfolioQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading...</div>
          ) : portfolio.length === 0 ? (
            <EmptyState label="No portfolio companies yet." onAdd={() => setPortfolioModal({ open: true })} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      {["Company", "Sector", "Invested", "Current Value", "MOIC", "Gross IRR", "Vintage", "Status", ""].map(h => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map((co, i) => {
                      const moic = calcMoic(co.invested_mm, co.current_mm);
                      const irr  = calcIRR(co.invested_mm, co.current_mm, co.vintage_year);
                      return (
                        <tr key={co.id} className="border-b border-border/40 transition-colors hover:bg-accent/20">
                          <td className="px-4 py-3 font-mono text-sm font-black text-foreground whitespace-nowrap">{co.company}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{co.sector}</td>
                          <td className="px-4 py-3 font-mono text-sm text-foreground">${co.invested_mm.toLocaleString()}M</td>
                          <td className="px-4 py-3 font-mono text-sm text-foreground">${co.current_mm.toLocaleString()}M</td>
                          <td className={`px-4 py-3 font-mono text-sm font-black ${moicColor(moic)}`}>{moic.toFixed(2)}x</td>
                          <td className={`px-4 py-3 font-mono text-sm font-black ${irrColor(irr)}`}>{irr > 0 ? "+" : ""}{irr.toFixed(1)}%</td>
                          <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{co.vintage_year}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold ${statusBadgeClass(co.status)}`}>{co.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => setPortfolioModal({ open: true, existing: co })} className="text-muted-foreground hover:text-primary transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => deletePortfolio.mutate(co.id)} className="text-muted-foreground hover:text-bearish transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Calculators */}
        <div>
          <h3 className="mb-3 font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">IRR / MOIC Calculator</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <IrrCalculator />
            <MoicToIrr />
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">LP / GP Economics</h3>
          <LpGpEconomics />
        </div>

      </motion.div>

      {/* Modals */}
      <DealModal
        open={dealModal.open}
        existing={dealModal.existing}
        userId={userId}
        onClose={() => setDealModal({ open: false })}
      />
      <PortfolioModal
        open={portfolioModal.open}
        existing={portfolioModal.existing}
        userId={userId}
        onClose={() => setPortfolioModal({ open: false })}
      />
    </DashboardLayout>
  );
}
