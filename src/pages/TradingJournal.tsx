import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  BookOpen, Plus, TrendingUp, TrendingDown, Star, Check, X,
  ChevronLeft, Filter, CalendarDays,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";

// ── Types ───────────────────────────────────────────────────────────────────
type Direction = "long" | "short";
type EmotionTag =
  | "disciplined"
  | "confident"
  | "fomo"
  | "revenge"
  | "patient"
  | "anxious"
  | "greedy";

interface JournalEntry {
  id: string;
  user_id: string;
  trade_date: string;
  ticker: string;
  direction: Direction;
  entry_price: number | null;
  exit_price: number | null;
  pnl_dollars: number;
  pnl_percent: number;
  emotion_tag: EmotionTag | null;
  setup_quality: number | null;
  followed_plan: boolean;
  notes: string | null;
  lessons: string | null;
  created_at: string;
}

// ── Demo data ────────────────────────────────────────────────────────────────
const demoEntries: JournalEntry[] = [
  {
    id: "demo-j1",
    user_id: "demo",
    trade_date: "2026-04-20",
    ticker: "NVDA",
    direction: "long",
    entry_price: 812.50,
    exit_price: 912.00,
    pnl_dollars: 2840,
    pnl_percent: 12.3,
    emotion_tag: "disciplined",
    setup_quality: 5,
    followed_plan: true,
    notes: "Clean breakout above the $810 resistance on heavy volume. Waited for the retest before entering. Held through minor pullback with conviction.",
    lessons: "Let winners run. When the setup is A+, size up.",
    created_at: "2026-04-20T14:32:00Z",
  },
  {
    id: "demo-j2",
    user_id: "demo",
    trade_date: "2026-04-15",
    ticker: "TSLA",
    direction: "long",
    entry_price: 175.40,
    exit_price: 170.85,
    pnl_dollars: -480,
    pnl_percent: -2.6,
    emotion_tag: "fomo",
    setup_quality: 2,
    followed_plan: false,
    notes: "Chased the breakout too late — entered 45 minutes after the move already happened. No clear invalidation level set.",
    lessons: "Wait for the retest. FOMO entries rarely work. If you miss it, find the next setup.",
    created_at: "2026-04-15T10:15:00Z",
  },
  {
    id: "demo-j3",
    user_id: "demo",
    trade_date: "2026-04-12",
    ticker: "AAPL",
    direction: "long",
    entry_price: 172.20,
    exit_price: 186.90,
    pnl_dollars: 1470,
    pnl_percent: 8.5,
    emotion_tag: "patient",
    setup_quality: 4,
    followed_plan: true,
    notes: "Earnings play. Bought 2 weeks before, sold day before earnings to capture the run-up. Position sized conservatively at 3% of portfolio.",
    lessons: "The pre-earnings drift strategy works well on AAPL. Avoid holding through the actual report.",
    created_at: "2026-04-12T09:45:00Z",
  },
  {
    id: "demo-j4",
    user_id: "demo",
    trade_date: "2026-04-08",
    ticker: "SPY",
    direction: "short",
    entry_price: 520.00,
    exit_price: 505.50,
    pnl_dollars: 3625,
    pnl_percent: 5.6,
    emotion_tag: "confident",
    setup_quality: 4,
    followed_plan: true,
    notes: "Macro hedge going into CPI print. VIX was suppressed, breadth diverging, and we were at resistance. Textbook distribution pattern.",
    lessons: "Macro setups take longer to play out but are high conviction. Be patient and right-size.",
    created_at: "2026-04-08T11:00:00Z",
  },
  {
    id: "demo-j5",
    user_id: "demo",
    trade_date: "2026-04-03",
    ticker: "COIN",
    direction: "long",
    entry_price: 198.00,
    exit_price: 182.50,
    pnl_dollars: -930,
    pnl_percent: -7.8,
    emotion_tag: "revenge",
    setup_quality: 1,
    followed_plan: false,
    notes: "Lost on TSLA earlier in the week and tried to make it back quickly. Jumped into COIN with no clear setup. Doubled down when it went against me.",
    lessons: "Never trade to recover losses. Each trade is independent. Walk away after two losses in a day.",
    created_at: "2026-04-03T14:00:00Z",
  },
  {
    id: "demo-j6",
    user_id: "demo",
    trade_date: "2026-03-28",
    ticker: "MSFT",
    direction: "long",
    entry_price: 415.00,
    exit_price: 438.60,
    pnl_dollars: 2360,
    pnl_percent: 5.7,
    emotion_tag: "disciplined",
    setup_quality: 5,
    followed_plan: true,
    notes: "AI capex cycle thesis trade. Bought on pullback to 50-day MA with tight stop below the low. Held for 10 days through noise.",
    lessons: "When the thesis is intact and price holds the level, hold the position. Don't shake yourself out.",
    created_at: "2026-03-28T09:32:00Z",
  },
  {
    id: "demo-j7",
    user_id: "demo",
    trade_date: "2026-03-20",
    ticker: "BTC",
    direction: "long",
    entry_price: 82000,
    exit_price: 91500,
    pnl_dollars: 4750,
    pnl_percent: 11.6,
    emotion_tag: "anxious",
    setup_quality: 3,
    followed_plan: true,
    notes: "Halving cycle trade. Was anxious the whole time due to crypto volatility, checked price constantly. Setup was valid but execution was emotional.",
    lessons: "If a trade is causing anxiety, size is too large. Always trade position sizes that let you sleep.",
    created_at: "2026-03-20T16:20:00Z",
  },
];

