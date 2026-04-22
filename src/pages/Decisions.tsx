import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPositions, sandboxSignals, sandboxPortfolio } from "@/data/sandboxData";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, TrendingUp, ArrowUpRight,
  ShieldCheck, Calculator, Rocket,
  Target, ChevronRight, Layers,
  BarChart2, Activity
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo } from "react";

// ─── Score ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
      <circle cx="30" cy="30" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-border opacity-30" />
      <circle
        cx="30" cy="30" r={r} fill="none" strokeWidth="4"
        stroke={color} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      <text
        x="30" y="30" textAnchor="middle" dominantBaseline="central"
        className="rotate-90 font-mono font-black"
        style={{ fill: color, fontSize: 13, transform: "rotate(90deg)", transformOrigin: "30px 30px" }}
      >
        {score}
      </text>
    </svg>
  );
}

// ─── Conviction label ─────────────────────────────────────────────────────────
function convictionLabel(score: number) {
  if (score >= 90) return { label: "ELITE", color: "text-bullish bg-bullish/10 border-bullish/30" };
  if (score >= 80) return { label: "STRONG", color: "text-primary bg-primary/10 border-primary/30" };
  if (score >= 70) return { label: "CONFIRMED", color: "text-watch bg-watch/10 border-watch/30" };
  return { label: "SPECULATIVE", color: "text-muted-foreground bg-accent border-border" };
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-border/40">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
      />
    </div>
  );
}

