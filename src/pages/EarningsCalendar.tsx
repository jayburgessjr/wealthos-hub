import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, AlertTriangle, Clock, BarChart2,
  ChevronDown, ChevronUp, Briefcase, Star, Activity, Info
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { supabase } from "@/integrations/supabase/client";
import { sandboxPositions } from "@/data/sandboxData";

// ── Types ─────────────────────────────────────────────────────────────────────
interface EarningsEntry {
  ticker: string;
  company: string;
  reportDate: string; // "YYYY-MM-DD"
  reportTime: "AMC" | "BMO" | string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
  importance: "high" | "medium" | "low";
}

type FilterTab = "all" | "positions" | "watchlist" | "this_week" | "next_week";

// ── Mock data (fallback + demo) ────────────────────────────────────────────────
const MOCK_EARNINGS: EarningsEntry[] = [
  { ticker: "TSLA", company: "Tesla Inc.",       reportDate: "2026-04-29", reportTime: "AMC", epsEstimate: 0.48,  revenueEstimate: 23.8,  importance: "high" },
  { ticker: "GOOGL",company: "Alphabet",          reportDate: "2026-04-29", reportTime: "AMC", epsEstimate: 2.01,  revenueEstimate: 89.5,  importance: "high" },
  { ticker: "MSFT", company: "Microsoft",         reportDate: "2026-04-30", reportTime: "AMC", epsEstimate: 3.10,  revenueEstimate: 68.4,  importance: "high" },
  { ticker: "META", company: "Meta Platforms",    reportDate: "2026-04-30", reportTime: "AMC", epsEstimate: 5.25,  revenueEstimate: 41.6,  importance: "high" },
  { ticker: "AAPL", company: "Apple Inc.",        reportDate: "2026-05-01", reportTime: "AMC", epsEstimate: 1.62,  revenueEstimate: 94.2,  importance: "high" },
  { ticker: "AMZN", company: "Amazon",            reportDate: "2026-05-02", reportTime: "AMC", epsEstimate: 1.35,  revenueEstimate: 155.0, importance: "high" },
  { ticker: "BTC",  company: "Bitcoin (Coinbase)",reportDate: "2026-05-08", reportTime: "AMC", epsEstimate: null,  revenueEstimate: null,  importance: "medium" },
  { ticker: "COIN", company: "Coinbase",          reportDate: "2026-05-08", reportTime: "AMC", epsEstimate: 1.88,  revenueEstimate: 2.1,   importance: "medium" },
  { ticker: "NVDA", company: "NVIDIA Corp",       reportDate: "2026-05-22", reportTime: "AMC", epsEstimate: 5.58,  revenueEstimate: 43.1,  importance: "high" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function startOfWeek(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day; // Mon-anchored
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return `Week of ${formatDateShort(weekStart)}`;
}

function reportTimeLabel(t: string): string {
  if (t === "AMC") return "After Market Close";
  if (t === "BMO") return "Before Market Open";
  return t;
}

function fmtRevenue(v: number | null): string {
  if (v === null) return "N/A";
  if (v >= 100) return `$${v.toFixed(0)}B`;
  return `$${v.toFixed(1)}B`;
}

function fmtEps(v: number | null): string {
  if (v === null) return "N/A";
  return `$${v.toFixed(2)}`;
}

// ── Impact Meter ──────────────────────────────────────────────────────────────
function ImpactMeter({ importance }: { importance: "high" | "medium" | "low" }) {
  const bars = importance === "high" ? 5 : importance === "medium" ? 3 : 1;
  const color = importance === "high" ? "#ef4444" : importance === "medium" ? "#f59e0b" : "#64748b";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-3 w-1 rounded-sm transition-all"
          style={{
            backgroundColor: i < bars ? color : "#1e293b",
            boxShadow: i < bars ? `0 0 4px ${color}60` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ── Importance Badge ───────────────────────────────────────────────────────────
function ImportanceBadge({ importance }: { importance: "high" | "medium" | "low" }) {
  const cfg = {
    high:   { cls: "border-red-500/30 bg-red-500/10 text-red-400",    label: "HIGH" },
    medium: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", label: "MED" },
    low:    { cls: "border-border bg-accent text-muted-foreground",    label: "LOW" },
  }[importance];
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function EarningsCalendar() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // ── Fetch live positions ──────────────────────────────────────────────────
  const { data: positions = [] } = useQuery({
    queryKey: ["positions", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPositions;
      const { data } = await supabase
        .from("positions")
        .select("ticker, company_name")
        .eq("user_id", user!.id)
        .eq("status", "open");
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  // ── Fetch watchlist ───────────────────────────────────────────────────────
  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) {
        // Demo watchlist tickers cross-referenced from signals
        return [
          { ticker: "AAPL" },
          { ticker: "MSFT" },
          { ticker: "META" },
        ];
      }
      const { data } = await supabase
        .from("watchlist")
        .select("ticker")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  // ── Fetch earnings from Alpha Vantage (with fallback) ─────────────────────
  const { data: earnings = MOCK_EARNINGS } = useQuery<EarningsEntry[]>({
    queryKey: ["earnings_calendar"],
    queryFn: async () => {
      if (isDemoMode) return MOCK_EARNINGS;
      try {
        const res = await fetch(
          "https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=demo"
        );
        if (!res.ok) return MOCK_EARNINGS;
        const text = await res.text();
        if (!text || text.includes("Thank you for using Alpha Vantage")) return MOCK_EARNINGS;
        // Parse CSV response
        const lines = text.trim().split("\n").slice(1); // skip header
        if (!lines.length) return MOCK_EARNINGS;
        const parsed: EarningsEntry[] = lines.slice(0, 50).map(line => {
          const cols = line.split(",");
          return {
            ticker:          cols[0]?.trim() ?? "",
            company:         cols[1]?.trim() ?? "",
            reportDate:      cols[2]?.trim() ?? "",
            reportTime:      cols[3]?.trim() ?? "AMC",
            epsEstimate:     parseFloat(cols[4]) || null,
            revenueEstimate: parseFloat(cols[5]) || null,
            importance:      "medium" as const,
          };
        }).filter(e => e.ticker && e.reportDate && /^\d{4}-\d{2}-\d{2}$/.test(e.reportDate));
        return parsed.length ? parsed : MOCK_EARNINGS;
      } catch {
        return MOCK_EARNINGS;
      }
    },
    staleTime: 1000 * 60 * 30, // 30 min
  });

  // ── Derived sets ──────────────────────────────────────────────────────────
  const positionTickers = useMemo(() => new Set(positions.map((p: any) => p.ticker.toUpperCase())), [positions]);
  const watchlistTickers = useMemo(() => new Set(watchlist.map((w: any) => w.ticker.toUpperCase())), [watchlist]);

  // ── Week boundary helpers ─────────────────────────────────────────────────
  const thisWeekStart = useMemo(() => startOfWeek(today), [today]);
  const nextWeekStart = useMemo(() => {
    const d = new Date(thisWeekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [thisWeekStart]);
  const nextWeekEnd = useMemo(() => {
    const d = new Date(nextWeekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [nextWeekStart]);

  // ── Filter earnings ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return earnings.filter(e => {
      const eDate = parseDate(e.reportDate);
      if (eDate < today) return false; // skip past
      if (activeFilter === "positions")  return positionTickers.has(e.ticker.toUpperCase());
      if (activeFilter === "watchlist")  return watchlistTickers.has(e.ticker.toUpperCase());
      if (activeFilter === "this_week")  return eDate >= thisWeekStart && eDate < nextWeekStart;
      if (activeFilter === "next_week")  return eDate >= nextWeekStart && eDate <= nextWeekEnd;
      return true;
    });
  }, [earnings, activeFilter, positionTickers, watchlistTickers, today, thisWeekStart, nextWeekStart, nextWeekEnd]);

  // ── Group by week ─────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map: Map<string, EarningsEntry[]> = new Map();
    const sorted = [...filtered].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
    sorted.forEach(e => {
      const ws = startOfWeek(parseDate(e.reportDate));
      const key = ws.toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      weekStart: new Date(key),
      items,
    }));
  }, [filtered]);

  // ── Impact warnings (< 7 days, in portfolio or watchlist) ─────────────────
  const warnings = useMemo(() => {
    return earnings
      .filter(e => {
        const eDate = parseDate(e.reportDate);
        const days = daysBetween(today, eDate);
        return days >= 0 && days < 7 && (positionTickers.has(e.ticker) || watchlistTickers.has(e.ticker));
      })
      .sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  }, [earnings, today, positionTickers, watchlistTickers]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = today;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const thisMonthReports = earnings.filter(e => {
      const d = parseDate(e.reportDate);
      return d >= now && d <= monthEnd;
    });
    const thisWeekReports = earnings.filter(e => {
      const d = parseDate(e.reportDate);
      return d >= thisWeekStart && d < nextWeekStart;
    });
    const portfolioReports = earnings.filter(e => positionTickers.has(e.ticker));
    const epsEstimates = earnings.filter(e => e.epsEstimate !== null).map(e => e.epsEstimate as number);
    const avgEps = epsEstimates.length
      ? (epsEstimates.reduce((a, b) => a + b, 0) / epsEstimates.length).toFixed(2)
      : "N/A";

    return {
      thisMonth: thisMonthReports.length,
      thisWeek: thisWeekReports.length,
      inPortfolio: portfolioReports.length,
      avgEps,
    };
  }, [earnings, today, thisWeekStart, nextWeekStart, positionTickers]);

  // ── Date range label ──────────────────────────────────────────────────────
  const rangeLabel = useMemo(() => {
    const end = new Date(today);
    end.setMonth(end.getMonth() + 3);
    return `${formatDateShort(today)} — ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }, [today]);

  const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: "all",       label: "All" },
    { id: "positions", label: "My Positions" },
    { id: "watchlist", label: "My Watchlist" },
    { id: "this_week", label: "This Week" },
    { id: "next_week", label: "Next Week" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <CalendarDays size={12} className="text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Earnings Intelligence
              </span>
            </div>
            <h2 className="font-display text-3xl font-black tracking-tight">Earnings Calendar</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{rangeLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
            <Activity size={12} className="text-amber-400" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
              {earnings === MOCK_EARNINGS ? "Mock Data" : "Live"}
            </span>
          </div>
        </div>

        {/* ── Stats Row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Reports This Month", value: String(stats.thisMonth),  color: "text-foreground"    },
            { label: "Reports This Week",  value: String(stats.thisWeek),   color: "text-blue-400"      },
            { label: "In Your Portfolio",  value: String(stats.inPortfolio),color: "text-emerald-400"   },
            { label: "Avg EPS Estimate",   value: stats.avgEps === "N/A" ? "N/A" : `$${stats.avgEps}`, color: "text-amber-400" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <p className={`mt-1 font-mono text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Impact Warnings ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {warnings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-2"
            >
              {warnings.map(w => {
                const days = daysBetween(today, parseDate(w.reportDate));
                const inPortfolio = positionTickers.has(w.ticker);
                return (
                  <div
                    key={`warn-${w.ticker}`}
                    className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3"
                  >
                    <AlertTriangle size={14} className="shrink-0 text-red-400" />
                    <p className="flex-1 font-mono text-xs text-red-300">
                      <span className="font-black">{w.ticker}</span> ({w.company}) reports in{" "}
                      <span className="font-black">{days === 0 ? "today" : `${days} day${days !== 1 ? "s" : ""}`}</span>
                      {" "}—{" "}
                      {inPortfolio ? "review your position before earnings" : "watchlisted asset reporting soon"}
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                      {inPortfolio && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase text-emerald-400">
                          In Portfolio
                        </span>
                      )}
                      {watchlistTickers.has(w.ticker) && !inPortfolio && (
                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase text-blue-400">
                          Watchlisted
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter Tabs ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`rounded-lg border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide transition-all ${
                activeFilter === tab.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Grouped Earnings List ──────────────────────────────────────────── */}
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20">
            <CalendarDays size={32} className="text-muted-foreground/20" />
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/50">
              No earnings found for this filter
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(({ weekStart, items }, gi) => (
              <motion.div
                key={weekStart.toISOString()}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.06 }}
              >
                {/* Week header */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {formatWeekLabel(weekStart)}
                  </span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>

                <div className="space-y-2">
                  {items.map((entry, i) => {
                    const eDate = parseDate(entry.reportDate);
                    const daysAway = daysBetween(today, eDate);
                    const isUrgent = daysAway < 7;
                    const inPortfolio = positionTickers.has(entry.ticker.toUpperCase());
                    const isWatchlisted = watchlistTickers.has(entry.ticker.toUpperCase());
                    const isExpanded = expandedTicker === entry.ticker;

                    return (
                      <motion.div
                        key={`${entry.ticker}-${entry.reportDate}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: gi * 0.06 + i * 0.04 }}
                        className={`overflow-hidden rounded-2xl border transition-all ${
                          isUrgent && (inPortfolio || isWatchlisted)
                            ? "border-red-500/30 bg-red-500/5"
                            : inPortfolio
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : isWatchlisted
                            ? "border-blue-500/20 bg-blue-500/5"
                            : "border-border bg-card"
                        }`}
                      >
                        <button
                          onClick={() => setExpandedTicker(isExpanded ? null : entry.ticker)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-4 p-4">
                            {/* Ticker + company */}
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                              <div className="shrink-0">
                                <p className="font-mono text-lg font-black text-foreground leading-none">
                                  {entry.ticker}
                                </p>
                                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                                  {entry.company}
                                </p>
                              </div>

                              {/* Date + time */}
                              <div className="hidden sm:block shrink-0">
                                <p className="font-mono text-xs font-bold text-foreground">
                                  {eDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                </p>
                                <p className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                                  <Clock size={8} />
                                  {reportTimeLabel(entry.reportTime)}
                                </p>
                              </div>

                              {/* Portfolio / Watchlist badges */}
                              <div className="flex flex-wrap gap-1">
                                {inPortfolio && (
                                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[8px] font-black uppercase text-emerald-400">
                                    <Briefcase size={7} /> In Portfolio
                                  </span>
                                )}
                                {isWatchlisted && (
                                  <span className="flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 font-mono text-[8px] font-black uppercase text-blue-400">
                                    <Star size={7} /> Watchlisted
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right side: estimates + impact + days */}
                            <div className="flex shrink-0 items-center gap-5">
                              {/* EPS */}
                              <div className="hidden md:block text-right">
                                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">EPS Est.</p>
                                <p className="font-mono text-sm font-black text-foreground">{fmtEps(entry.epsEstimate)}</p>
                              </div>

                              {/* Revenue */}
                              <div className="hidden md:block text-right">
                                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Rev Est.</p>
                                <p className="font-mono text-sm font-black text-foreground">{fmtRevenue(entry.revenueEstimate)}</p>
                              </div>

                              {/* Importance + impact meter */}
                              <div className="flex flex-col items-end gap-1.5">
                                <ImportanceBadge importance={entry.importance} />
                                <ImpactMeter importance={entry.importance} />
                              </div>

                              {/* Days away */}
                              <div className="text-right min-w-[60px]">
                                <p
                                  className={`font-mono text-sm font-black ${
                                    isUrgent ? "text-red-400" : "text-muted-foreground"
                                  }`}
                                >
                                  {daysAway === 0 ? "Today" : `${daysAway}d`}
                                </p>
                                <p className="font-mono text-[8px] uppercase text-muted-foreground/60">
                                  {daysAway === 0 ? "reporting" : "away"}
                                </p>
                              </div>

                              {/* Expand chevron */}
                              {isExpanded
                                ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" />
                                : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                              }
                            </div>
                          </div>
                        </button>

                        {/* Expanded detail panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-border/40 px-4 pb-5 pt-4">
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                  <div>
                                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Report Date</p>
                                    <p className="mt-1 font-mono text-sm font-bold text-foreground">
                                      {eDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Report Time</p>
                                    <p className="mt-1 font-mono text-sm font-bold text-foreground">{reportTimeLabel(entry.reportTime)}</p>
                                  </div>
                                  <div>
                                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">EPS Estimate</p>
                                    <p className="mt-1 font-mono text-sm font-bold text-amber-400">{fmtEps(entry.epsEstimate)}</p>
                                  </div>
                                  <div>
                                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Revenue Estimate</p>
                                    <p className="mt-1 font-mono text-sm font-bold text-amber-400">{fmtRevenue(entry.revenueEstimate)}</p>
                                  </div>
                                </div>

                                {/* Potential impact section */}
                                <div className="mt-4 flex items-start gap-3 rounded-xl border border-border/50 bg-accent/40 px-4 py-3">
                                  <BarChart2 size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                                  <div>
                                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                      Potential Market Impact
                                    </p>
                                    <div className="mt-1.5 flex items-center gap-3">
                                      <ImpactMeter importance={entry.importance} />
                                      <span className={`font-mono text-xs font-bold ${
                                        entry.importance === "high" ? "text-red-400"
                                        : entry.importance === "medium" ? "text-amber-400"
                                        : "text-muted-foreground"
                                      }`}>
                                        {entry.importance === "high" ? "High volatility expected — options premiums may spike"
                                          : entry.importance === "medium" ? "Moderate impact — watch for gap opens"
                                          : "Low expected impact"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {inPortfolio && (
                                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
                                    <AlertTriangle size={12} className="shrink-0 text-amber-400" />
                                    <p className="font-mono text-[10px] text-amber-300">
                                      You hold <span className="font-black">{entry.ticker}</span> in your portfolio. Consider reviewing your position size and setting stop-losses before the earnings release.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Footer disclaimer ──────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-card p-4">
          <Info size={13} className="mt-0.5 shrink-0 text-muted-foreground/60" />
          <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground/50">
            Earnings dates and estimates are illustrative. Live data sourced from Alpha Vantage free tier when available. Always verify dates with official filings before making trading decisions.
          </p>
        </div>

      </div>
    </DashboardLayout>
  );
}
