import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Target, AlertCircle, TrendingUp, TrendingDown, Calendar, ChevronRight, Minus } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

// ── Strategy Brief ─────────────────────────────────────────────────────────────
function StrategyBrief() {
  return (
    <div className="rounded-xl border border-watch/40 bg-card px-4 py-3 space-y-3" style={{ borderLeftWidth: "4px", borderLeftColor: "hsl(var(--watch))" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-watch/40 bg-watch/10 px-3 py-1">
            <Minus size={12} className="text-watch" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-watch">ECONOMIC UNCERTAINTY</span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug max-w-xl">
            Fed Hold at 81% implies rate-sensitive sectors (XLU, TLT) are underpriced for a rally. Use high-probability contracts to hedge portfolio tail risk.
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

// ── How to Trade This ─────────────────────────────────────────────────────────
const HOW_TO_TRADE = [
  {
    title: "Hedge with Contracts",
    desc: "Buy NO on recession to offset long equity exposure",
    tag: "RISK MANAGEMENT",
  },
  {
    title: "Sector Rotation Signal",
    desc: "81% Fed hold = utilities/bonds favorable (XLU, TLT)",
    tag: "SECTOR",
  },
  {
    title: "Position Sizing",
    desc: "Treat contract cost as insurance premium — max 1% of portfolio",
    tag: "SIZING",
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface KalshiMarket {
  id: string;
  question: string;
  category: "economic" | "political" | "climate";
  yesPct: number;
  noPct: number;
  volume: number;
  expiry: string;
  trending: "up" | "down" | "flat";
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const KALSHI_MARKETS: KalshiMarket[] = [
  // Economic
  { id: "FED-JUN-25",   question: "Will the Fed cut rates at the June 2025 meeting?",          category: "economic",  yesPct: 28, noPct: 72, volume: 1_840_000, expiry: "Jun 18, 2025", trending: "down" },
  { id: "FED-JUL-25",   question: "Will the Fed cut rates at the July 2025 meeting?",          category: "economic",  yesPct: 41, noPct: 59, volume: 2_120_000, expiry: "Jul 30, 2025", trending: "up"   },
  { id: "CPI-APR-25",   question: "Will US CPI YoY be above 3% for April 2025?",               category: "economic",  yesPct: 55, noPct: 45, volume:   980_000, expiry: "May 14, 2025", trending: "up"   },
  { id: "GDP-Q2-25",    question: "Will US Q2 2025 GDP growth exceed 2%?",                     category: "economic",  yesPct: 62, noPct: 38, volume: 1_430_000, expiry: "Jul 30, 2025", trending: "flat" },
  { id: "RECESS-2025",  question: "Will the US enter a recession by end of 2025?",              category: "economic",  yesPct: 34, noPct: 66, volume: 3_210_000, expiry: "Dec 31, 2025", trending: "up"   },
  { id: "UNEMP-5PCT",   question: "Will US unemployment exceed 5% in 2025?",                   category: "economic",  yesPct: 22, noPct: 78, volume:   760_000, expiry: "Dec 31, 2025", trending: "down" },
  // Political
  { id: "TRUMP-EXEC",   question: "Will Trump sign more than 50 executive orders in 2025?",    category: "political", yesPct: 81, noPct: 19, volume: 2_900_000, expiry: "Dec 31, 2025", trending: "up"   },
  { id: "SENATE-FLIP",  question: "Will the Senate flip to Democratic control in 2026?",       category: "political", yesPct: 38, noPct: 62, volume: 1_100_000, expiry: "Nov 4, 2026",  trending: "flat" },
  { id: "TRUMP-IMPEACH","question": "Will Trump face impeachment proceedings in 2025?",         category: "political", yesPct: 8,  noPct: 92, volume:   450_000, expiry: "Dec 31, 2025", trending: "down" },
  // Climate
  { id: "TEMP-RECORD",  question: "Will 2025 set a global average temperature record?",        category: "climate",   yesPct: 73, noPct: 27, volume:   620_000, expiry: "Dec 31, 2025", trending: "up"   },
  { id: "HURRICANE-5",  question: "Will a Category 5 hurricane hit the US mainland in 2025?",  category: "climate",   yesPct: 18, noPct: 82, volume:   390_000, expiry: "Nov 30, 2025", trending: "flat" },
  { id: "PARIS-US",     question: "Will the US rejoin the Paris Climate Agreement in 2025?",   category: "climate",   yesPct: 5,  noPct: 95, volume:   210_000, expiry: "Dec 31, 2025", trending: "down" },
];

const TABS = ["all", "economic", "political", "climate"] as const;
type TabType = typeof TABS[number];

const CATEGORY_STYLES: Record<string, string> = {
  economic:  "bg-primary/10 text-primary",
  political: "bg-purple-500/10 text-purple-400",
  climate:   "bg-green-500/10 text-green-400",
};

function fmtVolume(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function Kalshi() {
  const [tab, setTab] = useState<TabType>("all");

  const displayed = tab === "all" ? KALSHI_MARKETS : KALSHI_MARKETS.filter(m => m.category === tab);

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Target size={12} className="text-muted-foreground" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Prediction Markets</span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">Kalshi</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Event contracts — Economic · Political · Climate
          </p>
        </div>

        {/* Strategy Brief */}
        <StrategyBrief />

        {/* API Banner */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-watch/30 bg-watch/5 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-watch">
            <AlertCircle size={14} className="shrink-0" />
            <span>Connect <span className="font-mono font-bold">Kalshi API</span> for live markets — displaying mock contracts</span>
          </div>
          <a href="https://kalshi.com/sign-up" target="_blank" rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-watch/40 bg-watch/10 px-3 py-1.5 font-mono text-xs font-bold text-watch transition-all hover:bg-watch/20">
            Get API Key →
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Open Markets",    value: String(KALSHI_MARKETS.length),       color: "text-foreground" },
            { label: "YES &gt; 50%",    value: String(KALSHI_MARKETS.filter(m => m.yesPct > 50).length), color: "text-bullish" },
            { label: "YES &lt; 50%",    value: String(KALSHI_MARKETS.filter(m => m.yesPct < 50).length), color: "text-bearish" },
            { label: "Total Volume",    value: fmtVolume(KALSHI_MARKETS.reduce((a, m) => a + m.volume, 0)), color: "text-primary" },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')}</p>
              <p className={`font-mono text-xl font-black ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                tab === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* How to Trade This */}
        <div>
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">How to Trade This</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {HOW_TO_TRADE.map(item => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">{item.tag}</span>
                </div>
                <p className="font-semibold text-sm text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Market cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayed.map((m, i) => (
            <motion.div key={m.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg">

              {/* Top row */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-bold uppercase ${CATEGORY_STYLES[m.category]}`}>
                  {m.category}
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {m.trending === "up"   && <TrendingUp size={12} className="text-bullish" />}
                  {m.trending === "down" && <TrendingDown size={12} className="text-bearish" />}
                  {m.trending === "flat" && <span className="text-neutral">→</span>}
                </div>
              </div>

              {/* Question */}
              <p className="mb-4 text-sm font-semibold leading-snug text-foreground">{m.question}</p>

              {/* YES/NO bar */}
              <div className="mb-2 overflow-hidden rounded-full bg-bearish/20 h-3">
                <div className="h-full rounded-full bg-bullish transition-all" style={{ width: `${m.yesPct}%` }} />
              </div>
              <div className="mb-4 flex justify-between font-mono text-xs font-bold">
                <span className="text-bullish">YES {m.yesPct}%</span>
                <span className="text-bearish">NO {m.noPct}%</span>
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar size={10} />
                  <span>{m.expiry}</span>
                </div>
                <span className="font-mono font-bold text-foreground">{fmtVolume(m.volume)} vol</span>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
