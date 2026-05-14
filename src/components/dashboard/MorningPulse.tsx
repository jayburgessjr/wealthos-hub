import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxSignals, sandboxMacro, sandboxPositions } from "@/data/sandboxData";
import { motion } from "framer-motion";
import { Zap, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

const DEMO_PULSE = {
  regime: "RISK-ON",
  regimeColor: "text-bullish",
  topSignal: { ticker: "MSFT", action: "BUY NOW", score: 94 },
  doThis: "Add to MSFT position — AI revenue cycle accelerating",
  avoidThis: "Do not chase TSLA — momentum fading, signal below 70",
  vix: 13.2,
  date: format(new Date(), "EEEE, MMM d"),
};

export default function MorningPulse() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const { data: topSignal } = useQuery({
    queryKey: ["signals", "top1", isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxSignals[1]; // MSFT
      const { data } = await supabase
        .from("signals")
        .select("*")
        .order("signal_score", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: worstSignal } = useQuery({
    queryKey: ["signals", "worst1", isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxSignals[2]; // META lowest
      const { data } = await supabase
        .from("signals")
        .select("*")
        .order("signal_score", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const pulse = isDemoMode ? DEMO_PULSE : {
    regime: "RISK-ON",
    regimeColor: "text-bullish",
    topSignal: topSignal ? { ticker: topSignal.ticker, action: topSignal.action?.replace("_", " ").toUpperCase(), score: topSignal.signal_score } : null,
    doThis: topSignal ? `${topSignal.ticker} — highest conviction signal at ${topSignal.signal_score}/100` : "Run signal scan to get your first directive",
    avoidThis: worstSignal ? `${worstSignal.ticker} — weak signal at ${worstSignal.signal_score}/100` : "No avoids flagged",
    vix: 13.2,
    date: format(new Date(), "EEEE, MMM d"),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bullish opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-bullish" />
          </span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Morning Pulse — {pulse.date}
          </span>
        </div>
        <Link to="/weekly-briefing" className="text-xs uppercase tracking-widest text-primary hover:underline">
          Weekly Briefing →
        </Link>
      </div>

      {/* 4-panel grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Regime */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-card/60 px-3 py-2.5">
          <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Regime</p>
            <p className={`font-mono text-sm font-black ${pulse.regimeColor}`}>{pulse.regime}</p>
          </div>
        </div>

        {/* Top signal */}
        <div className="flex items-start gap-2.5 rounded-lg border border-bullish/20 bg-bullish/5 px-3 py-2.5">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bullish" />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Top Signal</p>
            <p className="font-mono text-sm font-black text-bullish">{pulse.topSignal?.ticker ?? "—"}</p>
            <p className="text-xs text-bullish/70">{pulse.topSignal?.score}/100</p>
          </div>
        </div>

        {/* Do this */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-card/60 px-3 py-2.5 sm:col-span-1">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bullish" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Do This</p>
            <p className="text-[11px] font-semibold text-foreground leading-snug line-clamp-2">{pulse.doThis}</p>
          </div>
        </div>

        {/* Avoid this */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-card/60 px-3 py-2.5 sm:col-span-1">
          <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bearish" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Avoid</p>
            <p className="text-[11px] font-semibold text-foreground leading-snug line-clamp-2">{pulse.avoidThis}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
