import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, AlertCircle, TrendingUp, TrendingDown, Droplets, BarChart2, ChevronRight, Minus } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

// ── Strategy Brief ─────────────────────────────────────────────────────────────
function StrategyBrief() {
  return (
    <div className="rounded-xl border border-primary/40 bg-card px-4 py-3 space-y-3" style={{ borderLeftWidth: "4px", borderLeftColor: "hsl(var(--primary))" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1">
            <Minus size={12} className="text-primary" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-primary">MARKETS ACTIVE</span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug max-w-xl">
            Decentralized prediction markets show BTC 55% to hold $60K. Crypto contracts offer portfolio hedging opportunities at low cost.
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
    title: "Crypto Portfolio Hedge",
    desc: "Buy YES on BTC $60K hold to hedge downside if you're long BTC",
    tag: "HEDGE",
  },
  {
    title: "Macro Event Play",
    desc: "Fed cuts contract (61% YES) is underpriced vs treasury market expectations",
    tag: "MACRO",
  },
  {
    title: "Low-Cost Entry",
    desc: "Polymarket contracts settle at $1 — small size, asymmetric payout on high-conviction views",
    tag: "SIZING",
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface PolyMarket {
  id: string;
  question: string;
  category: "crypto" | "politics" | "sports" | "tech" | "economics";
  probability: number;         // 0–100
  liquidity: number;           // USD
  volume: number;              // USD
  endDate: string;
  trending: "up" | "down" | "flat";
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const POLY_MARKETS: PolyMarket[] = [
  // Crypto
  { id: "BTC-100K-2025",  question: "Will Bitcoin reach $100K by end of 2025?",                   category: "crypto",    probability: 52, liquidity: 4_800_000, volume: 12_300_000, endDate: "Dec 31, 2025", trending: "up"   },
  { id: "ETH-5K-2025",    question: "Will Ethereum reach $5K by end of 2025?",                    category: "crypto",    probability: 31, liquidity: 2_100_000, volume: 5_700_000,  endDate: "Dec 31, 2025", trending: "flat" },
  { id: "BTC-ATH-Q2",     question: "Will Bitcoin set a new ATH in Q2 2025?",                     category: "crypto",    probability: 44, liquidity: 3_200_000, volume: 8_900_000,  endDate: "Jun 30, 2025", trending: "down" },
  { id: "DOGE-0.50",      question: "Will DOGE trade above $0.50 before June 2025?",               category: "crypto",    probability: 19, liquidity:   820_000, volume: 2_100_000,  endDate: "Jun 30, 2025", trending: "down" },
  // Politics
  { id: "TRUMP-2026",     question: "Will Trump's approval rating exceed 50% in 2026 midterms?",  category: "politics",  probability: 33, liquidity: 6_100_000, volume: 18_400_000, endDate: "Nov 3, 2026",  trending: "flat" },
  { id: "GOP-HOUSE-2026", question: "Will Republicans retain the House in the 2026 elections?",   category: "politics",  probability: 58, liquidity: 3_900_000, volume: 9_800_000,  endDate: "Nov 4, 2026",  trending: "up"   },
  // Sports
  { id: "NBA-FINALS-25",  question: "Will the OKC Thunder win the 2025 NBA Finals?",              category: "sports",    probability: 27, liquidity: 1_400_000, volume: 3_900_000,  endDate: "Jun 22, 2025", trending: "up"   },
  { id: "NFL-SB-60",      question: "Will the Kansas City Chiefs win Super Bowl LX?",              category: "sports",    probability: 22, liquidity: 2_800_000, volume: 7_200_000,  endDate: "Feb 1, 2026",  trending: "flat" },
  // Tech
  { id: "OPENAI-IPO",     question: "Will OpenAI go public (IPO) by end of 2025?",                category: "tech",      probability: 11, liquidity:   980_000, volume: 3_100_000,  endDate: "Dec 31, 2025", trending: "down" },
  { id: "ANTHROPIC-IPO",  question: "Will Anthropic go public (IPO) by end of 2026?",             category: "tech",      probability: 17, liquidity:   740_000, volume: 2_200_000,  endDate: "Dec 31, 2026", trending: "flat" },
  // Economics
  { id: "RECESS-USA-25",  question: "Will the US enter a recession in 2025?",                     category: "economics", probability: 36, liquidity: 5_400_000, volume: 14_600_000, endDate: "Dec 31, 2025", trending: "up"   },
  { id: "FED-CUT-25",     question: "Will the Fed cut rates at least twice in 2025?",              category: "economics", probability: 61, liquidity: 4_100_000, volume: 11_200_000, endDate: "Dec 17, 2025", trending: "up"   },
];

const TABS = ["all", "crypto", "politics", "sports", "tech", "economics"] as const;
type TabType = typeof TABS[number];

const CATEGORY_STYLES: Record<string, string> = {
  crypto:    "bg-orange-500/10 text-orange-400",
  politics:  "bg-purple-500/10 text-purple-400",
  sports:    "bg-green-500/10 text-green-400",
  tech:      "bg-blue-500/10 text-blue-400",
  economics: "bg-primary/10 text-primary",
};

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function Polymarket() {
  const [tab, setTab] = useState<TabType>("all");

  const displayed = tab === "all" ? POLY_MARKETS : POLY_MARKETS.filter(m => m.category === tab);

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Brain size={12} className="text-muted-foreground" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Prediction Markets</span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">Polymarket</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Decentralized prediction markets — Crypto · Politics · Sports · Tech · Economics
          </p>
        </div>

        {/* Strategy Brief */}
        <StrategyBrief />

        {/* API Banner */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-watch/30 bg-watch/5 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-watch">
            <AlertCircle size={14} className="shrink-0" />
            <span>Connect <span className="font-mono font-bold">Polymarket API</span> for live markets — displaying mock contracts</span>
          </div>
          <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-watch/40 bg-watch/10 px-3 py-1.5 font-mono text-xs font-bold text-watch transition-all hover:bg-watch/20">
            Open Polymarket →
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Markets",       value: String(POLY_MARKETS.length),         color: "text-foreground" },
            { label: "Trending Up",   value: String(POLY_MARKETS.filter(m => m.trending === "up").length), color: "text-bullish" },
            { label: "Trending Down", value: String(POLY_MARKETS.filter(m => m.trending === "down").length), color: "text-bearish" },
            { label: "Total Volume",  value: fmtMoney(POLY_MARKETS.reduce((a, m) => a + m.volume, 0)), color: "text-primary" },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <p className={`font-mono text-xl font-black ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Category tabs */}
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
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold uppercase ${CATEGORY_STYLES[m.category]}`}>
                  {m.category}
                </span>
                <div className="flex items-center gap-1">
                  {m.trending === "up"   && <TrendingUp size={12} className="text-bullish" />}
                  {m.trending === "down" && <TrendingDown size={12} className="text-bearish" />}
                  {m.trending === "flat" && <span className="font-mono text-xs text-neutral">→</span>}
                </div>
              </div>

              {/* Question */}
              <p className="mb-4 text-sm font-semibold leading-snug text-foreground">{m.question}</p>

              {/* Probability bar */}
              <div className="mb-1 flex items-center justify-between text-xs font-mono font-bold">
                <span className={m.probability >= 50 ? "text-bullish" : "text-bearish"}>
                  {m.probability}% YES
                </span>
                <span className="text-muted-foreground">{100 - m.probability}% NO</span>
              </div>
              <div className="mb-4 h-3 overflow-hidden rounded-full bg-accent/30">
                <div
                  className={`h-full rounded-full transition-all ${m.probability >= 50 ? "bg-bullish" : "bg-bearish"}`}
                  style={{ width: `${m.probability}%` }}
                />
              </div>

              {/* Meta row */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Droplets size={10} />
                    <span>{fmtMoney(m.liquidity)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart2 size={10} />
                    <span>{fmtMoney(m.volume)}</span>
                  </div>
                </div>
                <span>{m.endDate}</span>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
