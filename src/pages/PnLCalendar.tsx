import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, startOfYear, endOfYear, eachDayOfInterval, getDay, startOfWeek, addWeeks, isSameMonth } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DayPnL {
  date: string; // "YYYY-MM-DD"
  pnl: number;
}

// ---------------------------------------------------------------------------
// Demo data generator — 365 days of realistic P&L
// ---------------------------------------------------------------------------
function generateDemoPnL(): DayPnL[] {
  const today = new Date();
  const yearStart = startOfYear(today);
  const yearEnd = endOfYear(today);
  const days = eachDayOfInterval({ start: yearStart, end: yearEnd });

  // Seed with a deterministic-ish set so it looks consistent on re-renders
  return days.map((day, i) => {
    const weekday = getDay(day);
    // No trades on weekends
    if (weekday === 0 || weekday === 6) return { date: format(day, "yyyy-MM-dd"), pnl: 0 };
    // Future dates: no data
    if (day > today) return { date: format(day, "yyyy-MM-dd"), pnl: 0 };

    // Pseudo-random but seeded by index for consistency in the same session
    const seed = Math.sin(i * 9301 + 49297) * 0.5 + 0.5;
    const seed2 = Math.sin(i * 233 + 1) * 0.5 + 0.5;

    // ~65% green days, ~25% red, ~10% flat
    if (seed < 0.10) return { date: format(day, "yyyy-MM-dd"), pnl: 0 };
    if (seed < 0.35) {
      // loss day — mostly small
      const magnitude = seed2 < 0.15 ? -(800 + seed2 * 2400) : -(50 + seed2 * 600);
      return { date: format(day, "yyyy-MM-dd"), pnl: Math.round(magnitude) };
    }
    // gain day — occasional big winners
    const magnitude = seed2 > 0.92 ? (1200 + seed2 * 3800) : (25 + seed2 * 450);
    return { date: format(day, "yyyy-MM-dd"), pnl: Math.round(magnitude) };
  });
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
const GAIN_COLORS = [
  "rgba(0,229,160,0.18)",
  "rgba(0,229,160,0.38)",
  "rgba(0,229,160,0.62)",
  "rgba(0,229,160,0.82)",
  "#00E5A0",
] as const;

const LOSS_COLORS = [
  "rgba(239,68,68,0.18)",
  "rgba(239,68,68,0.38)",
  "rgba(239,68,68,0.62)",
  "rgba(239,68,68,0.82)",
  "rgb(239,68,68)",
] as const;

function pnlColor(pnl: number, maxGain: number, maxLoss: number): string {
  if (pnl === 0) return "rgba(255,255,255,0.06)";
  if (pnl > 0) {
    const idx = Math.min(4, Math.floor((pnl / maxGain) * 5));
    return GAIN_COLORS[idx];
  }
  const idx = Math.min(4, Math.floor((Math.abs(pnl) / Math.abs(maxLoss)) * 5));
  return LOSS_COLORS[idx];
}

// ---------------------------------------------------------------------------
// Calendar grid builder
// ---------------------------------------------------------------------------
interface CalendarWeek {
  weekStart: Date;
  days: (DayPnL | null)[]; // 7 slots, null = padding
}

function buildCalendarGrid(pnlMap: Map<string, number>, year: number): { weeks: CalendarWeek[]; months: { label: string; col: number }[] } {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const calStart = startOfWeek(yearStart, { weekStartsOn: 0 });

  const weeks: CalendarWeek[] = [];
  const months: { label: string; col: number }[] = [];
  let cursor = calStart;
  let colIdx = 0;
  let lastMonth = -1;

  while (cursor <= yearEnd || weeks.length < 53) {
    const days: (DayPnL | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const dayDate = addWeeks(cursor, 0);
      const loopDay = new Date(cursor);
      loopDay.setDate(cursor.getDate() + d);
      if (loopDay < yearStart || loopDay > yearEnd) {
        days.push(null);
      } else {
        const key = format(loopDay, "yyyy-MM-dd");
        days.push({ date: key, pnl: pnlMap.get(key) ?? 0 });
      }
    }

    // Track month labels — use first non-null day in week
    for (let d = 0; d < 7; d++) {
      const loopDay = new Date(cursor);
      loopDay.setDate(cursor.getDate() + d);
      if (loopDay >= yearStart && loopDay <= yearEnd) {
        const m = loopDay.getMonth();
        if (m !== lastMonth) {
          months.push({ label: format(loopDay, "MMM"), col: colIdx });
          lastMonth = m;
        }
        break;
      }
    }

    weeks.push({ weekStart: new Date(cursor), days });
    cursor = addWeeks(cursor, 1);
    colIdx++;
    if (weeks.length >= 53) break;
  }

  return { weeks, months };
}

// ---------------------------------------------------------------------------
// Tooltip component
// ---------------------------------------------------------------------------
interface TooltipState {
  date: string;
  pnl: number;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function PnLCalendar() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const currentYear = new Date().getFullYear();

  // --- Data fetch ---
  const { data: rawPnL = [], isLoading } = useQuery<DayPnL[]>({
    queryKey: ["pnl-calendar", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return generateDemoPnL();

      const { data } = await supabase
        .from("transactions")
        .select("executed_at, pnl_realized")
        .eq("user_id", user!.id)
        .order("executed_at", { ascending: true });

      if (!data) return [];

      // Group by date, sum pnl_realized
      const grouped: Record<string, number> = {};
      data.forEach((t) => {
        if (!t.executed_at) return;
        const key = format(new Date(t.executed_at), "yyyy-MM-dd");
        grouped[key] = (grouped[key] ?? 0) + (t.pnl_realized ?? 0);
      });

      return Object.entries(grouped).map(([date, pnl]) => ({ date, pnl }));
    },
    enabled: !!user || isDemoMode,
  });

  // --- Derived stats ---
  const { pnlMap, stats, monthlyData, maxGain, maxLoss } = useMemo(() => {
    const pnlMap = new Map<string, number>();
    rawPnL.forEach((d) => pnlMap.set(d.date, d.pnl));

    const tradingDays = rawPnL.filter((d) => d.pnl !== 0);
    const greenDays = tradingDays.filter((d) => d.pnl > 0);
    const redDays = tradingDays.filter((d) => d.pnl < 0);

    const bestDay = tradingDays.length > 0 ? Math.max(...tradingDays.map((d) => d.pnl)) : 0;
    const worstDay = tradingDays.length > 0 ? Math.min(...tradingDays.map((d) => d.pnl)) : 0;
    const winDayRate = tradingDays.length > 0 ? (greenDays.length / tradingDays.length) * 100 : 0;

    const maxGain = bestDay > 0 ? bestDay : 1;
    const maxLoss = worstDay < 0 ? Math.abs(worstDay) : 1;

    // Monthly totals
    const monthMap: Record<string, number> = {};
    rawPnL.forEach((d) => {
      const m = format(new Date(d.date), "MMM");
      monthMap[m] = (monthMap[m] ?? 0) + d.pnl;
    });
    const monthOrder = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyData = monthOrder
      .filter((m) => monthMap[m] !== undefined)
      .map((m) => ({ month: m, pnl: monthMap[m] }));

    return {
      pnlMap,
      stats: { bestDay, worstDay, greenDays: greenDays.length, redDays: redDays.length, winDayRate },
      monthlyData,
      maxGain,
      maxLoss,
    };
  }, [rawPnL]);

  const { weeks, months } = useMemo(() => buildCalendarGrid(pnlMap, currentYear), [pnlMap, currentYear]);

  const DAY_SIZE = 13;
  const DAY_GAP = 2;
  const CELL = DAY_SIZE + DAY_GAP;

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Page header */}
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">P&amp;L Calendar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your daily performance history</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard
              label="Best Day"
              value={`+$${stats.bestDay.toLocaleString()}`}
              color="text-bullish"
              isLoading={isLoading}
            />
            <StatCard
              label="Worst Day"
              value={`-$${Math.abs(stats.worstDay).toLocaleString()}`}
              color="text-bearish"
              isLoading={isLoading}
            />
            <StatCard
              label="Green Days"
              value={stats.greenDays.toString()}
              color="text-bullish"
              isLoading={isLoading}
            />
            <StatCard
              label="Red Days"
              value={stats.redDays.toString()}
              color="text-bearish"
              isLoading={isLoading}
            />
            <StatCard
              label="Win Day Rate"
              value={`${stats.winDayRate.toFixed(1)}%`}
              color={stats.winDayRate >= 50 ? "text-bullish" : "text-bearish"}
              isLoading={isLoading}
            />
          </div>

          {/* Heatmap calendar */}
          <Card className="border-border bg-card p-6">
            <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Daily P&amp;L Heatmap — {currentYear}
            </h3>

            {isLoading ? (
              <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
                Loading calendar…
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="relative" style={{ minWidth: weeks.length * CELL + 32 }}>
                  {/* Month labels */}
                  <div className="relative mb-1 ml-8" style={{ height: 16 }}>
                    {months.map((m) => (
                      <span
                        key={m.label + m.col}
                        className="absolute text-[10px] text-muted-foreground"
                        style={{ left: m.col * CELL }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>

                  <div className="flex">
                    {/* Day-of-week labels */}
                    <div className="mr-1 flex flex-col" style={{ gap: DAY_GAP }}>
                      {["Su","Mo","Tu","We","Th","Fr","Sa"].map((label, i) => (
                        <div
                          key={label}
                          className="flex items-center justify-end text-[9px] text-muted-foreground"
                          style={{ height: DAY_SIZE, lineHeight: `${DAY_SIZE}px` }}
                        >
                          {i % 2 === 1 ? label : ""}
                        </div>
                      ))}
                    </div>

                    {/* Grid of weeks */}
                    <div className="flex" style={{ gap: DAY_GAP }}>
                      {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col" style={{ gap: DAY_GAP }}>
                          {week.days.map((day, di) => {
                            if (!day) {
                              return (
                                <div
                                  key={di}
                                  style={{ width: DAY_SIZE, height: DAY_SIZE }}
                                />
                              );
                            }
                            const color = pnlColor(day.pnl, maxGain, maxLoss);
                            return (
                              <div
                                key={di}
                                style={{
                                  width: DAY_SIZE,
                                  height: DAY_SIZE,
                                  backgroundColor: color,
                                  borderRadius: 2,
                                  cursor: day.pnl !== 0 ? "pointer" : "default",
                                  transition: "opacity 0.1s",
                                }}
                                onMouseEnter={(e) => {
                                  if (day.pnl === 0) return;
                                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                                  setTooltip({ date: day.date, pnl: day.pnl, x: rect.left, y: rect.top });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="ml-8 mt-3 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Less</span>
                    {GAIN_COLORS.map((c, i) => (
                      <div
                        key={i}
                        style={{ width: 11, height: 11, backgroundColor: c, borderRadius: 2 }}
                      />
                    ))}
                    <span className="text-[10px] text-muted-foreground mx-1">|</span>
                    {LOSS_COLORS.map((c, i) => (
                      <div
                        key={i}
                        style={{ width: 11, height: 11, backgroundColor: c, borderRadius: 2 }}
                      />
                    ))}
                    <span className="text-[10px] text-muted-foreground">More</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Monthly bar chart */}
          <Card className="border-border bg-card p-6">
            <h3 className="mb-6 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly P&amp;L Summary
            </h3>
            <div className="h-[240px] w-full">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${(v as number).toLocaleString()}`}
                      width={72}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      cursor={{ fill: "hsl(var(--accent))", opacity: 0.12 }}
                      formatter={(value: number) => [
                        `${value >= 0 ? "+" : ""}$${value.toLocaleString()}`,
                        "Monthly P&L",
                      ]}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {monthlyData.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={entry.pnl >= 0 ? "hsl(var(--bullish))" : "hsl(var(--bearish))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {isLoading ? "Loading…" : "No monthly data available yet"}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </SubscriptionGate>

      {/* Floating tooltip rendered at window level via fixed position */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-border bg-card px-3 py-2 shadow-lg"
          style={{ left: tooltip.x + 18, top: tooltip.y - 8 }}
        >
          <p className="text-[11px] text-muted-foreground">{tooltip.date}</p>
          <p
            className={`font-mono text-sm font-bold ${
              tooltip.pnl >= 0 ? "text-bullish" : "text-bearish"
            }`}
          >
            {tooltip.pnl >= 0 ? "+" : ""}${tooltip.pnl.toLocaleString()}
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  color,
  isLoading,
}: {
  label: string;
  value: string;
  color?: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {isLoading ? (
        <div className="mt-1 h-7 w-24 animate-pulse rounded bg-accent" />
      ) : (
        <p className={`mt-1 font-mono text-xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
      )}
    </Card>
  );
}