// ─── Decision Card ────────────────────────────────────────────────────────────
function DecisionCard({
  ticker, score, subtitle, pnl, type, rank, onCalc, selected,
}: {
  ticker: string;
  score: number;
  subtitle: string;
  pnl?: number;
  type: "active" | "opportunity" | "lottery";
  rank: number;
  onCalc: () => void;
  selected: boolean;
}) {
  const typeConfig = {
    active:      { color: "#3D8EFF", glow: "shadow-[0_0_24px_-4px_#3D8EFF30]", border: "border-primary/25", bg: "bg-primary/5",      icon: ShieldCheck,  ringColor: "#3D8EFF" },
    opportunity: { color: "#00E5A0", glow: "shadow-[0_0_24px_-4px_#00E5A030]", border: "border-bullish/25", bg: "bg-bullish/5",      icon: TrendingUp,   ringColor: "#00E5A0" },
    lottery:     { color: "#F59E0B", glow: "shadow-[0_0_24px_-4px_#F59E0B30]", border: "border-watch/25",   bg: "bg-watch/5",        icon: Rocket,       ringColor: "#F59E0B" },
  }[type];

  const conv = convictionLabel(score);
  const Icon = typeConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06, duration: 0.35 }}
      onClick={onCalc}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border ${typeConfig.border} ${typeConfig.bg} ${typeConfig.glow} p-5 transition-all duration-200 hover:scale-[1.015] hover:brightness-105 ${selected ? "ring-2 ring-offset-2 ring-offset-background" : ""}`}
      style={selected ? { ringColor: typeConfig.color } : undefined}
    >
      {/* Rank badge */}
      <div className="absolute right-4 top-4 font-mono text-[10px] font-bold text-muted-foreground/40">
        #{rank + 1}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-black tracking-tight text-foreground">{ticker}</span>
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest ${conv.color}`}>
              {conv.label}
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {subtitle.replace(/_/g, " ")}
          </p>
        </div>
        <ScoreRing score={score} color={typeConfig.ringColor} />
      </div>

      {/* Score bar */}
      <div className="my-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Signal Strength</span>
          <span className="font-mono text-[9px] text-muted-foreground">{score}/100</span>
        </div>
        <ScoreBar value={score} color={typeConfig.color} />
      </div>

      {/* Bottom row */}
      <div className="flex items-end justify-between">
        <div>
          {pnl !== undefined ? (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Return</p>
              <p className={`font-mono text-base font-black ${pnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
              </p>
            </div>
          ) : (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Risk Profile</p>
              <p className="font-mono text-sm font-bold uppercase text-foreground">
                {type === "lottery" ? "HIGH" : "MEDIUM"}
              </p>
            </div>
          )}
        </div>
        <Link
          to="/dashboard"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-foreground transition-all hover:border-foreground/30 hover:bg-foreground hover:text-background"
        >
          Execute <ArrowUpRight size={10} />
        </Link>
      </div>

      {/* BG glyph */}
      <div className="pointer-events-none absolute -bottom-3 -right-3 opacity-[0.04] transition-opacity duration-300 group-hover:opacity-[0.07]">
        <Icon size={88} />
      </div>
    </motion.div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, label, count, color,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-xl p-2" style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <h3 className="font-display text-base font-bold text-foreground">{label}</h3>
      </div>
      <span className="rounded-full border border-border bg-accent px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

// ─── Empty slot ───────────────────────────────────────────────────────────────
function EmptySlot({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 bg-accent/10 py-10">
      <Layers size={24} className="text-muted-foreground/20" />
      <p className="max-w-[180px] text-center font-mono text-[10px] uppercase leading-relaxed tracking-widest text-muted-foreground/50">
        {message}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Decisions() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const { data: portfolio, isLoading: portLoading } = useQuery({
    queryKey: ["portfolio", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPortfolio;
      const { data } = await supabase.from("portfolios").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const { data: settings } = useQuery({
    queryKey: ["compound-settings", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return { risk_tier: "moderate" };
      const { data } = await supabase.from("compound_settings").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const { data: positions = [], isLoading: posLoading } = useQuery({
    queryKey: ["positions", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPositions;
      const { data } = await supabase.from("positions").select("*").eq("user_id", user!.id).eq("status", "open");
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  const { data: signals = [], isLoading: sigLoading } = useQuery({
    queryKey: ["signals", isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxSignals;
      const { data } = await supabase.from("signals").select("*").order("signal_score", { ascending: false });
      return data ?? [];
    },
  });

  const isLoading = posLoading || sigLoading || portLoading;

  const existingTickers = new Set(positions.map((p) => p.ticker));
  const recommendedPositions = positions.filter((p) => (p.signal_score || 0) >= 75);
  const newOpportunities = signals.filter((s) => !existingTickers.has(s.ticker) && (s.signal_score || 0) >= 80);
  const lotteryPlays = signals.filter((s) => !existingTickers.has(s.ticker) && (s.signal_score || 0) >= 60 && (s.signal_score || 0) < 80);

  const calcResult = useMemo(() => {
    if (!selectedTicker) return null;
    const item =
      signals.find((s) => s.ticker === selectedTicker) ||
      positions.find((p) => p.ticker === selectedTicker);
    if (!item) return null;

    const score = item.signal_score || 50;
    const capital = portfolio?.available_capital || 0;
    const riskTier = settings?.risk_tier || "moderate";
    const basePct = riskTier === "aggressive" ? 0.05 : riskTier === "moderate" ? 0.03 : 0.015;
    const recommendedPct = basePct * (score / 100);
    const amount = Math.round(capital * recommendedPct);

    return {
      ticker: selectedTicker,
      amount,
      pct: (recommendedPct * 100).toFixed(2),
      score,
      riskTier,
      available: capital,
      remaining: capital - amount,
    };
  }, [selectedTicker, signals, positions, portfolio, settings]);

  const totalSignals = newOpportunities.length + lotteryPlays.length;

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-20">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Capital Intelligence</span>
              <span className="h-px flex-1 bg-border/50 md:hidden" />
            </div>
            <h2 className="font-display text-3xl font-black tracking-tight text-foreground">Decision Hub</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked opportunities and active positions filtered for execution.
            </p>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Available", value: `$${(portfolio?.available_capital || 0).toLocaleString()}`, icon: BarChart2, color: "text-primary" },
              { label: "Active Pos.", value: String(positions.length), icon: Activity, color: "text-bullish" },
              { label: "New Signals", value: String(totalSignals), icon: Zap, color: "text-watch" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5">
                <stat.icon size={13} className={stat.color} />
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                  <p className={`font-mono text-sm font-black ${stat.color}`}>{isLoading ? "—" : stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sizing calculator panel ── */}
        <AnimatePresence>
          {calcResult && (
            <motion.div
              key="calc"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="relative rounded-2xl border border-primary/30 bg-primary/5 p-5">
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                  {/* Label */}
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/15 p-2.5">
                      <Calculator size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Position Sizing</p>
                      <p className="font-display text-lg font-black text-foreground">{calcResult.ticker}</p>
                    </div>
                  </div>

                  <div className="h-px bg-border/50 md:h-10 md:w-px md:bg-border/50" />

                  {/* Stats */}
                  <div className="flex flex-1 flex-wrap gap-6">
                    {[
                      { label: "Recommended Allocation", value: `$${calcResult.amount.toLocaleString()}`, sub: `${calcResult.pct}% of capital` },
                      { label: "Signal Score", value: `${calcResult.score}/100`, sub: convictionLabel(calcResult.score).label },
                      { label: "Risk Profile", value: calcResult.riskTier.toUpperCase(), sub: "compound setting" },
                      { label: "Remaining Capital", value: `$${calcResult.remaining.toLocaleString()}`, sub: "post-allocation" },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{item.label}</p>
                        <p className="font-mono text-base font-black text-foreground">{item.value}</p>
                        <p className="font-mono text-[9px] uppercase text-muted-foreground/60">{item.sub}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setSelectedTicker(null)}
                    className="self-start font-mono text-xs text-muted-foreground hover:text-foreground md:self-auto"
                  >
                    ✕
                  </button>
                </div>

                {/* Capital deployment bar */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Capital Deployment</span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      ${calcResult.amount.toLocaleString()} / ${calcResult.available.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(calcResult.amount / calcResult.available) * 100}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="h-full rounded-full bg-primary"
                      style={{ boxShadow: "0 0 8px #3D8EFF60" }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Section 1: Portfolio Health ── */}
        <section className="space-y-4">
          <SectionHeader icon={ShieldCheck} label="Portfolio Health — Active" count={recommendedPositions.length} color="#3D8EFF" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-accent/30" />
                ))
              : recommendedPositions.length > 0
              ? recommendedPositions.map((p, i) => (
                  <DecisionCard
                    key={p.id}
                    ticker={p.ticker}
                    score={p.signal_score || 0}
                    subtitle={p.strategy_type || "Position"}
                    pnl={p.pnl_percent || 0}
                    type="active"
                    rank={i}
                    onCalc={() => setSelectedTicker(selectedTicker === p.ticker ? null : p.ticker)}
                    selected={selectedTicker === p.ticker}
                  />
                ))
              : <EmptySlot message="No active positions at conviction threshold" />}
          </div>
        </section>

        {/* ── Divider ── */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">New Opportunities</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
        </div>

        {/* ── Section 2: High Probability ── */}
        <section className="space-y-4">
          <SectionHeader icon={TrendingUp} label="High-Probability Growth" count={newOpportunities.length} color="#00E5A0" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-accent/30" />
                ))
              : newOpportunities.length > 0
              ? newOpportunities.map((s, i) => (
                  <DecisionCard
                    key={s.id}
                    ticker={s.ticker}
                    score={s.signal_score || 0}
                    subtitle={s.action || "New Signal"}
                    type="opportunity"
                    rank={i}
                    onCalc={() => setSelectedTicker(selectedTicker === s.ticker ? null : s.ticker)}
                    selected={selectedTicker === s.ticker}
                  />
                ))
              : <EmptySlot message="Scan signals for new high-conviction setups" />}
          </div>
        </section>

        {/* ── Section 3: Asymmetric Plays ── */}
        <section className="space-y-4">
          <SectionHeader icon={Rocket} label="Asymmetric Payoffs — Lottery" count={lotteryPlays.length} color="#F59E0B" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-accent/30" />
                ))
              : lotteryPlays.length > 0
              ? lotteryPlays.map((s, i) => (
                  <DecisionCard
                    key={s.id}
                    ticker={s.ticker}
                    score={s.signal_score || 0}
                    subtitle="High Volatility Setup"
                    type="lottery"
                    rank={i}
                    onCalc={() => setSelectedTicker(selectedTicker === s.ticker ? null : s.ticker)}
                    selected={selectedTicker === s.ticker}
                  />
                ))
              : <EmptySlot message="No asymmetric setups detected currently" />}
          </div>
        </section>

        {/* ── Footer hint ── */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <Target size={11} className="text-muted-foreground/40" />
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
            Click any card to calculate position sizing
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
