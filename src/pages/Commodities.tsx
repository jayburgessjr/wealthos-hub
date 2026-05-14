import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wheat, AlertCircle, Filter, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

// ── Strategy Brief ─────────────────────────────────────────────────────────────
function StrategyBrief() {
  return (
    <div className="rounded-xl border border-bullish/40 bg-card px-4 py-3 space-y-3" style={{ borderLeftWidth: "4px", borderLeftColor: "hsl(var(--bullish))" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-bullish/40 bg-bullish/10 px-3 py-1">
            <TrendingUp size={12} className="text-bullish" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-bullish">BULLISH METALS</span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug max-w-xl">
            Gold breaking to new ATH. Energy mixed — WTI range-bound. Best opportunity: long Gold on pullbacks to $3,290 with stop below $3,250.
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

// ── Top Setup ─────────────────────────────────────────────────────────────────
const TOP_SETUP = {
  asset: "GOLD",
  direction: "LONG",
  entry: "$3,290",
  stop: "$3,250",
  target: "$3,400",
  rr: "2.75:1",
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface Commodity {
  name: string;
  ticker: string;
  unit: string;
  category: "metals" | "energy" | "agriculture";
  price: number;
  change24h: number;
  changePct24h: number;
  changeYTD: number;
  changePctYTD: number;
  icon: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const COMMODITIES: Commodity[] = [
  { name: "Gold",        ticker: "XAUUSD", unit: "oz",   category: "metals",      price: 3344.20, change24h: 12.40,  changePct24h: 0.37,  changeYTD: 498.30,  changePctYTD: 17.49, icon: "🥇" },
  { name: "Silver",      ticker: "XAGUSD", unit: "oz",   category: "metals",      price: 32.84,   change24h: -0.22,  changePct24h: -0.67, changeYTD: 3.21,    changePctYTD: 10.82, icon: "🥈" },
  { name: "Copper",      ticker: "XCUUSD", unit: "lb",   category: "metals",      price: 4.712,   change24h: 0.031,  changePct24h: 0.66,  changeYTD: 0.41,    changePctYTD: 9.52,  icon: "🟤" },
  { name: "Platinum",    ticker: "XPTUSD", unit: "oz",   category: "metals",      price: 982.50,  change24h: -5.10,  changePct24h: -0.52, changeYTD: 42.10,   changePctYTD: 4.48,  icon: "⚪" },
  { name: "Crude Oil (WTI)", ticker: "USOIL", unit: "bbl", category: "energy",   price: 78.43,   change24h: -1.12,  changePct24h: -1.41, changeYTD: -3.82,   changePctYTD: -4.65, icon: "🛢️" },
  { name: "Brent Crude", ticker: "UKOIL",  unit: "bbl",  category: "energy",     price: 82.17,   change24h: -0.98,  changePct24h: -1.18, changeYTD: -2.44,   changePctYTD: -2.88, icon: "⛽" },
  { name: "Natural Gas", ticker: "NATGAS", unit: "MMBtu",category: "energy",     price: 3.241,   change24h: 0.074,  changePct24h: 2.34,  changeYTD: 0.891,   changePctYTD: 37.95, icon: "🔥" },
  { name: "Wheat",       ticker: "WHEAT",  unit: "bu",   category: "agriculture", price: 534.25,  change24h: -4.75,  changePct24h: -0.88, changeYTD: 22.50,   changePctYTD: 4.40,  icon: "🌾" },
  { name: "Corn",        ticker: "CORN",   unit: "bu",   category: "agriculture", price: 434.75,  change24h: 2.25,   changePct24h: 0.52,  changeYTD: -18.50,  changePctYTD: -4.08, icon: "🌽" },
  { name: "Soybeans",    ticker: "SBEAN",  unit: "bu",   category: "agriculture", price: 1072.50, change24h: -6.00,  changePct24h: -0.56, changeYTD: -41.50,  changePctYTD: -3.73, icon: "🫘" },
  { name: "Coffee",      ticker: "COFFEE", unit: "lb",   category: "agriculture", price: 327.40,  change24h: 4.80,   changePct24h: 1.49,  changeYTD: 85.40,   changePctYTD: 35.27, icon: "☕" },
  { name: "Cotton",      ticker: "COTTON", unit: "lb",   category: "agriculture", price: 68.92,   change24h: -0.43,  changePct24h: -0.62, changeYTD: -5.22,   changePctYTD: -7.04, icon: "🌿" },
];

const FILTER_TABS = ["all", "metals", "energy", "agriculture"] as const;
type FilterTab = typeof FILTER_TABS[number];

const CATEGORY_COLORS: Record<string, string> = {
  metals:      "bg-yellow-500/10 text-yellow-400",
  energy:      "bg-orange-500/10 text-orange-400",
  agriculture: "bg-green-500/10 text-green-400",
};

export default function Commodities() {
  const [filter, setFilter] = useState<FilterTab>("all");

  const displayed = filter === "all" ? COMMODITIES : COMMODITIES.filter(c => c.category === filter);
  const gainers = COMMODITIES.filter(c => c.changePct24h > 0).length;
  const losers  = COMMODITIES.filter(c => c.changePct24h < 0).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Wheat size={12} className="text-muted-foreground" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Raw Markets</span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">Commodities</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Metals · Energy · Agriculture — prices, 24h change, and YTD performance
          </p>
        </div>

        {/* Strategy Brief */}
        <StrategyBrief />

        {/* Top Setup Card */}
        <div className="rounded-xl border border-bullish/30 bg-bullish/5 px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-xs font-black uppercase tracking-wider text-bullish">Top Setup</span>
            <span className="rounded-full bg-bullish/10 px-2 py-0.5 font-mono text-xs font-bold text-bullish">{TOP_SETUP.direction}</span>
            <span className="font-mono text-xs font-bold text-foreground">{TOP_SETUP.asset}</span>
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
          <span>Connect <span className="font-mono font-bold">POLYGON_KEY</span> for live commodity data — displaying mock prices</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Tracked",      value: String(COMMODITIES.length), color: "text-foreground" },
            { label: "24h Gainers",  value: String(gainers),            color: "text-bullish"    },
            { label: "24h Losers",   value: String(losers),             color: "text-bearish"    },
            { label: "Gold Price",   value: `$${COMMODITIES[0].price.toLocaleString()}`, color: "text-yellow-400" },
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

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayed.map((c, i) => {
            const pos24h = c.changePct24h >= 0;
            const posYTD = c.changePctYTD >= 0;
            return (
              <motion.div key={c.ticker}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{c.icon}</span>
                    <div>
                      <p className="font-bold text-foreground">{c.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{c.ticker} · per {c.unit}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold uppercase ${CATEGORY_COLORS[c.category]}`}>
                    {c.category}
                  </span>
                </div>

                <p className="font-mono text-2xl font-black text-foreground">
                  ${c.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">24h Change</span>
                    <span className={`flex items-center gap-1 font-mono text-sm font-bold ${pos24h ? "text-bullish" : "text-bearish"}`}>
                      {pos24h ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {pos24h ? "+" : ""}{c.changePct24h.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">YTD Change</span>
                    <span className={`flex items-center gap-1 font-mono text-sm font-bold ${posYTD ? "text-bullish" : "text-bearish"}`}>
                      {posYTD ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {posYTD ? "+" : ""}{c.changePctYTD.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Trend bar */}
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-accent/40">
                  <div
                    className={`h-full rounded-full transition-all ${pos24h ? "bg-bullish" : "bg-bearish"}`}
                    style={{ width: `${Math.min(Math.abs(c.changePct24h) * 20, 100)}%` }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </DashboardLayout>
  );
}
