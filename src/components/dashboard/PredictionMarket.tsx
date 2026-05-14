import { useState } from "react";
import { motion } from "framer-motion";
import { Dices, TrendingUp, TrendingDown, Minus, RefreshCw, Zap } from "lucide-react";

// ─── Static prediction market data (mock — swap for Polymarket/Kalshi API) ────
const PREDICTIONS = [
  {
    id: "spy-green",
    question: "SPY closes green this week?",
    yes: 64,
    category: "Equity",
    color: "bullish",
  },
  {
    id: "fed-hold",
    question: "Fed holds rates at next meeting?",
    yes: 81,
    category: "Macro",
    color: "neutral",
  },
  {
    id: "btc-60k",
    question: "BTC stays above $60K this month?",
    yes: 55,
    category: "Crypto",
    color: "watch",
  },
  {
    id: "recession",
    question: "US recession declared in 2026?",
    yes: 28,
    category: "Macro",
    color: "bearish",
  },
  {
    id: "qqq-ath",
    question: "QQQ hits new ATH before July?",
    yes: 47,
    category: "Equity",
    color: "neutral",
  },
];

// ─── Key numbers — major levels to watch ─────────────────────────────────────
const KEY_NUMBERS = [
  { label: "SPY Support", value: "518.40", type: "support" },
  { label: "SPY Resistance", value: "532.00", type: "resistance" },
  { label: "QQQ Pivot", value: "441.50", type: "pivot" },
  { label: "VIX Watch", value: "18.00", type: "watch" },
  { label: "BTC Flip", value: "63,500", type: "pivot" },
  { label: "10Y Yield", value: "4.42%", type: "watch" },
];

const colorMap = {
  bullish: { bar: "bg-bullish", text: "text-bullish", badge: "bg-bullish/10 text-bullish border-bullish/20" },
  bearish: { bar: "bg-bearish", text: "text-bearish", badge: "bg-bearish/10 text-bearish border-bearish/20" },
  watch:   { bar: "bg-watch",   text: "text-watch",   badge: "bg-watch/10 text-watch border-watch/20"   },
  neutral: { bar: "bg-neutral", text: "text-neutral", badge: "bg-neutral/10 text-neutral border-neutral/20" },
};

const typeStyle = {
  support:    "text-bullish",
  resistance: "text-bearish",
  pivot:      "text-watch",
  watch:      "text-neutral",
};

export default function PredictionMarket() {
  const [tab, setTab] = useState<"predictions" | "numbers">("predictions");

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Dices className="h-4 w-4 text-watch" />
          <span className="text-sm font-semibold text-foreground">Prediction Market</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
          <button
            onClick={() => setTab("predictions")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-fast ${
              tab === "predictions" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Odds
          </button>
          <button
            onClick={() => setTab("numbers")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-fast ${
              tab === "numbers" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Key Numbers
          </button>
        </div>
      </div>

      {/* Predictions tab */}
      {tab === "predictions" && (
        <div className="flex-1 divide-y divide-border/40">
          {PREDICTIONS.map((p, i) => {
            const c = colorMap[p.color as keyof typeof colorMap];
            const no = 100 - p.yes;
            const icon = p.yes >= 60
              ? <TrendingUp className="h-3 w-3 text-bullish" />
              : p.yes <= 35
              ? <TrendingDown className="h-3 w-3 text-bearish" />
              : <Minus className="h-3 w-3 text-muted-foreground" />;

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="px-4 py-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {icon}
                    <p className="text-xs text-foreground leading-snug">{p.question}</p>
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${c.badge}`}>
                    {p.category}
                  </span>
                </div>
                {/* Probability bar */}
                <div className="space-y-1">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.yes}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 + 0.1, ease: "easeOut" }}
                      className={`h-full rounded-full ${c.bar}`}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-[10px] font-bold ${c.text}`}>YES {p.yes}%</span>
                    <span className="text-[10px] text-muted-foreground">NO {no}%</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div className="px-4 py-2 flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/50">Sample data · Connect Polymarket/Kalshi API for live odds</span>
          </div>
        </div>
      )}

      {/* Key Numbers tab */}
      {tab === "numbers" && (
        <div className="flex-1 p-4 space-y-2">
          <div className="flex items-center gap-1.5 mb-3">
            <Zap className="h-3.5 w-3.5 text-watch" />
            <span className="text-xs text-muted-foreground">Levels that matter today — mark these on your chart</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {KEY_NUMBERS.map((n, i) => (
              <motion.div
                key={n.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-lg border border-border bg-background px-3 py-2.5 space-y-0.5"
              >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{n.label}</p>
                <p className={`text-base font-bold font-mono ${typeStyle[n.type as keyof typeof typeStyle]}`}>
                  {n.value}
                </p>
              </motion.div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/50 pt-1">
            <span className="text-bullish">■</span> Support &nbsp;
            <span className="text-bearish">■</span> Resistance &nbsp;
            <span className="text-watch">■</span> Pivot &nbsp;
            <span className="text-neutral">■</span> Watch
          </p>
        </div>
      )}
    </div>
  );
}