// ── Emotion config ───────────────────────────────────────────────────────────
const EMOTION_CONFIG: Record<EmotionTag, { label: string; color: string; bg: string; icon: string }> = {
  disciplined: { label: "DISCIPLINED", color: "text-bullish", bg: "bg-bullish/10 border-bullish/30", icon: "🟢" },
  confident:   { label: "CONFIDENT",   color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30", icon: "🔵" },
  patient:     { label: "PATIENT",     color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", icon: "🟢" },
  fomo:        { label: "FOMO",        color: "text-bearish", bg: "bg-bearish/10 border-bearish/30", icon: "🔴" },
  anxious:     { label: "ANXIOUS",     color: "text-watch", bg: "bg-watch/10 border-watch/30", icon: "🟡" },
  revenge:     { label: "REVENGE",     color: "text-bearish", bg: "bg-bearish/10 border-bearish/30", icon: "🔴" },
  greedy:      { label: "GREEDY",      color: "text-watch", bg: "bg-watch/10 border-watch/30", icon: "🟡" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcPnl(entryPrice: string, exitPrice: string) {
  const ep = parseFloat(entryPrice);
  const xp = parseFloat(exitPrice);
  if (!ep || !xp) return { pnlDollars: 0, pnlPercent: 0 };
  const pnlDollars = xp - ep;
  const pnlPercent = ((xp - ep) / ep) * 100;
  return { pnlDollars: parseFloat(pnlDollars.toFixed(2)), pnlPercent: parseFloat(pnlPercent.toFixed(2)) };
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          className={`transition-colors ${onChange ? "cursor-pointer hover:scale-110" : "cursor-default"} ${s <= value ? "text-watch" : "text-muted-foreground/30"}`}
        >
          <Star size={14} fill={s <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function TradingJournal() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const queryClient = useQueryClient();

  // ── View state ───────────────────────────────────────────────────────────
  const [view, setView] = useState<"list" | "add">("list");

  // ── Filter state ─────────────────────────────────────────────────────────
  const [filterEmotion, setFilterEmotion] = useState<EmotionTag | "">("");
  const [filterTicker, setFilterTicker] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // ── Form state ───────────────────────────────────────────────────────────
  const [formTradeDate, setFormTradeDate] = useState(new Date().toISOString().split("T")[0]);
  const [formTicker, setFormTicker] = useState("");
  const [formDirection, setFormDirection] = useState<Direction>("long");
  const [formEntryPrice, setFormEntryPrice] = useState("");
  const [formExitPrice, setFormExitPrice] = useState("");
  const [formPnlDollars, setFormPnlDollars] = useState("");
  const [formPnlPercent, setFormPnlPercent] = useState("");
  const [formEmotion, setFormEmotion] = useState<EmotionTag | "">("");
  const [formQuality, setFormQuality] = useState(3);
  const [formFollowedPlan, setFormFollowedPlan] = useState(true);
  const [formNotes, setFormNotes] = useState("");
  const [formLessons, setFormLessons] = useState("");

  // Auto-calc P&L when prices change
  const handlePriceChange = (entry: string, exit: string) => {
    if (entry && exit) {
      const { pnlDollars, pnlPercent } = calcPnl(entry, exit);
      setFormPnlDollars(String(pnlDollars));
      setFormPnlPercent(String(pnlPercent));
    }
  };

  // ── Query ────────────────────────────────────────────────────────────────
  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["journal_entries", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return demoEntries;
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", user!.id)
        .order("trade_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as JournalEntry[];
    },
    enabled: !!user || isDemoMode,
  });

  // ── Mutation ─────────────────────────────────────────────────────────────
  const { mutate: saveEntry, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      if (!formTicker.trim()) throw new Error("Ticker is required");
      const { error } = await supabase.from("journal_entries").insert({
        user_id: user!.id,
        trade_date: formTradeDate,
        ticker: formTicker.toUpperCase(),
        direction: formDirection,
        entry_price: parseFloat(formEntryPrice) || null,
        exit_price: parseFloat(formExitPrice) || null,
        pnl_dollars: parseFloat(formPnlDollars) || 0,
        pnl_percent: parseFloat(formPnlPercent) || 0,
        emotion_tag: formEmotion || null,
        setup_quality: formQuality,
        followed_plan: formFollowedPlan,
        notes: formNotes || null,
        lessons: formLessons || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      toast.success(`Journal entry saved for ${formTicker.toUpperCase()}`);
      // Reset form
      setFormTicker("");
      setFormEntryPrice("");
      setFormExitPrice("");
      setFormPnlDollars("");
      setFormPnlPercent("");
      setFormEmotion("");
      setFormQuality(3);
      setFormFollowedPlan(true);
      setFormNotes("");
      setFormLessons("");
      setView("list");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to save entry"),
  });

  // ── Derived stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!entries.length) return { total: 0, winRate: 0, avgQuality: 0, followedPlanPct: 0 };
    const winners = entries.filter((e) => e.pnl_dollars > 0).length;
    const withQuality = entries.filter((e) => e.setup_quality !== null);
    const avgQuality = withQuality.length
      ? withQuality.reduce((a, e) => a + (e.setup_quality ?? 0), 0) / withQuality.length
      : 0;
    const followedCount = entries.filter((e) => e.followed_plan).length;
    return {
      total: entries.length,
      winRate: (winners / entries.length) * 100,
      avgQuality,
      followedPlanPct: (followedCount / entries.length) * 100,
    };
  }, [entries]);

  // ── Filtered entries ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterEmotion && e.emotion_tag !== filterEmotion) return false;
      if (filterTicker && !e.ticker.toLowerCase().includes(filterTicker.toLowerCase())) return false;
      if (filterDateFrom && e.trade_date < filterDateFrom) return false;
      if (filterDateTo && e.trade_date > filterDateTo) return false;
      return true;
    });
  }, [entries, filterEmotion, filterTicker, filterDateFrom, filterDateTo]);

  const hasFilters = !!(filterEmotion || filterTicker || filterDateFrom || filterDateTo);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen size={12} className="text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Analysis
            </span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">Trading Journal</h2>
        </div>

        {view === "list" ? (
          <button
            onClick={() => setView("add")}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-mono text-sm font-bold text-background transition-all hover:brightness-110"
          >
            <Plus size={14} />
            New Entry
          </button>
        ) : (
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-mono text-sm font-bold text-foreground transition-all hover:bg-accent"
          >
            <ChevronLeft size={14} />
            Back to Journal
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── Stats row ── */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Entries", val: stats.total, suffix: "", color: "text-foreground" },
                { label: "Win Rate", val: stats.winRate.toFixed(1), suffix: "%", color: stats.winRate >= 50 ? "text-bullish" : "text-bearish" },
                { label: "Avg Setup Quality", val: stats.avgQuality.toFixed(1), suffix: "/5", color: "text-watch" },
                { label: "Followed Plan", val: stats.followedPlanPct.toFixed(0), suffix: "%", color: stats.followedPlanPct >= 70 ? "text-bullish" : "text-watch" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </span>
                  <span className={`font-mono text-2xl font-black ${s.color}`}>
                    {s.val}
                    <span className="text-base font-medium text-muted-foreground">{s.suffix}</span>
                  </span>
                </div>
              ))}
            </div>

            {/* ── Filter bar ── */}
            <div className="mb-5 rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Filter size={12} className="text-muted-foreground" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Filters
                </span>
                {hasFilters && (
                  <button
                    onClick={() => {
                      setFilterEmotion("");
                      setFilterTicker("");
                      setFilterDateFrom("");
                      setFilterDateTo("");
                    }}
                    className="ml-auto font-mono text-[10px] uppercase text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Ticker
                  </label>
                  <input
                    value={filterTicker}
                    onChange={(e) => setFilterTicker(e.target.value.toUpperCase())}
                    placeholder="NVDA"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm uppercase text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Emotion
                  </label>
                  <select
                    value={filterEmotion}
                    onChange={(e) => setFilterEmotion(e.target.value as EmotionTag | "")}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none"
                  >
                    <option value="">All emotions</option>
                    {(Object.keys(EMOTION_CONFIG) as EmotionTag[]).map((k) => (
                      <option key={k} value={k}>
                        {EMOTION_CONFIG[k].icon} {EMOTION_CONFIG[k].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    From Date
                  </label>
                  <div className="relative mt-1.5">
                    <CalendarDays size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 font-mono text-xs text-foreground outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    To Date
                  </label>
                  <div className="relative mt-1.5">
                    <CalendarDays size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 font-mono text-xs text-foreground outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Entry cards ── */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl bg-card" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
                <BookOpen size={32} className="mb-4 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">No journal entries yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasFilters ? "Try adjusting your filters." : 'Click "+ New Entry" to log your first trade.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((entry, idx) => {
                  const isWin = entry.pnl_dollars >= 0;
                  const emotion = entry.emotion_tag ? EMOTION_CONFIG[entry.emotion_tag] : null;
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.04 }}
                      className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
                    >
                      {/* Card top row */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Direction indicator */}
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              entry.direction === "long" ? "bg-bullish/10" : "bg-bearish/10"
                            }`}
                          >
                            {entry.direction === "long" ? (
                              <TrendingUp size={16} className="text-bullish" />
                            ) : (
                              <TrendingDown size={16} className="text-bearish" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg font-black text-foreground">
                                {entry.ticker}
                              </span>
                              <span
                                className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                                  entry.direction === "long"
                                    ? "bg-bullish/10 text-bullish"
                                    : "bg-bearish/10 text-bearish"
                                }`}
                              >
                                {entry.direction}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {entry.trade_date}
                            </span>
                          </div>
                        </div>

                        {/* P&L */}
                        <div className="text-right">
                          <p
                            className={`font-mono text-xl font-black ${isWin ? "text-bullish" : "text-bearish"}`}
                          >
                            {isWin ? "+" : ""}${entry.pnl_dollars.toLocaleString()}
                          </p>
                          <p
                            className={`font-mono text-xs font-semibold ${isWin ? "text-bullish" : "text-bearish"}`}
                          >
                            {isWin ? "+" : ""}
                            {entry.pnl_percent.toFixed(2)}%
                          </p>
                        </div>
                      </div>

                      {/* Tags row */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {emotion && (
                          <span
                            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${emotion.bg} ${emotion.color}`}
                          >
                            {emotion.icon} {emotion.label}
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          <StarRating value={entry.setup_quality ?? 0} />
                        </div>

                        <span
                          className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                            entry.followed_plan
                              ? "border-bullish/30 bg-bullish/10 text-bullish"
                              : "border-bearish/30 bg-bearish/10 text-bearish"
                          }`}
                        >
                          {entry.followed_plan ? (
                            <Check size={10} />
                          ) : (
                            <X size={10} />
                          )}
                          {entry.followed_plan ? "Followed Plan" : "Off Plan"}
                        </span>
                      </div>

                      {/* Notes / Lessons */}
                      {(entry.notes || entry.lessons) && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {entry.notes && (
                            <div className="rounded-lg bg-background/50 px-3 py-2">
                              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                                Notes
                              </p>
                              <p className="mt-0.5 text-xs text-foreground/80 line-clamp-2">
                                {entry.notes.slice(0, 100)}
                                {entry.notes.length > 100 ? "…" : ""}
                              </p>
                            </div>
                          )}
                          {entry.lessons && (
                            <div className="rounded-lg bg-background/50 px-3 py-2">
                              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                                Lessons
                              </p>
                              <p className="mt-0.5 text-xs text-foreground/80 line-clamp-2">
                                {entry.lessons.slice(0, 100)}
                                {entry.lessons.length > 100 ? "…" : ""}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          /* ── ADD ENTRY VIEW ── */
          <motion.div
            key="add"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h3 className="mb-6 font-display text-lg font-bold text-foreground">Log a Trade</h3>

            {isDemoMode && (
              <div className="mb-6 rounded-lg border border-watch/30 bg-watch/5 px-4 py-3">
                <p className="font-mono text-xs text-watch">
                  Demo mode — entries will not be saved to the database.
                </p>
              </div>
            )}

            <div className="space-y-5">
              {/* Row 1: Date + Ticker + Direction */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Trade Date
                  </label>
                  <input
                    type="date"
                    value={formTradeDate}
                    onChange={(e) => setFormTradeDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Ticker
                  </label>
                  <input
                    value={formTicker}
                    onChange={(e) => setFormTicker(e.target.value.toUpperCase())}
                    placeholder="NVDA"
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm font-bold uppercase text-foreground outline-none placeholder:text-muted-foreground/40"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Direction
                  </label>
                  <div className="mt-1.5 flex overflow-hidden rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setFormDirection("long")}
                      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 font-mono text-xs font-bold transition-all ${
                        formDirection === "long"
                          ? "bg-bullish text-background"
                          : "bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <TrendingUp size={12} /> Long
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDirection("short")}
                      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 font-mono text-xs font-bold transition-all ${
                        formDirection === "short"
                          ? "bg-bearish text-background"
                          : "bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <TrendingDown size={12} /> Short
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Entry / Exit / P&L */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Entry Price ($)
                  </label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={formEntryPrice}
                      onChange={(e) => {
                        setFormEntryPrice(e.target.value);
                        handlePriceChange(e.target.value, formExitPrice);
                      }}
                      placeholder="0.00"
                      className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Exit Price ($)
                  </label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={formExitPrice}
                      onChange={(e) => {
                        setFormExitPrice(e.target.value);
                        handlePriceChange(formEntryPrice, e.target.value);
                      }}
                      placeholder="0.00"
                      className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    P&L ($)
                  </label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={formPnlDollars}
                      onChange={(e) => setFormPnlDollars(e.target.value)}
                      placeholder="0.00"
                      className={`flex-1 bg-transparent font-mono text-sm font-bold outline-none ${
                        parseFloat(formPnlDollars) >= 0 ? "text-bullish" : "text-bearish"
                      }`}
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    P&L (%)
                  </label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                    <input
                      type="number"
                      value={formPnlPercent}
                      onChange={(e) => setFormPnlPercent(e.target.value)}
                      placeholder="0.00"
                      className={`flex-1 bg-transparent font-mono text-sm font-bold outline-none ${
                        parseFloat(formPnlPercent) >= 0 ? "text-bullish" : "text-bearish"
                      }`}
                      step="0.01"
                    />
                    <span className="font-mono text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              {/* Emotion Tag */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Emotion Tag
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.entries(EMOTION_CONFIG) as [EmotionTag, typeof EMOTION_CONFIG[EmotionTag]][]).map(
                    ([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormEmotion(formEmotion === key ? "" : key)}
                        className={`rounded-full border px-3 py-1.5 font-mono text-[10px] font-bold uppercase transition-all ${
                          formEmotion === key
                            ? `${cfg.bg} ${cfg.color} scale-105`
                            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Setup Quality + Followed Plan */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Setup Quality
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <StarRating value={formQuality} onChange={setFormQuality} />
                    <span className="font-mono text-sm font-bold text-foreground">{formQuality}/5</span>
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Followed Plan?
                  </label>
                  <div className="mt-1.5 flex overflow-hidden rounded-xl border border-border w-fit">
                    <button
                      type="button"
                      onClick={() => setFormFollowedPlan(true)}
                      className={`flex items-center gap-1.5 px-5 py-2.5 font-mono text-xs font-bold transition-all ${
                        formFollowedPlan
                          ? "bg-bullish text-background"
                          : "bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Check size={11} /> Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormFollowedPlan(false)}
                      className={`flex items-center gap-1.5 px-5 py-2.5 font-mono text-xs font-bold transition-all ${
                        !formFollowedPlan
                          ? "bg-bearish text-background"
                          : "bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <X size={11} /> No
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="What happened in this trade?"
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 resize-none"
                />
              </div>

              {/* Lessons */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Lessons
                </label>
                <textarea
                  value={formLessons}
                  onChange={(e) => setFormLessons(e.target.value)}
                  placeholder="What did you learn?"
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="rounded-xl border border-border px-5 py-2.5 font-mono text-sm text-muted-foreground transition-all hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isDemoMode) {
                      toast.info("Demo mode — entries are not persisted.");
                      setView("list");
                      return;
                    }
                    saveEntry();
                  }}
                  disabled={isSaving || !formTicker.trim()}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-mono text-sm font-bold text-background transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <BookOpen size={14} />
                  {isSaving ? "Saving…" : "Save Entry"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
