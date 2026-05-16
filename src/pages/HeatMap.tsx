import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPositions } from "@/data/sandboxData";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, AlertTriangle, BarChart2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Position {
  id: string;
  ticker: string;
  company_name?: string;
  strategy_type: string;
  value: number;
  pnl_dollars: number;
  pnl_percent: number;
  signal_score: number;
  status?: string;
}

// ---------------------------------------------------------------------------
// Extra demo positions added to sandboxPositions for visual richness
// ---------------------------------------------------------------------------

const extraDemoPositions: Position[] = [
  {
    id: "demo-4",
    ticker: "AAPL",
    company_name: "Apple Inc.",
    strategy_type: "long_stock",
    value: 8200,
    pnl_dollars: 1030,
    pnl_percent: 14.3,
    signal_score: 88,
    status: "open",
  },
  {
    id: "demo-5",
    ticker: "MSFT",
    company_name: "Microsoft Corp",
    strategy_type: "long_stock",
    value: 12600,
    pnl_dollars: 945,
    pnl_percent: 8.1,
    signal_score: 94,
    status: "open",
  },
  {
    id: "demo-6",
    ticker: "SPY",
    company_name: "S&P 500 ETF",
    strategy_type: "long_etf",
    value: 9400,
    pnl_dollars: -210,
    pnl_percent: -2.2,
    signal_score: 70,
    status: "open",
  },
];

const fullDemoPositions: Position[] = [
  ...(sandboxPositions as Position[]),
  ...extraDemoPositions,
];

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function getPnlColor(pct: number): string {
  if (pct > 10) return "rgba(0, 229, 160, 1.0)";
  if (pct > 5) return "rgba(0, 229, 160, 0.7)";
  if (pct >= 0) return "rgba(0, 229, 160, 0.4)";
  if (pct > -5) return "rgba(255, 77, 77, 0.4)";
  return "rgba(255, 77, 77, 0.8)";
}

function getPnlTextClass(pct: number): string {
  return pct >= 0 ? "text-bullish" : "text-bearish";
}

// ---------------------------------------------------------------------------
// Asset class categorisation
// ---------------------------------------------------------------------------

const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL", "DOGE", "ADA", "XRP", "AVAX", "MATIC"]);
const ETF_PATTERNS = ["SPY", "QQQ", "IWM", "VTI", "GLD", "TLT", "EEM", "XLF", "XLK"];

function getAssetClass(position: Position): string {
  if (CRYPTO_TICKERS.has(position.ticker)) return "Crypto";
  if (ETF_PATTERNS.includes(position.ticker) || position.strategy_type === "long_etf") return "ETF";
  if (
    position.strategy_type === "covered_call" ||
    position.strategy_type === "put_credit_spread" ||
    position.strategy_type === "call_debit" ||
    position.strategy_type === "options"
  )
    return "Options";
  return "Stocks";
}

function formatStrategy(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Treemap layout — slice-and-dice algorithm
// ---------------------------------------------------------------------------

interface TreemapRect {
  position: Position;
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeTreemap(
  positions: Position[],
  containerWidth: number,
  containerHeight: number
): TreemapRect[] {
  const sorted = [...positions].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, p) => s + p.value, 0);
  if (total === 0) return [];

  const rects: TreemapRect[] = [];

  function slice(
    items: Position[],
    x: number,
    y: number,
    w: number,
    h: number,
    horizontal: boolean
  ) {
    const subtotal = items.reduce((s, p) => s + p.value, 0);
    let cursor = horizontal ? x : y;

    items.forEach((p, idx) => {
      const frac = p.value / subtotal;
      const isLast = idx === items.length - 1;

      if (horizontal) {
        const rw = isLast ? x + w - cursor : Math.round(frac * w);
        rects.push({ position: p, x: cursor, y, width: rw, height: h });
        cursor += rw;
      } else {
        const rh = isLast ? y + h - cursor : Math.round(frac * h);
        rects.push({ position: p, x, y: cursor, width: w, height: rh });
        cursor += rh;
      }
    });
  }

  // Two-pass: split into two groups, bigger half horizontally, rest vertically
  const half = Math.ceil(sorted.length / 2);
  const topGroup = sorted.slice(0, half);
  const bottomGroup = sorted.slice(half);

  const topTotal = topGroup.reduce((s, p) => s + p.value, 0);
  const splitY = Math.round((topTotal / total) * containerHeight);

  slice(topGroup, 0, 0, containerWidth, splitY, true);
  if (bottomGroup.length > 0) {
    slice(bottomGroup, 0, splitY, containerWidth, containerHeight - splitY, true);
  }

  return rects;
}

