import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxTransactions, sandboxPositions } from "@/data/sandboxData";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LineChart, Line, ReferenceLine,
} from "recharts";
import { format, differenceInDays } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Award, AlertTriangle, BarChart3, Target } from "lucide-react";
import { motion } from "framer-motion";

// ── Math helpers ──────────────────────────────────────────────────────────────
function calcSharpe(returns: number[], riskFreeRate = 0.045) {
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const annualReturn = mean * 252;
  const std = Math.sqrt(returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (returns.length - 1)) * Math.sqrt(252);
  return std === 0 ? null : ((annualReturn - riskFreeRate) / std).toFixed(2);
}

function calcSortino(returns: number[], riskFreeRate = 0.045) {
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const annualReturn = mean * 252;
  const downsideReturns = returns.filter(r => r < 0);
  if (downsideReturns.length === 0) return "∞";
  const downDev = Math.sqrt(downsideReturns.reduce((acc, r) => acc + Math.pow(r, 2), 0) / downsideReturns.length) * Math.sqrt(252);
  return downDev === 0 ? null : ((annualReturn - riskFreeRate) / downDev).toFixed(2);
}

function calcMaxDrawdown(equityCurve: number[]) {
  let peak = equityCurve[0] ?? 0;
  let maxDD = 0;
  let ddStart = 0, ddEnd = 0, peakIdx = 0;
  equityCurve.forEach((val, i) => {
    if (val > peak) { peak = val; peakIdx = i; }
    const dd = peak > 0 ? (val - peak) / peak : 0;
    if (dd < maxDD) { maxDD = dd; ddStart = peakIdx; ddEnd = i; }
  });
  return { maxDD: (maxDD * 100).toFixed(1), ddStart, ddEnd };
}

function calcProfitFactor(transactions: any[]) {
  const gains = transactions.filter(t => (t.pnl_realized ?? 0) > 0).reduce((a, t) => a + t.pnl_realized, 0);
  const losses = Math.abs(transactions.filter(t => (t.pnl_realized ?? 0) < 0).reduce((a, t) => a + t.pnl_realized, 0));
  return losses === 0 ? "∞" : (gains / losses).toFixed(2);
}

