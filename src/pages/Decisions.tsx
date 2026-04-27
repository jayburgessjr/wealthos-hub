import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPositions, sandboxSignals, sandboxPortfolio } from "@/data/sandboxData";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, Zap, TrendingDown, TrendingUp, MinusCircle, AlertOctagon } from "lucide-react";

type Directive = {
  ticker: string;
  command: string;
  tag: string;
  urgency: "critical" | "high" | "medium";
};

function getDirectives(positions: any[], signals: any[], portfolio: any) {
  const existingTickers = new Set(positions.map((p) => p.ticker));
  const dos: Directive[] = [];
  const donts: Directive[] = [];
  const watches: Directive[] = [];

  // ── Active positions ──────────────────────────────────────────────────────
  for (const p of positions) {
    const score = p.signal_score || 0;
    const pnl = p.pnl_percent || 0;

    if (pnl > 50 && score >= 80) {
      dos.push({ ticker: p.ticker, command: "TAKE PARTIAL PROFITS", tag: "UP BIG", urgency: "high" });
    } else if (pnl > 20 && score >= 75) {
      dos.push({ ticker: p.ticker, command: "HOLD & TRAIL STOP", tag: "WINNING", urgency: "medium" });
    } else if (pnl >= 0 && score >= 70) {
      dos.push({ ticker: p.ticker, command: "HOLD POSITION", tag: "ON TRACK", urgency: "medium" });
    } else if (pnl < -10) {
      donts.push({ ticker: p.ticker, command: "EXIT NOW — CUT LOSS", tag: "STOP HIT", urgency: "critical" });
    } else if (pnl < -5) {
      donts.push({ ticker: p.ticker, command: "REDUCE POSITION", tag: "LOSING", urgency: "high" });
    } else if (pnl < 0 && score < 50) {
      donts.push({ ticker: p.ticker, command: "DO NOT ADD TO THIS", tag: "WEAK SIGNAL", urgency: "high" });
    } else if (score < 40) {
      donts.push({ ticker: p.ticker, command: "EXIT — SIGNAL GONE", tag: "NO EDGE", urgency: "high" });
    }
  }

  // ── New signals ───────────────────────────────────────────────────────────
  for (const s of signals) {
    if (existingTickers.has(s.ticker)) continue;
    const score = s.signal_score || 0;

    if (score >= 90) {
      dos.push({ ticker: s.ticker, command: "BUY NOW — HIGH PRIORITY", tag: "ELITE SETUP", urgency: "critical" });
    } else if (score >= 80) {
      dos.push({ ticker: s.ticker, command: "BUY THIS", tag: "STRONG SIGNAL", urgency: "high" });
    } else if (score >= 70) {
      watches.push({ ticker: s.ticker, command: "WATCH — WAIT FOR ENTRY", tag: "SETTING UP", urgency: "medium" });
    } else if (score < 50) {
      donts.push({ ticker: s.ticker, command: "DO NOT BUY", tag: "LOW CONVICTION", urgency: "medium" });
    }
  }

  // ── Portfolio-level directives ────────────────────────────────────────────
  if (portfolio) {
    const deployedPct = portfolio.deployed_capital / portfolio.total_capital;
    const availablePct = portfolio.available_capital / portfolio.total_capital;

    if (availablePct > 0.5) {
      dos.push({ ticker: "CASH", command: "DEPLOY MORE CAPITAL", tag: "UNDERINVESTED", urgency: "high" });
    } else if (deployedPct > 0.9) {
      donts.push({ ticker: "PORTFOLIO", command: "DO NOT OPEN NEW POSITIONS", tag: "FULLY DEPLOYED", urgency: "high" });
    }

    if (portfolio.win_rate < 50) {
      donts.push({ ticker: "STRATEGY", command: "STOP TRADING — REVIEW SYSTEM", tag: "WIN RATE < 50%", urgency: "critical" });
    }
  }

  // Sort: critical first
  const urgencyOrder = { critical: 0, high: 1, medium: 2 };
  dos.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
  donts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return { dos, donts, watches };
}

const urgencyStyle = {
  critical: "border-bearish/40 bg-bearish/8",
  high:     "border-border bg-card",
  medium:   "border-border/50 bg-card/60",
};

const urgencyBadge = {
  critical: "bg-bearish/15 text-bearish border-bearish/30",
  high:     "bg-primary/10 text-primary border-primary/20",
  medium:   "bg-accent text-muted-foreground border-border",
};

