import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Landmark,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

// ── Strategy Brief ─────────────────────────────────────────────────────────────
function StrategyBrief() {
  return (
    <div
      className="rounded-xl border border-bearish/40 bg-card px-4 py-3 space-y-3"
      style={{ borderLeftWidth: "4px", borderLeftColor: "hsl(var(--bearish))" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-bearish/40 bg-bearish/10 px-3 py-1">
            <TrendingDown size={12} className="text-bearish" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-bearish">
              INVERTED CURVE
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug max-w-xl">
            2s10s spread inverted at -12bps. Historically precedes recession
            within 12-18 months. Action: reduce equity exposure, increase
            short-duration bonds, watch for Fed pivot signal.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/position-sizer"
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Position Sizer <ChevronRight size={11} />
          </Link>
          <Link
            to="/alerts"
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Set Alert <ChevronRight size={11} />
          </Link>
          <Link
            to="/decisions"
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Decision Hub <ChevronRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Portfolio Implications ─────────────────────────────────────────────────────
const PORTFOLIO_IMPLICATIONS = [
  { title: "Reduce Equity Risk", desc: "Trim high-beta positions", icon: "↓" },
  {
    title: "Buy Short Duration",
    desc: "1–2Y treasuries yield 5.2%+",
    icon: "🏦",
  },
  {
    title: "Watch for Pivot",
    desc: "Fed pause = bond rally signal",
    icon: "👀",
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface TreasuryYield {
  maturity: string;
  months: number;
  yield: number;
  prevYield: number;
  change: number;
}

interface SpreadMetric {
  label: string;
  value: number;
  description: string;
  inverted: boolean;
}

// ── Label mapping from edge-function long-form to short display ────────────────
const LABEL_SHORT: Record<string, string> = {
  "1-Month": "1M",
  "3-Month": "3M",
  "6-Month": "6M",
  "1-Year": "1Y",
  "2-Year": "2Y",
  "5-Year": "5Y",
  "10-Year": "10Y",
  "30-Year": "30Y",
};
const MONTHS_MAP: Record<string, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  "2Y": 24,
  "5Y": 60,
  "10Y": 120,
  "30Y": 360,
};

export default function FixedIncome() {
  const { data: bondData, isLoading } = useQuery({
    queryKey: ["bonds"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "get-market-data",
        {
          body: { type: "bonds" },
        },
      );
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const yields: TreasuryYield[] = ((bondData?.bonds?.yields ?? []) as any[])
    .filter((y) => y.id !== "FEDFUNDS" && LABEL_SHORT[y.label])
    .map((y) => {
      const maturity = LABEL_SHORT[y.label];
      return {
        maturity,
        months: MONTHS_MAP[maturity] ?? 0,
        yield: y.yield,
        prevYield: y.prevYield,
        change: y.change,
      };
    });

  const gy = (mat: string) =>
    yields.find((y) => y.maturity === mat)?.yield ?? 0;

  const spreads: SpreadMetric[] = [
    {
      label: "2s10s Spread",
      value: gy("10Y") - gy("2Y"),
      description:
        "10Y minus 2Y yield. Negative = inverted curve (recession signal).",
      inverted: gy("10Y") - gy("2Y") < 0,
    },
    {
      label: "10s30s Spread",
      value: gy("30Y") - gy("10Y"),
      description:
        "30Y minus 10Y yield. Reflects long-term inflation expectations.",
      inverted: gy("30Y") - gy("10Y") < 0,
    },
    {
      label: "3M10Y Spread",
      value: gy("10Y") - gy("3M"),
      description: "10Y minus 3M yield. Fed-preferred recession predictor.",
      inverted: gy("10Y") - gy("3M") < 0,
    },
  ];

  const maxYield = yields.length ? Math.max(...yields.map((y) => y.yield)) : 1;
  const tenYear = yields.find((y) => y.maturity === "10Y");
  const twoYear = yields.find((y) => y.maturity === "2Y");
  const curveInverted =
    twoYear && tenYear ? twoYear.yield > tenYear.yield : false;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Landmark size={12} className="text-muted-foreground" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              US Treasury Market
            </span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">
            Fixed Income
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Treasury yield curve, spread metrics, and rate environment
          </p>
        </div>

        {/* Strategy Brief */}
        <StrategyBrief />

        {/* Portfolio Implications */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PORTFOLIO_IMPLICATIONS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-bearish/20 bg-bearish/5 p-4"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-base">{item.icon}</span>
                <p className="font-mono text-xs font-bold text-bearish uppercase tracking-wider">
                  {item.title}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Inversion alert */}
        {curveInverted && twoYear && tenYear && (
          <div className="flex items-center gap-3 rounded-xl border border-bearish/30 bg-bearish/5 px-4 py-3 text-sm text-bearish">
            <AlertCircle size={14} className="shrink-0" />
            <span>
              <span className="font-bold">Yield Curve Inverted:</span> 2Y yield
              ({twoYear.yield.toFixed(2)}%) exceeds 10Y yield (
              {tenYear.yield.toFixed(2)}%) — historically a recession precursor.
            </span>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "10Y Yield",
              value: tenYear ? `${tenYear.yield.toFixed(2)}%` : "—",
              color: "text-foreground",
            },
            {
              label: "2Y Yield",
              value: twoYear ? `${twoYear.yield.toFixed(2)}%` : "—",
              color: "text-foreground",
            },
            {
              label: "2s10s",
              value:
                tenYear && twoYear
                  ? `${(tenYear.yield - twoYear.yield).toFixed(2)} bps`
                  : "—",
              color: curveInverted ? "text-bearish" : "text-bullish",
            },
            {
              label: "Curve Shape",
              value: isLoading ? "—" : curveInverted ? "Inverted" : "Normal",
              color: curveInverted ? "text-bearish" : "text-bullish",
            },
          ].map((s) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <p className={`font-mono text-xl font-black ${s.color}`}>
                {s.value}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Yield curve visualization */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h3 className="mb-4 font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Yield Curve
            </h3>
            <div className="space-y-3">
              {isLoading && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Loading yield data…
                </p>
              )}
              {yields.map((y, i) => {
                const barWidth = (y.yield / maxYield) * 100;
                const pos = y.change >= 0;
                return (
                  <motion.div
                    key={y.maturity}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3"
                  >
                    <span className="w-8 shrink-0 font-mono text-xs font-bold text-muted-foreground">
                      {y.maturity}
                    </span>
                    <div className="relative flex-1">
                      <div className="h-6 w-full overflow-hidden rounded bg-accent/20">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${barWidth}%`,
                            background: `linear-gradient(90deg, hsl(var(--primary) / 0.6), hsl(var(--primary)))`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono text-sm font-black text-foreground">
                      {y.yield.toFixed(2)}%
                    </span>
                    <span
                      className={`w-14 shrink-0 text-right font-mono text-xs ${pos ? "text-bullish" : "text-bearish"}`}
                    >
                      {pos ? "+" : ""}
                      {y.change.toFixed(2)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Bar length proportional to yield. Change in basis points (bps).
            </p>
          </motion.div>

          {/* Yield table + spreads */}
          <div className="space-y-4">
            {/* Yield table */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    {["Maturity", "Yield", "Prev", "Change"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yields.map((y, i) => {
                    const pos = y.change >= 0;
                    return (
                      <motion.tr
                        key={y.maturity}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border/40 transition-colors hover:bg-accent/20"
                      >
                        <td className="px-4 py-2.5 font-mono text-sm font-black text-foreground">
                          {y.maturity}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-sm font-bold text-foreground">
                          {y.yield.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {y.prevYield.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`flex items-center gap-1 font-mono text-xs font-bold ${pos ? "text-bullish" : "text-bearish"}`}
                          >
                            {pos ? (
                              <TrendingUp size={9} />
                            ) : (
                              <TrendingDown size={9} />
                            )}
                            {pos ? "+" : ""}
                            {y.change.toFixed(2)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>

            {/* Spread metrics */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              {spreads.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-sm font-bold text-foreground">
                        {s.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-lg font-black ${s.inverted ? "text-bearish" : "text-bullish"}`}
                    >
                      {s.value >= 0 ? "+" : ""}
                      {s.value.toFixed(2)}
                    </span>
                  </div>
                  {s.inverted && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-bearish" />
                      <span className="font-mono text-xs text-bearish">
                        Inverted
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