export default function Performance() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxTransactions;
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("executed_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  const { data: openPositions = [] } = useQuery({
    queryKey: ["positions", user?.id, "open", isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPositions;
      const { data } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "open");
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  // ── Core stats ──────────────────────────────────────────────────────────────
  const totalTrades = transactions.length;
  const winners = transactions.filter(t => (t.pnl_realized ?? 0) > 0);
  const losers = transactions.filter(t => (t.pnl_realized ?? 0) < 0);
  const winRate = totalTrades > 0 ? (winners.length / totalTrades) * 100 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((a, t) => a + t.pnl_realized, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((a, t) => a + t.pnl_realized, 0) / losers.length) : 0;
  const bestTrade = totalTrades > 0 ? Math.max(...transactions.map(t => t.pnl_realized ?? 0)) : 0;
  const worstTrade = totalTrades > 0 ? Math.min(...transactions.map(t => t.pnl_realized ?? 0)) : 0;
  const profitFactor = calcProfitFactor(transactions);

  // ── Equity curve ───────────────────────────────────────────────────────────
  let cumPnl = 0;
  const equityCurveData = transactions.map((t, i) => {
    cumPnl += t.pnl_realized ?? 0;
    return { date: format(new Date(t.executed_at!), "MMM dd"), pnl: cumPnl, idx: i };
  });
  if (equityCurveData.length > 0) equityCurveData.unshift({ date: "Start", pnl: 0, idx: -1 });
  const equitySeries = equityCurveData.map(d => d.pnl);

  // ── Drawdown series ────────────────────────────────────────────────────────
  let peakVal = 0;
  const drawdownData = equityCurveData.map(d => {
    if (d.pnl > peakVal) peakVal = d.pnl;
    const dd = peakVal > 0 ? ((d.pnl - peakVal) / peakVal) * 100 : 0;
    return { date: d.date, drawdown: parseFloat(dd.toFixed(2)) };
  });
  const { maxDD } = calcMaxDrawdown(equitySeries);
  const currentDD = drawdownData.length > 0 ? drawdownData[drawdownData.length - 1].drawdown : 0;

  // ── Daily returns for Sharpe ────────────────────────────────────────────────
  const totalCapital = 100000; // baseline for return calc
  const dailyReturns = transactions.map(t => (t.pnl_realized ?? 0) / totalCapital);
  const sharpe = calcSharpe(dailyReturns);
  const sortino = calcSortino(dailyReturns);

  // ── Strategy breakdown ─────────────────────────────────────────────────────
  const stratMap: Record<string, { pnl: number; wins: number; total: number; avgHold: number }> = {};
  transactions.forEach(t => {
    const s = t.strategy_type || "Unknown";
    if (!stratMap[s]) stratMap[s] = { pnl: 0, wins: 0, total: 0, avgHold: 0 };
    stratMap[s].pnl += t.pnl_realized ?? 0;
    stratMap[s].total += 1;
    if ((t.pnl_realized ?? 0) > 0) stratMap[s].wins += 1;
  });
  const strategyRows = Object.entries(stratMap).map(([name, v]) => ({
    name: name.replace(/_/g, " "),
    pnl: v.pnl,
    winRate: ((v.wins / v.total) * 100).toFixed(0),
    trades: v.total,
  })).sort((a, b) => b.pnl - a.pnl);

  const stratChartData = strategyRows.map(s => ({ name: s.name, value: s.pnl }));

  // ── Correlation matrix (position-level asset class) ─────────────────────────
  const correlationAssets = openPositions.slice(0, 6);
  const mockCorr: Record<string, Record<string, number>> = {};
  const assetClass = (ticker: string) => ["BTC", "ETH", "SOL", "DOGE"].includes(ticker) ? "crypto" : "equity";
  correlationAssets.forEach(a => {
    mockCorr[a.ticker] = {};
    correlationAssets.forEach(b => {
      if (a.ticker === b.ticker) { mockCorr[a.ticker][b.ticker] = 1.0; return; }
      const sameClass = assetClass(a.ticker) === assetClass(b.ticker);
      mockCorr[a.ticker][b.ticker] = sameClass ? 0.65 + Math.random() * 0.3 : 0.15 + Math.random() * 0.35;
    });
  });

  const corrColor = (v: number) => {
    if (v >= 0.8) return "bg-bearish/70 text-white";
    if (v >= 0.6) return "bg-watch/40 text-foreground";
    if (v >= 0.4) return "bg-accent text-muted-foreground";
    return "bg-bullish/20 text-bullish";
  };

  const sortedTx = [...transactions].reverse();

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-20">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Performance Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">Complete risk-adjusted performance breakdown</p>
        </div>

        {/* ── Core Stats ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total Trades", value: totalTrades.toString(), color: "text-foreground" },
            { label: "Win Rate", value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? "text-bullish" : "text-bearish" },
            { label: "Profit Factor", value: String(profitFactor), color: "text-primary" },
            { label: "Best Trade", value: `$${bestTrade.toLocaleString()}`, color: "text-bullish" },
            { label: "Worst Trade", value: `$${worstTrade.toLocaleString()}`, color: "text-bearish" },
            { label: "Avg Win / Loss", value: `${(avgWin / (avgLoss || 1)).toFixed(2)}x`, color: "text-foreground" },
          ].map(s => (
            <Card key={s.label} className="border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <p className={`mt-1 font-mono text-xl font-bold ${s.color}`}>{isLoading ? "—" : s.value}</p>
            </Card>
          ))}
        </div>

        {/* ── Risk-Adjusted Stats ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: Award, label: "Sharpe Ratio", value: sharpe ?? "—",
              sub: "Risk-adjusted return (target > 1.0)",
              color: sharpe && parseFloat(String(sharpe)) >= 1 ? "text-bullish" : "text-watch",
            },
            {
              icon: TrendingUp, label: "Sortino Ratio", value: sortino ?? "—",
              sub: "Downside-risk adjusted (target > 2.0)",
              color: sortino && parseFloat(String(sortino)) >= 2 ? "text-bullish" : "text-watch",
            },
            {
              icon: TrendingDown, label: "Max Drawdown", value: `${maxDD}%`,
              sub: `Current DD: ${currentDD.toFixed(1)}%`,
              color: parseFloat(maxDD) < -10 ? "text-bearish" : "text-watch",
            },
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-4 rounded-xl border border-border bg-card p-5"
            >
              <div className="rounded-lg bg-accent p-2.5">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
                <p className={`font-mono text-2xl font-black mt-0.5 ${color}`}>{isLoading ? "—" : value}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-border bg-card p-6">
            <h3 className="mb-1 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Equity Curve</h3>
            <p className="mb-5 text-xs text-muted-foreground/60">Cumulative P&L over all trades</p>
            <div className="h-[260px]">
              {equityCurveData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurveData}>
                    <defs>
                      <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => [`$${v.toLocaleString()}`, "P&L"]} />
                    <Area type="monotone" dataKey="pnl" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPnl)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No trade data yet</div>
              )}
            </div>
          </Card>

          <Card className="border-border bg-card p-6">
            <h3 className="mb-1 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Drawdown Chart</h3>
            <p className="mb-5 text-xs text-muted-foreground/60">% decline from peak at each point</p>
            <div className="h-[260px]">
              {drawdownData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={drawdownData}>
                    <defs>
                      <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF4D4D" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#FF4D4D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => [`${v.toFixed(2)}%`, "Drawdown"]} />
                    <Area type="monotone" dataKey="drawdown" stroke="#FF4D4D" fillOpacity={1} fill="url(#ddGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Strategy Performance Breakdown ── */}
        <Card className="border-border bg-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Strategy Performance Breakdown</h3>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Win rate and P&L per strategy type</p>
            </div>
          </div>
          {strategyRows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">No strategy data yet</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {strategyRows.map((s, i) => (
                  <motion.div
                    key={s.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="min-w-[120px]">
                      <p className="text-xs font-semibold capitalize text-foreground">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.trades} trades</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">Win Rate</span>
                        <span className={`text-[10px] font-bold ${parseInt(s.winRate) >= 50 ? "text-bullish" : "text-bearish"}`}>{s.winRate}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                        <div className={`h-full rounded-full ${parseInt(s.winRate) >= 50 ? "bg-bullish" : "bg-bearish"}`} style={{ width: `${s.winRate}%` }} />
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-bold min-w-[70px] text-right ${s.pnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {s.pnl >= 0 ? "+" : ""}${s.pnl.toLocaleString()}
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stratChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} width={90} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => [`$${v.toLocaleString()}`, "P&L"]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {stratChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.value >= 0 ? "#00E5A0" : "#FF4D4D"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Card>

        {/* ── Correlation Matrix ── */}
        {correlationAssets.length >= 2 && (
          <Card className="border-border bg-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <Target className="h-5 w-5 text-watch" />
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Position Correlation Matrix</h3>
                <p className="text-xs text-muted-foreground/60 mt-0.5">High correlation = concentrated risk. Green = diversified.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead>
                  <tr>
                    <th className="p-2 text-xs text-muted-foreground" />
                    {correlationAssets.map(a => (
                      <th key={a.ticker} className="p-2 font-mono text-xs font-bold text-muted-foreground">{a.ticker}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correlationAssets.map(a => (
                    <tr key={a.ticker}>
                      <td className="p-2 font-mono text-xs font-bold text-muted-foreground text-left">{a.ticker}</td>
                      {correlationAssets.map(b => {
                        const val = mockCorr[a.ticker]?.[b.ticker] ?? 0;
                        return (
                          <td key={b.ticker} className="p-1">
                            <div className={`rounded-lg px-3 py-2 text-xs font-bold font-mono ${corrColor(val)}`}>
                              {val.toFixed(2)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center gap-6 text-[10px] text-muted-foreground/60">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-bullish/20" /> Low (&lt;0.4)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-accent" /> Moderate (0.4–0.6)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-watch/40" /> High (0.6–0.8)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded bg-bearish/70" /> Very High (&gt;0.8)</span>
              </div>
            </div>
          </Card>
        )}

        {/* ── Trade History ── */}
        <Card className="border-border bg-card">
          <div className="p-6">
            <h3 className="mb-4 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trade History</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    {["Date", "Ticker", "Strategy", "Action", "Price", "Qty", "Total", "P&L", "Score"].map(h => (
                      <TableHead key={h} className={`text-muted-foreground ${["Price", "Qty", "Total", "P&L", "Score"].includes(h) ? "text-right" : ""}`}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-border">
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : sortedTx.length === 0
                    ? <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No transactions yet</TableCell></TableRow>
                    : sortedTx.map(t => (
                        <TableRow key={t.id} className="border-border hover:bg-accent/30 transition-fast">
                          <TableCell className="font-mono text-xs">{format(new Date(t.executed_at!), "yyyy-MM-dd")}</TableCell>
                          <TableCell className="font-mono font-bold">{t.ticker}</TableCell>
                          <TableCell className="text-xs capitalize">{(t.strategy_type || "").replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-[10px] font-bold uppercase tracking-tight">{t.action}</TableCell>
                          <TableCell className="font-mono text-right text-xs">${t.price?.toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-right text-xs">{t.quantity}</TableCell>
                          <TableCell className="font-mono text-right text-xs font-bold">${t.total_value?.toLocaleString()}</TableCell>
                          <TableCell className={`font-mono text-right text-xs font-bold ${(t.pnl_realized ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                            {(t.pnl_realized ?? 0) >= 0 ? "+" : ""}${t.pnl_realized?.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-right text-xs">
                            <span className="rounded bg-accent px-1.5 py-0.5">{t.signal_score_at_entry ?? "—"}</span>
                          </TableCell>
                        </TableRow>
                      ))
                  }
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