function DirectiveRow({ item, side, index }: { item: Directive; side: "do" | "dont" | "watch"; index: number }) {
  const isX = side === "dont";
  const isW = side === "watch";
  const tickerColor = isX ? "text-bearish" : isW ? "text-watch" : "text-bullish";
  const cmdColor = isX ? "text-foreground" : isW ? "text-watch" : "text-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.28 }}
      className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 ${urgencyStyle[item.urgency]}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        {/* Ticker */}
        <span className={`font-display text-2xl font-black tracking-tight shrink-0 ${tickerColor}`}>
          {item.ticker}
        </span>
        {/* Command */}
        <span className={`font-mono text-sm font-bold uppercase tracking-wide ${cmdColor}`}>
          {item.command}
        </span>
      </div>
      {/* Tag */}
      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest ${urgencyBadge[item.urgency]}`}>
        {item.tag}
      </span>
    </motion.div>
  );
}

function SectionHeader({ icon: Icon, label, color, count }: { icon: React.ElementType; label: string; color: string; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-5 w-5 ${color}`} />
      <h2 className={`font-display text-xl font-black uppercase tracking-tight ${color}`}>{label}</h2>
      <span className="ml-auto font-mono text-xs text-muted-foreground">{count} directive{count !== 1 ? "s" : ""}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 px-5 py-6">
      <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground/30" />
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/40">{message}</p>
    </div>
  );
}

export default function Decisions() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const { data: portfolio, isLoading: portLoading } = useQuery({
    queryKey: ["portfolio", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPortfolio;
      const { data } = await supabase.from("portfolios").select("*").eq("user_id", user!.id).single();
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
  const { dos, donts, watches } = getDirectives(positions, signals, portfolio);

  // Top critical directive
  const topCritical = dos.find((d) => d.urgency === "critical") || donts.find((d) => d.urgency === "critical");

  return (
    <DashboardLayout>
      <div className="space-y-10 pb-20">

        {/* ── Header ── */}
        <div className="text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bullish opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bullish" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Live Decision Feed
            </span>
          </div>
          <h1 className="font-display text-4xl font-black uppercase tracking-tight text-foreground sm:text-5xl">
            This Is What You Need To Do
          </h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
            No context. No explanation. Execute.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : (
          <div className="space-y-10">

            {/* ── Critical Alert Banner ── */}
            {topCritical && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-4 rounded-xl border border-bearish/40 bg-bearish/8 px-6 py-5"
              >
                <AlertOctagon className="h-6 w-6 shrink-0 text-bearish animate-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-bearish/70 mb-0.5">
                    Most Urgent Right Now
                  </p>
                  <p className="font-display text-lg font-black uppercase text-foreground">
                    <span className="text-bearish">{topCritical.ticker}</span> — {topCritical.command}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-bearish/30 bg-bearish/15 px-3 py-1 font-mono text-[9px] font-black uppercase tracking-widest text-bearish">
                  {topCritical.tag}
                </span>
              </motion.div>
            )}

            {/* ── Three columns ── */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

              {/* DO THIS */}
              <div className="space-y-3">
                <SectionHeader icon={CheckCircle2} label="Do This" color="text-bullish" count={dos.length} />
                <div className="h-px bg-bullish/20" />
                <div className="space-y-2.5 pt-1">
                  {dos.length === 0
                    ? <EmptyState message="No actions required" />
                    : dos.map((item, i) => <DirectiveRow key={item.ticker + i} item={item} side="do" index={i} />)
                  }
                </div>
              </div>

              {/* DO NOT DO THIS */}
              <div className="space-y-3">
                <SectionHeader icon={XCircle} label="Do Not Do This" color="text-bearish" count={donts.length} />
                <div className="h-px bg-bearish/20" />
                <div className="space-y-2.5 pt-1">
                  {donts.length === 0
                    ? <EmptyState message="No positions to exit" />
                    : donts.map((item, i) => <DirectiveRow key={item.ticker + i} item={item} side="dont" index={i} />)
                  }
                </div>
              </div>

              {/* WATCH */}
              <div className="space-y-3">
                <SectionHeader icon={Clock} label="Watch Closely" color="text-watch" count={watches.length} />
                <div className="h-px bg-watch/20" />
                <div className="space-y-2.5 pt-1">
                  {watches.length === 0
                    ? <EmptyState message="Nothing on deck" />
                    : watches.map((item, i) => <DirectiveRow key={item.ticker + i} item={item} side="watch" index={i} />)
                  }
                </div>
              </div>

            </div>

            {/* ── Summary bar ── */}
            <div className="flex flex-wrap items-center justify-center gap-6 rounded-xl border border-border/50 bg-card/60 px-8 py-4">
              {[
                { icon: TrendingUp, label: "Execute", value: dos.length, color: "text-bullish" },
                { icon: TrendingDown, label: "Exit / Avoid", value: donts.length, color: "text-bearish" },
                { icon: Clock, label: "Monitor", value: watches.length, color: "text-watch" },
                { icon: Zap, label: "Critical", value: [...dos, ...donts].filter(d => d.urgency === "critical").length, color: "text-primary" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2.5">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{s.label}</span>
                  <span className={`font-mono text-sm font-black ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