// ---------------------------------------------------------------------------
// Concentration metrics
// ---------------------------------------------------------------------------

function computeConcentration(positions: Position[]) {
  const total = positions.reduce((s, p) => s + p.value, 0);
  const weights = positions.map((p) => p.value / total);
  const herfindahl = weights.reduce((s, w) => s + w * w, 0);

  const sorted = [...positions].sort((a, b) => b.value - a.value);
  const top1Pct = total > 0 ? (sorted[0]?.value / total) * 100 : 0;
  const top3Pct =
    total > 0
      ? (sorted.slice(0, 3).reduce((s, p) => s + p.value, 0) / total) * 100
      : 0;

  return { total, herfindahl, top1Pct, top3Pct, sorted };
}

function concentrationColor(hhi: number): string {
  if (hhi < 0.15) return "text-bullish";
  if (hhi < 0.25) return "text-yellow-400";
  return "text-bearish";
}

function concentrationLabel(hhi: number): string {
  if (hhi < 0.15) return "Well Diversified";
  if (hhi < 0.25) return "Moderate Concentration";
  return "Highly Concentrated";
}

// ---------------------------------------------------------------------------
// Pie chart colours
// ---------------------------------------------------------------------------

const PIE_COLORS = ["#00E5A0", "#6366F1", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9"];

// ---------------------------------------------------------------------------
// Tooltip state
// ---------------------------------------------------------------------------

interface TooltipState {
  position: Position;
  mouseX: number;
  mouseY: number;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function HeatMap() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions", "heatmap", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return fullDemoPositions;
      const { data } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "open");
      return (data ?? []) as Position[];
    },
    enabled: !!user || isDemoMode,
  });

  // Derived data
  const sortedByPnl = [...positions].sort((a, b) => b.pnl_percent - a.pnl_percent);
  const { total, herfindahl, top1Pct, top3Pct, sorted: sortedByValue } = computeConcentration(positions);

  // Allocation by asset class
  const assetClassMap: Record<string, number> = {};
  positions.forEach((p) => {
    const cls = getAssetClass(p);
    assetClassMap[cls] = (assetClassMap[cls] || 0) + p.value;
  });
  const assetClassData = Object.entries(assetClassMap).map(([name, value]) => ({ name, value }));

  // Allocation by strategy
  const strategyMap: Record<string, number> = {};
  positions.forEach((p) => {
    const strat = formatStrategy(p.strategy_type);
    strategyMap[strat] = (strategyMap[strat] || 0) + p.value;
  });
  const strategyData = Object.entries(strategyMap).map(([name, value]) => ({ name, value }));

  // Treemap dimensions (fixed height, responsive width handled by wrapper)
  const TREEMAP_HEIGHT = 420;
  const TREEMAP_WIDTH = 900; // virtual px; CSS scales it

  const rects = positions.length > 0 ? computeTreemap(positions, TREEMAP_WIDTH, TREEMAP_HEIGHT) : [];

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <BarChart2 className="h-6 w-6 text-primary" />
          <h2 className="font-display text-2xl font-bold text-foreground">Portfolio Heat Map</h2>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 1 — TREEMAP                                                */}
        {/* ------------------------------------------------------------------ */}
        <Card className="border-border bg-card p-6">
          <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Position Heat Map — sized by value, colored by P&amp;L %
          </h3>

          {isLoading ? (
            <div className="flex h-[420px] items-center justify-center text-muted-foreground">
              Loading positions…
            </div>
          ) : positions.length === 0 ? (
            <div className="flex h-[420px] items-center justify-center text-muted-foreground">
              No open positions to display
            </div>
          ) : (
            <div
              className="relative w-full overflow-hidden rounded-lg"
              style={{ paddingBottom: `${(TREEMAP_HEIGHT / TREEMAP_WIDTH) * 100}%` }}
              onMouseLeave={() => setTooltip(null)}
            >
              <div className="absolute inset-0">
                {/* SVG treemap */}
                <svg
                  viewBox={`0 0 ${TREEMAP_WIDTH} ${TREEMAP_HEIGHT}`}
                  width="100%"
                  height="100%"
                  preserveAspectRatio="xMidYMid meet"
                  className="block"
                >
                  {rects.map((rect, idx) => {
                    const { position: pos, x, y, width, height } = rect;
                    const bg = getPnlColor(pos.pnl_percent);
                    const isPositive = pos.pnl_percent >= 0;
                    const fontSize = Math.max(10, Math.min(22, width / 6));
                    const subFontSize = Math.max(8, Math.min(14, width / 9));

                    return (
                      <g
                        key={pos.id}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => {
                          const svg = (e.target as SVGElement).closest("svg");
                          if (!svg) return;
                          const svgRect = svg.getBoundingClientRect();
                          const scaleX = svgRect.width / TREEMAP_WIDTH;
                          const scaleY = svgRect.height / TREEMAP_HEIGHT;
                          setTooltip({
                            position: pos,
                            mouseX: (x + width / 2) * scaleX + svgRect.left,
                            mouseY: (y + height / 2) * scaleY + svgRect.top,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <rect
                          x={x + 1}
                          y={y + 1}
                          width={Math.max(0, width - 2)}
                          height={Math.max(0, height - 2)}
                          fill={bg}
                          rx={4}
                          ry={4}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                        {width > 60 && height > 40 && (
                          <>
                            <text
                              x={x + width / 2}
                              y={y + height / 2 - fontSize * 0.6}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={fontSize}
                              fontWeight="700"
                              fontFamily="inherit"
                              fill={isPositive ? "#001a0d" : "#1a0000"}
                            >
                              {pos.ticker}
                            </text>
                            <text
                              x={x + width / 2}
                              y={y + height / 2 + subFontSize * 0.4}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={subFontSize}
                              fontWeight="600"
                              fontFamily="inherit"
                              fill={isPositive ? "#003320" : "#330000"}
                            >
                              {pos.pnl_percent >= 0 ? "+" : ""}
                              {pos.pnl_percent.toFixed(1)}%
                            </text>
                            {height > 70 && (
                              <text
                                x={x + width / 2}
                                y={y + height / 2 + subFontSize * 1.8}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={Math.max(7, subFontSize - 2)}
                                fontFamily="inherit"
                                fill={isPositive ? "#004d30" : "#4d0000"}
                              >
                                ${pos.value.toLocaleString()}
                              </text>
                            )}
                          </>
                        )}
                        {(width <= 60 || height <= 40) && width > 20 && height > 20 && (
                          <text
                            x={x + width / 2}
                            y={y + height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={Math.max(7, Math.min(11, width / 4))}
                            fontWeight="700"
                            fontFamily="inherit"
                            fill={isPositive ? "#001a0d" : "#1a0000"}
                          >
                            {pos.ticker}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Floating tooltip — rendered in a portal-like fixed position */}
              {tooltip && (
                <div
                  className="pointer-events-none fixed z-50 max-w-[200px] rounded-lg border border-border bg-card p-3 shadow-xl text-xs"
                  style={{
                    left: tooltip.mouseX + 12,
                    top: tooltip.mouseY - 70,
                  }}
                >
                  <p className="font-mono font-bold text-foreground text-sm mb-1">
                    {tooltip.position.ticker}
                  </p>
                  {tooltip.position.company_name && (
                    <p className="text-muted-foreground mb-2 text-[10px]">
                      {tooltip.position.company_name}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Value</span>
                      <span className="font-mono font-semibold text-foreground">
                        ${tooltip.position.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">P&L $</span>
                      <span
                        className={`font-mono font-semibold ${getPnlTextClass(tooltip.position.pnl_percent)}`}
                      >
                        {tooltip.position.pnl_dollars >= 0 ? "+" : ""}$
                        {tooltip.position.pnl_dollars.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">P&L %</span>
                      <span
                        className={`font-mono font-semibold ${getPnlTextClass(tooltip.position.pnl_percent)}`}
                      >
                        {tooltip.position.pnl_percent >= 0 ? "+" : ""}
                        {tooltip.position.pnl_percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Strategy</span>
                      <span className="font-mono text-foreground">
                        {formatStrategy(tooltip.position.strategy_type)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Signal</span>
                      <span className="font-mono font-semibold text-primary">
                        {tooltip.position.signal_score}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-widest">Color scale:</span>
            {[
              { label: "> +10%", color: "rgba(0,229,160,1.0)" },
              { label: "+5–10%", color: "rgba(0,229,160,0.7)" },
              { label: "0–5%", color: "rgba(0,229,160,0.4)" },
              { label: "-5–0%", color: "rgba(255,77,77,0.4)" },
              { label: "< -5%", color: "rgba(255,77,77,0.8)" },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-6 rounded"
                  style={{ background: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 2 — ALLOCATION BREAKDOWN                                   */}
        {/* ------------------------------------------------------------------ */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-border bg-card p-6">
            <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              By Asset Class
            </h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetClassData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {assetClassData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="border-border bg-card p-6">
            <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              By Strategy Type
            </h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={strategyData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {strategyData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[(idx + 2) % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 3 — CONCENTRATION RISK                                     */}
        {/* ------------------------------------------------------------------ */}
        <Card className="border-border bg-card p-6">
          <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Concentration Risk
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Metric cards */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg border border-border bg-background p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Largest Position
              </p>
              <p className={`mt-1 font-mono text-2xl font-bold ${top1Pct > 40 ? "text-bearish" : "text-foreground"}`}>
                {top1Pct.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Top holding: <span className="font-semibold text-foreground">{sortedByValue[0]?.ticker}</span>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.07 }}
              className="rounded-lg border border-border bg-background p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Top 3 Combined
              </p>
              <p className={`mt-1 font-mono text-2xl font-bold ${top3Pct > 70 ? "text-yellow-400" : "text-foreground"}`}>
                {top3Pct.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {sortedByValue
                  .slice(0, 3)
                  .map((p) => p.ticker)
                  .join(", ")}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.14 }}
              className="rounded-lg border border-border bg-background p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Herfindahl Index
              </p>
              <p className={`mt-1 font-mono text-2xl font-bold ${concentrationColor(herfindahl)}`}>
                {herfindahl.toFixed(3)}
              </p>
              <p className={`mt-1 text-xs font-semibold ${concentrationColor(herfindahl)}`}>
                {concentrationLabel(herfindahl)}
              </p>
            </motion.div>
          </div>

          {/* Breakdown rows */}
          <div className="mt-4 space-y-2">
            {sortedByValue.map((pos) => {
              const weightPct = total > 0 ? (pos.value / total) * 100 : 0;
              return (
                <div key={pos.id} className="flex items-center gap-3">
                  <span className="w-12 font-mono text-xs font-bold text-foreground">{pos.ticker}</span>
                  <div className="flex-1 rounded-full bg-border/40 h-2 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: getPnlColor(pos.pnl_percent) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${weightPct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <span className="w-14 text-right font-mono text-xs text-muted-foreground">
                    {weightPct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION 4 — P&L SUMMARY TABLE                                      */}
        {/* ------------------------------------------------------------------ */}
        <Card className="border-border bg-card">
          <div className="p-6">
            <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              P&amp;L Summary — Winners First
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Ticker</TableHead>
                    <TableHead className="text-muted-foreground text-right">Value</TableHead>
                    <TableHead className="text-muted-foreground text-right">Weight %</TableHead>
                    <TableHead className="text-muted-foreground text-right">P&amp;L $</TableHead>
                    <TableHead className="text-muted-foreground text-right">P&amp;L %</TableHead>
                    <TableHead className="text-muted-foreground text-right">Signal Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedByPnl.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No open positions
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedByPnl.map((pos) => {
                      const weight = total > 0 ? (pos.value / total) * 100 : 0;
                      return (
                        <TableRow
                          key={pos.id}
                          className="border-border hover:bg-accent/30 transition-fast"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {pos.pnl_percent >= 0 ? (
                                <TrendingUp className="h-3.5 w-3.5 text-bullish shrink-0" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-bearish shrink-0" />
                              )}
                              <span className="font-mono font-bold text-foreground">{pos.ticker}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-right text-xs">
                            ${pos.value.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-right text-xs text-muted-foreground">
                            {weight.toFixed(1)}%
                          </TableCell>
                          <TableCell
                            className={`font-mono text-right text-xs font-bold ${getPnlTextClass(pos.pnl_percent)}`}
                          >
                            {pos.pnl_dollars >= 0 ? "+" : ""}${pos.pnl_dollars.toLocaleString()}
                          </TableCell>
                          <TableCell
                            className={`font-mono text-right text-xs font-bold ${getPnlTextClass(pos.pnl_percent)}`}
                          >
                            {pos.pnl_percent >= 0 ? "+" : ""}
                            {pos.pnl_percent.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                                pos.signal_score >= 80
                                  ? "bg-bullish/20 text-bullish"
                                  : pos.signal_score >= 60
                                  ? "bg-yellow-400/20 text-yellow-400"
                                  : "bg-bearish/20 text-bearish"
                              }`}
                            >
                              {pos.signal_score}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
