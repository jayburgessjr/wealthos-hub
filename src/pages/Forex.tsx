import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, AlertCircle, Filter, ChevronRight, Minus } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

// ── Strategy Brief ─────────────────────────────────────────────────────────────
function StrategyBrief() {
  return (
    <div className="rounded-xl border border-watch/40 bg-card px-4 py-3 space-y-3" style={{ borderLeftWidth: "4px", borderLeftColor: "hsl(var(--watch))" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-watch/40 bg-watch/10 px-3 py-1">
            <Minus size={12} className="text-watch" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-watch">NEUTRAL</span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug max-w-xl">
            USD showing strength vs majors. Watch EUR/USD for break below 1.0800 support. London session open is the highest-probability entry window.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/position-sizer" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            Position Sizer <ChevronRight size={11} />
          </Link>
          <Link to="/alerts" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            Set Alert <ChevronRight size={11} />
          </Link>
          <Link to="/decisions" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            Decision Hub <ChevronRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Market Sessions ────────────────────────────────────────────────────────────
const SESSIONS = [
  { name: "Tokyo",    open: false },
  { name: "London",  open: true  },
  { name: "New York", open: true  },
];

// ── Top Setup ─────────────────────────────────────────────────────────────────
const TOP_SETUP = {
  pair: "EUR/USD",
  direction: "SHORT",
  entry: "1.0842",
  stop: "1.0890",
  target: "1.0750",
  rr: "2.1:1",
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface ForexPair {
  pair: string;
  base: string;
  quote: string;
  rate: number;
  bid: number;
  ask: number;
  spread: number;
  changePct: number;
  change: number;
  category: "major" | "minor" | "exotic";
  baseFlag: string;
  baseName: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const FOREX_PAIRS: ForexPair[] = [
  { pair: "EUR/USD", base: "EUR", quote: "USD", rate: 1.0842, bid: 1.0841, ask: 1.0843, spread: 0.0002, changePct: 0.14, change: 0.0015, category: "major", baseFlag: "🇪🇺", baseName: "Euro" },
  { pair: "GBP/USD", base: "GBP", quote: "USD", rate: 1.2673, bid: 1.2672, ask: 1.2675, spread: 0.0003, changePct: -0.22, change: -0.0028, category: "major", baseFlag: "🇬🇧", baseName: "British Pound" },
  { pair: "USD/JPY", base: "USD", quote: "JPY", rate: 155.84, bid: 155.82, ask: 155.86, spread: 0.04, changePct: 0.31, change: 0.48, category: "major", baseFlag: "🇺🇸", baseName: "US Dollar" },
  { pair: "AUD/USD", base: "AUD", quote: "USD", rate: 0.6441, bid: 0.6440, ask: 0.6443, spread: 0.0003, changePct: -0.08, change: -0.0005, category: "major", baseFlag: "🇦🇺", baseName: "Australian Dollar" },
  { pair: "USD/CAD", base: "USD", quote: "CAD", rate: 1.3632, bid: 1.3630, ask: 1.3634, spread: 0.0004, changePct: 0.05, change: 0.0007, category: "major", baseFlag: "🇺🇸", baseName: "US Dollar" },
  { pair: "USD/CHF", base: "USD", quote: "CHF", rate: 0.9058, bid: 0.9056, ask: 0.9060, spread: 0.0004, changePct: -0.11, change: -0.001, category: "major", baseFlag: "🇺🇸", baseName: "US Dollar" },
  { pair: "NZD/USD", base: "NZD", quote: "USD", rate: 0.5921, bid: 0.5919, ask: 0.5923, spread: 0.0004, changePct: 0.07, change: 0.0004, category: "major", baseFlag: "🇳🇿", baseName: "New Zealand Dollar" },
  { pair: "USD/MXN", base: "USD", quote: "MXN", rate: 17.1540, bid: 17.1510, ask: 17.1570, spread: 0.006, changePct: -0.43, change: -0.074, category: "major", baseFlag: "🇺🇸", baseName: "US Dollar" },
  { pair: "EUR/GBP", base: "EUR", quote: "GBP", rate: 0.8556, bid: 0.8554, ask: 0.8558, spread: 0.0004, changePct: 0.36, change: 0.003, category: "minor", baseFlag: "🇪🇺", baseName: "Euro" },
  { pair: "EUR/JPY", base: "EUR", quote: "JPY", rate: 168.97, bid: 168.94, ask: 169.00, spread: 0.06, changePct: 0.45, change: 0.76, category: "minor", baseFlag: "🇪🇺", baseName: "Euro" },
  { pair: "GBP/JPY", base: "GBP", quote: "JPY", rate: 197.42, bid: 197.38, ask: 197.46, spread: 0.08, changePct: 0.09, change: 0.18, category: "minor", baseFlag: "🇬🇧", baseName: "British Pound" },
  { pair: "AUD/JPY", base: "AUD", quote: "JPY", rate: 100.38, bid: 100.35, ask: 100.41, spread: 0.06, changePct: 0.23, change: 0.23, category: "minor", baseFlag: "🇦🇺", baseName: "Australian Dollar" },
  { pair: "USD/BRL", base: "USD", quote: "BRL", rate: 5.0810, bid: 5.0790, ask: 5.0830, spread: 0.004, changePct: 0.62, change: 0.031, category: "exotic", baseFlag: "🇺🇸", baseName: "US Dollar" },
  { pair: "USD/INR", base: "USD", quote: "INR", rate: 83.49, bid: 83.47, ask: 83.51, spread: 0.04, changePct: 0.03, change: 0.025, category: "exotic", baseFlag: "🇺🇸", baseName: "US Dollar" },
  { pair: "USD/SGD", base: "USD", quote: "SGD", rate: 1.3421, bid: 1.3419, ask: 1.3423, spread: 0.0004, changePct: -0.07, change: -0.001, category: "exotic", baseFlag: "🇺🇸", baseName: "US Dollar" },
];

const FILTER_TABS = ["all", "major", "minor", "exotic"] as const;
type FilterTab = typeof FILTER_TABS[number];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 4) {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function Forex() {
  const [filter, setFilter] = useState<FilterTab>("all");

  const displayed = filter === "all" ? FOREX_PAIRS : FOREX_PAIRS.filter(p => p.category === filter);
  const rising = FOREX_PAIRS.filter(p => p.changePct > 0).length;
  const falling = FOREX_PAIRS.filter(p => p.changePct < 0).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Activity size={12} className="text-muted-foreground" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Global Forex</span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">Forex</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Currency pair rates, spreads, and directional momentum
          </p>
        </div>

        {/* Strategy Brief */}
        <StrategyBrief />

        {/* Market Sessions */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Market Sessions</span>
          {SESSIONS.map(s => (
            <div key={s.name} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${s.open ? "bg-bullish" : "bg-muted-foreground/40"}`} />
              <span className={`font-mono text-xs font-bold ${s.open ? "text-bullish" : "text-muted-foreground"}`}>{s.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{s.open ? "OPEN" : "CLOSED"}</span>
            </div>
          ))}
        </div>

        {/* Top Setup Card */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-xs font-black uppercase tracking-wider text-primary">Top Setup</span>
            <span className="rounded-full bg-bearish/10 px-2 py-0.5 font-mono text-xs font-bold text-bearish">{TOP_SETUP.direction}</span>
            <span className="font-mono text-xs font-bold text-foreground">{TOP_SETUP.pair}</span>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { label: "Entry",  value: TOP_SETUP.entry  },
              { label: "Stop",   value: TOP_SETUP.stop   },
              { label: "Target", value: TOP_SETUP.target },
              { label: "R:R",    value: TOP_SETUP.rr     },
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-mono text-sm font-black text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* API Notice */}
        <div className="flex items-center gap-3 rounded-xl border border-watch/30 bg-watch/5 px-4 py-3 text-sm text-watch">
          <AlertCircle size={14} className="shrink-0" />
          <span>Connect <span className="font-mono font-bold">POLYGON_KEY</span> for live rates — displaying mock data</span>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Pairs Tracked", value: String(FOREX_PAIRS.length), color: "text-foreground" },
            { label: "Rising",        value: String(rising),              color: "text-bullish" },
            { label: "Falling",       value: String(falling),             color: "text-bearish" },
            { label: "Base Currency", value: "USD",                       color: "text-primary" },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <p className={`font-mono text-xl font-black ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-muted-foreground" />
          <div className="flex gap-1">
            {FILTER_TABS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Pairs table */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {["Pair", "Flags", "Rate", "Bid", "Ask", "Spread (pips)", "24h Change", "Direction", "Type"].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((p, i) => {
                const pos = p.changePct >= 0;
                return (
                  <motion.tr key={p.pair}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/40 transition-colors hover:bg-accent/20">
                    <td className="px-4 py-3 font-mono text-sm font-black text-foreground">{p.pair}</td>
                    <td className="px-4 py-3 text-base">{p.baseFlag}</td>
                    <td className="px-4 py-3 font-mono text-sm text-foreground">{fmt(p.rate)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fmt(p.bid)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fmt(p.ask)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral">
                      {(p.spread * (p.quote === "JPY" ? 100 : 10000)).toFixed(1)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 font-mono text-sm font-bold ${pos ? "text-bullish" : "text-bearish"}`}>
                        {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {pos ? "+" : ""}{p.changePct.toFixed(3)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-lg">
                      {pos ? "↑" : "↓"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold uppercase ${
                        p.category === "major" ? "bg-primary/10 text-primary"
                        : p.category === "minor" ? "bg-watch/10 text-watch"
                        : "bg-neutral/10 text-neutral"
                      }`}>{p.category}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </DashboardLayout>
  );
}
