import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import {
  CheckCircle2,
  Circle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  CheckCheck,
  Newspaper,
  Sparkles,
  Loader2,
  ExternalLink,
  Activity,
  Gauge,
  ChevronDown,
  Copy,
  XCircle,
} from "lucide-react";

// ─── Animation variants ────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const tabContentVariants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.2, ease: "easeIn" as const } },
};

// ─── Types ─────────────────────────────────────────────────────────────────

type TabId = "reference" | "tracker" | "checklist";
type Direction = "call" | "put";
type Vehicle = "stock" | "option";
type Timeframe = "day" | "5day" | "swing" | "leap";
type Verdict = "go" | "warn" | "no";

// ─── Reference data ────────────────────────────────────────────────────────

const bullishTerms = [
  {
    term: "Low (L)",
    direction: "Reversing UP",
    desc: "Market drops to a clear bottom — sellers gave up, buyers stepped in. This is your Point 1 for a call setup. Mark it and watch.",
    action: "This is your Point 1. Mark it, do nothing yet.",
  },
  {
    term: "Higher Low (HL)",
    direction: "Going UP",
    desc: "Market pulls back but stops HIGHER than the last pullback. Buyers came in sooner — they would not let price fall as far. This is Point 3 in a call setup.",
    action: "Do NOT exit your call. Market is still going UP. Can add to position.",
  },
  {
    term: "Higher High (HH)",
    direction: "Going UP",
    desc: "Market makes a new peak higher than the last. Uptrend continuing strong.",
    action: "Hold your call. Exit when you hit your target near a Higher High.",
  },
];

const bearishTerms = [
  {
    term: "High (H)",
    direction: "Reversing DOWN",
    desc: "Market rises to a clear peak — buyers ran out of power, sellers stepped in. This is your Point 1 for a put setup. Mark it and watch.",
    action: "This is your Point 1. Mark it, do nothing yet.",
  },
  {
    term: "Lower High (LH)",
    direction: "Going DOWN",
    desc: "Market bounces but stops LOWER than the last bounce. Sellers came in sooner — buyers could not recover as high. This is Point 3 in a put setup.",
    action: "Do NOT exit your put. Market is still going DOWN. Can add to position.",
  },
  {
    term: "Lower Low (LL)",
    direction: "Going DOWN",
    desc: "Market makes a new bottom lower than the last. Downtrend continuing.",
    action: "Hold your put. Exit when you hit your target near a Lower Low.",
  },
];

const quickRefRows = [
  { term: "Higher High (HH)", dir: "Going UP", color: "text-bullish", signal: "FTGL — still bullish, uptrend strong", action: "Hold call. Exit near your target." },
  { term: "Higher Low (HL)", dir: "Going UP", color: "text-bullish", signal: "Pullback in uptrend. Buyers in control.", action: "Do NOT exit call. Can add to position." },
  { term: "Low (L)", dir: "Reversing UP", color: "text-bullish", signal: "Sellers gave up. Buyers taking over.", action: "This is your Point 1 for a call setup." },
  { term: "Lower Low (LL)", dir: "Going DOWN", color: "text-bearish", signal: "FTGH — still bearish, downtrend strong", action: "Hold put. Exit near your target." },
  { term: "Lower High (LH)", dir: "Going DOWN", color: "text-bearish", signal: "Pullback in downtrend. Sellers in control.", action: "Do NOT exit put. Can add to position." },
  { term: "High (H)", dir: "Reversing DOWN", color: "text-bearish", signal: "Buyers gave up. Sellers taking over.", action: "This is your Point 1 for a put setup." },
];

const TIMEFRAME_GUIDANCE: Record<Timeframe, { label: string; short: string; guidance: string }> = {
  day: { label: "Day Trade", short: "0–1 DTE", guidance: "0–1 DTE options. Enter after P2 break, exit before close. No overnight holds." },
  "5day": { label: "5-Day Swing", short: "1–2 wk expiry", guidance: "1–2 week expiry. Set a 50%-target alert. Trail stop after first leg up." },
  swing: { label: "Swing", short: "3–4 wk expiry", guidance: "3–4 week expiry. Give the trade room. Trail stop to breakeven once +50%." },
  leap: { label: "LEAP / Position", short: "3–6 mo expiry", guidance: "3–6 month expiry. Size down 50%. Deep ITM. Let it breathe." },
};

// ─── Shared helpers ────────────────────────────────────────────────────────

function getRegimeLabel(macro: any): string {
  if (!macro) return "UNKNOWN";
  const { composite, vix } = macro;
  if (vix?.value > 25) return "VOLATILE";
  if (composite > 65) return "BULL";
  if (composite < 35) return "BEAR";
  return "SIDEWAYS";
}

function getRegimeAlignment(regime: string, direction: Direction) {
  if (direction === "call") {
    if (regime === "BULL") return { label: "Regime aligned", color: "text-bullish", bg: "bg-bullish/10 border-bullish/20" };
    if (regime === "BEAR") return { label: "Regime opposing", color: "text-bearish", bg: "bg-bearish/10 border-bearish/20" };
    if (regime === "VOLATILE") return { label: "Volatile — reduce size", color: "text-watch", bg: "bg-watch/10 border-watch/20" };
    return { label: "Sideways regime", color: "text-muted-foreground", bg: "bg-muted/20 border-border" };
  } else {
    if (regime === "BEAR") return { label: "Regime aligned", color: "text-bullish", bg: "bg-bullish/10 border-bullish/20" };
    if (regime === "BULL") return { label: "Regime opposing", color: "text-bearish", bg: "bg-bearish/10 border-bearish/20" };
    if (regime === "VOLATILE") return { label: "Volatile — reduce size", color: "text-watch", bg: "bg-watch/10 border-watch/20" };
    return { label: "Sideways regime", color: "text-muted-foreground", bg: "bg-muted/20 border-border" };
  }
}

function timeAgo(utc: string): string {
  const diff = Date.now() - new Date(utc).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Shared UI components ──────────────────────────────────────────────────

function FormRow({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="font-mono text-[10px] uppercase tracking-[1px] text-muted-foreground">{label}</label>
        {sublabel && <span className="font-mono text-[9px] text-muted-foreground/60">{sublabel}</span>}
      </div>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  step,
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: number;
  prefix?: string;
}) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 font-mono text-sm text-muted-foreground pointer-events-none">{prefix ?? "$"}</span>
      <input
        type="number"
        value={value}
        step={step ?? "any"}
        min={0}
        placeholder={placeholder ?? "0.00"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface py-2.5 pl-8 pr-3 font-mono text-[14px] font-medium text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_2px_hsl(217_91%_60%/0.12)]"
      />
    </div>
  );
}

function ResultRow({
  label,
  value,
  accent,
  large,
}: {
  label: string;
  value: string;
  accent?: "green" | "red" | "blue" | "yellow" | "muted";
  large?: boolean;
}) {
  const colorMap: Record<string, string> = {
    green: "text-bullish",
    red: "text-bearish",
    blue: "text-primary",
    yellow: "text-watch",
    muted: "text-muted-foreground",
  };
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-3 last:border-b-0">
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className={`font-mono ${large ? "text-lg font-extrabold" : "text-sm font-semibold"} ${colorMap[accent ?? "blue"]}`}>
        {value}
      </span>
    </div>
  );
}

function DirectionToggle({ value, onChange }: { value: Direction; onChange: (d: Direction) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => onChange("call")}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-all border-r ${
          value === "call"
            ? "bg-bullish/15 text-bullish border-bullish/30"
            : "text-muted-foreground hover:text-foreground border-border"
        }`}
      >
        <TrendingUp className="h-3.5 w-3.5" />
        Call (Bullish)
      </button>
      <button
        onClick={() => onChange("put")}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-all ${
          value === "put"
            ? "bg-bearish/15 text-bearish"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <TrendingDown className="h-3.5 w-3.5" />
        Put (Bearish)
      </button>
    </div>
  );
}

// ─── SVG Trade Diagram ─────────────────────────────────────────────────────

function TradeDiagram({
  p1, p2, p3, entry, stopLoss, effectiveTarget, isCall,
}: {
  p1: number; p2: number; p3: number; entry: number; stopLoss: number; effectiveTarget: number; isCall: boolean;
}) {
  if (!p1 || !p2 || !p3) return null;

  const W = 340;
  const H = 180;
  const pad = { l: 48, r: 16, t: 16, b: 24 };
  const chartH = H - pad.t - pad.b;
  const chartW = W - pad.l - pad.r;

  const prices = [p1, p2, p3, entry || p3, stopLoss || p3, effectiveTarget || p2];
  const minP = Math.min(...prices.filter(Boolean));
  const maxP = Math.max(...prices.filter(Boolean));
  const range = maxP - minP || 1;

  const py = (p: number) => pad.t + chartH - ((p - minP) / range) * chartH;
  const px = (frac: number) => pad.l + frac * chartW;

  // x positions: P1=0.1, P2=0.35, P3=0.6, Entry=0.75, Target=0.95
  const xP1 = px(0.1);
  const xP2 = px(0.35);
  const xP3 = px(0.6);
  const xEntry = px(0.75);
  const xTgt = px(0.95);

  const yP1 = py(p1);
  const yP2 = py(p2);
  const yP3 = py(p3);
  const yEntry = entry ? py(entry) : py(p3);
  const yStop = stopLoss ? py(stopLoss) : py(p3);
  const yTgt = effectiveTarget ? py(effectiveTarget) : py(p2);

  const priceLabel = (p: number) => `$${p.toFixed(2)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "180px" }}>
      {/* grid lines */}
      {[p1, p2, p3].map((price, i) => (
        <line key={i} x1={pad.l} x2={W - pad.r} y1={py(price)} y2={py(price)}
          stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3 3" />
      ))}

      {/* stop loss line */}
      {stopLoss > 0 && (
        <line x1={pad.l} x2={xEntry} y1={yStop} y2={yStop}
          stroke="hsl(var(--bearish))" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
      )}

      {/* target line */}
      {effectiveTarget > 0 && (
        <line x1={xEntry} x2={W - pad.r} y1={yTgt} y2={yTgt}
          stroke="hsl(var(--bullish))" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
      )}

      {/* price path: P1 → P2 → P3 */}
      <polyline
        points={`${xP1},${yP1} ${xP2},${yP2} ${xP3},${yP3}`}
        fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round"
      />

      {/* dashed projection: P3 → Entry → Target */}
      {entry > 0 && (
        <polyline
          points={`${xP3},${yP3} ${xEntry},${yEntry} ${xTgt},${yTgt}`}
          fill="none" stroke={isCall ? "hsl(var(--bullish))" : "hsl(var(--bearish))"}
          strokeWidth="1.5" strokeDasharray="5 3" strokeLinejoin="round"
        />
      )}

      {/* P2 vertical trigger line */}
      <line x1={xP2} x2={xP2} y1={pad.t} y2={H - pad.b}
        stroke="hsl(var(--primary))" strokeWidth="0.75" strokeDasharray="3 2" opacity="0.4" />

      {/* Points */}
      {[
        { x: xP1, y: yP1, label: "P1", price: p1, color: "hsl(var(--muted-foreground))" },
        { x: xP2, y: yP2, label: "P2", price: p2, color: "hsl(var(--primary))" },
        { x: xP3, y: yP3, label: "P3", price: p3, color: "hsl(var(--muted-foreground))" },
      ].map(({ x, y, label, price, color }) => (
        <g key={label}>
          <circle cx={x} cy={y} r="4" fill={color} />
          <text x={x} y={y - 8} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace" fontWeight="700">{label}</text>
          <text x={x} y={y - 18} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace" opacity="0.7">{priceLabel(price)}</text>
        </g>
      ))}

      {/* Entry dot */}
      {entry > 0 && (
        <g>
          <circle cx={xEntry} cy={yEntry} r="4" fill={isCall ? "hsl(var(--bullish))" : "hsl(var(--bearish))"} />
          <text x={xEntry} y={yEntry - 8} textAnchor="middle" fill={isCall ? "hsl(var(--bullish))" : "hsl(var(--bearish))"} fontSize="7" fontFamily="monospace" fontWeight="700">ENTRY</text>
        </g>
      )}

      {/* Price axis labels */}
      {stopLoss > 0 && (
        <text x={pad.l - 3} y={yStop + 3} textAnchor="end" fill="hsl(var(--bearish))" fontSize="7" fontFamily="monospace" opacity="0.8">SL</text>
      )}
      {effectiveTarget > 0 && (
        <text x={pad.l - 3} y={yTgt + 3} textAnchor="end" fill="hsl(var(--bullish))" fontSize="7" fontFamily="monospace" opacity="0.8">TGT</text>
      )}
    </svg>
  );
}

// ─── Tab: Reference ────────────────────────────────────────────────────────

function ReferenceTab() {
  return (
    <div className="space-y-6 p-5 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bullish */}
        <div className="rounded-xl border border-bullish/20 bg-bullish/5 overflow-hidden">
          <div className="bg-bullish/15 px-4 py-3 border-b border-bullish/20">
            <p className="font-display text-[11px] font-extrabold uppercase tracking-[1.5px] text-bullish">
              Going UP — Failure To Go Lower (FTGL)
            </p>
          </div>
          <div className="px-4 py-3 border-b border-bullish/10">
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              The market tried to go <span className="text-bearish font-semibold">LOWER</span> but{" "}
              <span className="text-bullish font-semibold">FAILED</span>. Buyers stepped in. When you
              see any of these 3 terms, the market wants to go{" "}
              <span className="text-bullish font-semibold">UP</span>.
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {bullishTerms.map((t) => (
              <div key={t.term} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] font-bold text-bullish">{t.term}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
                    {t.direction}
                  </span>
                </div>
                <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{t.desc}</p>
                <p className="font-mono text-[10px] text-bullish/80 italic">→ {t.action}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bearish */}
        <div className="rounded-xl border border-bearish/20 bg-bearish/5 overflow-hidden">
          <div className="bg-bearish/15 px-4 py-3 border-b border-bearish/20">
            <p className="font-display text-[11px] font-extrabold uppercase tracking-[1.5px] text-bearish">
              Going DOWN — Failure To Go Higher (FTGH)
            </p>
          </div>
          <div className="px-4 py-3 border-b border-bearish/10">
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              The market tried to go <span className="text-bullish font-semibold">HIGHER</span> but{" "}
              <span className="text-bearish font-semibold">FAILED</span>. Sellers stepped in. When you
              see any of these 3 terms, the market wants to go{" "}
              <span className="text-bearish font-semibold">DOWN</span>.
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {bearishTerms.map((t) => (
              <div key={t.term} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] font-bold text-bearish">{t.term}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
                    {t.direction}
                  </span>
                </div>
                <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{t.desc}</p>
                <p className="font-mono text-[10px] text-bearish/80 italic">→ {t.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick reference table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-card">
          <span className="font-display text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground">
            All 6 Terms — Quick Reference
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {["Term", "Direction", "What It Tells You", "Action In Your Trade"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {quickRefRows.map((row) => (
                <tr key={row.term} className="hover:bg-accent/30 transition-colors">
                  <td className={`px-4 py-3 font-mono text-[11px] font-bold whitespace-nowrap ${row.color}`}>{row.term}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{row.dir}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{row.signal}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-foreground">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-center">
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">THE CORE RULE: </span>
          See all 3 points. Confirm P3 is between P1 and P2. Enter ONLY when price breaks past P2.
          Until then — you wait. That patience is the edge.
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Setup Tracker ────────────────────────────────────────────────────

const AI_ADVISOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-advisor`;

function SetupTrackerTab() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  // ── Form state ──────────────────────────────────────────────────────────
  const [direction, setDirection] = useState<Direction>("call");
  const [ticker, setTicker] = useState("");
  const [debouncedTicker, setDebouncedTicker] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");
  const [p3Wick, setP3Wick] = useState("");
  const [entry, setEntry] = useState("");
  const [target, setTarget] = useState("");
  const [showWatchlist, setShowWatchlist] = useState(false);
  const watchlistRef = useRef<HTMLDivElement>(null);

  // ── Position sizing state ────────────────────────────────────────────────
  const [account, setAccount] = useState("");
  const [riskPct, setRiskPct] = useState<1 | 2 | 3>(1);
  const [vehicle, setVehicle] = useState<Vehicle>("stock");
  const [premium, setPremium] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("swing");

  // ── AI state ─────────────────────────────────────────────────────────────
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCall = direction === "call";

  // ── Debounce ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTicker(ticker.trim().toUpperCase()), 700);
    return () => clearTimeout(t);
  }, [ticker]);

  // Close watchlist dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (watchlistRef.current && !watchlistRef.current.contains(e.target as Node)) {
        setShowWatchlist(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Level 1: Watchlist ───────────────────────────────────────────────────
  const { data: watchlistItems = [] } = useQuery({
    queryKey: ["watchlist-123", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("watchlist")
        .select("ticker, company_name")
        .eq("user_id", user!.id)
        .order("added_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user && !isDemoMode,
  });

  // ── Level 1: Market regime ───────────────────────────────────────────────
  const { data: macroData } = useQuery({
    queryKey: ["regime-123"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-signals", {
        body: { mode: "macro" },
      });
      if (error) throw error;
      return data?.macro ?? null;
    },
    enabled: !isDemoMode,
    staleTime: 5 * 60 * 1000,
  });

  // ── Level 2: Ticker context (price + news) ───────────────────────────────
  const { data: tickerCtx, isFetching: ctxLoading } = useQuery({
    queryKey: ["ticker-ctx-123", debouncedTicker],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-ticker-context", {
        body: { ticker: debouncedTicker },
      });
      if (error) throw error;
      return data as { quote: any; news: any[] } | null;
    },
    enabled: debouncedTicker.length >= 1,
    staleTime: 60 * 1000,
  });

  // ── Core calculations ────────────────────────────────────────────────────
  const results = useMemo(() => {
    const _p1 = parseFloat(p1) || 0;
    const _p2 = parseFloat(p2) || 0;
    const _p3 = parseFloat(p3) || 0;
    const _p3Wick = parseFloat(p3Wick) || _p3;
    const _entry = parseFloat(entry) || 0;
    const _target = parseFloat(target) || 0;
    const _account = parseFloat(account) || 0;
    const _premium = parseFloat(premium) || 0;

    if (_p1 === 0 || _p2 === 0 || _p3 === 0) {
      return {
        valid: null, reason: "", stopLoss: 0, risk: 0, reward: 0, rr: null,
        measuredMove: 0, measuredTarget: 0, effectiveTarget: 0,
        shares: 0, contracts: 0, maxRisk: 0, verdict: "no" as Verdict,
      };
    }

    let valid = false;
    let reason = "";

    if (isCall) {
      if (_p2 <= _p1) reason = "P2 must be ABOVE P1 for a call setup.";
      else if (_p3 <= _p1) reason = "P3 is NOT above P1 — setup CANCELLED. Start over.";
      else if (_p3 >= _p2) reason = "P3 must be BELOW P2 — it must sit between P1 and P2.";
      else { valid = true; reason = "Setup VALID. Wait for a green candle to close ABOVE P2 to enter."; }
    } else {
      if (_p2 >= _p1) reason = "P2 must be BELOW P1 for a put setup.";
      else if (_p3 >= _p1) reason = "P3 is NOT below P1 — setup CANCELLED. Start over.";
      else if (_p3 <= _p2) reason = "P3 must be ABOVE P2 — it must sit between P1 and P2.";
      else { valid = true; reason = "Setup VALID. Wait for a red candle to close BELOW P2 to enter."; }
    }

    const stopLoss = _p3Wick || _p3;
    const measuredMove = Math.abs(_p2 - _p1);
    const measuredTarget = isCall
      ? (_entry || _p3) + measuredMove
      : (_entry || _p3) - measuredMove;
    const effectiveTarget = _target > 0 ? _target : (valid ? measuredTarget : 0);

    const risk = _entry > 0 ? Math.abs(_entry - stopLoss) : 0;
    const reward = _entry > 0 && effectiveTarget > 0
      ? isCall ? Math.max(0, effectiveTarget - _entry) : Math.max(0, _entry - effectiveTarget)
      : 0;
    const rr = risk > 0 && reward > 0 ? reward / risk : null;

    // Position sizing
    const maxRisk = _account > 0 ? _account * (riskPct / 100) : 0;
    const shares = risk > 0 && maxRisk > 0 ? Math.floor(maxRisk / risk) : 0;
    const contracts = risk > 0 && maxRisk > 0 && _premium > 0
      ? Math.floor(maxRisk / (_premium * 100))
      : 0;

    // Verdict
    let verdict: Verdict = "no";
    if (valid && rr !== null && rr >= 1.5) verdict = "go";
    else if (valid && rr !== null && rr > 0) verdict = "warn";
    else if (!valid && _p1 > 0) verdict = "no";

    return {
      valid, reason, stopLoss, risk, reward, rr,
      measuredMove, measuredTarget, effectiveTarget,
      shares, contracts, maxRisk, verdict,
    };
  }, [p1, p2, p3, p3Wick, entry, target, account, riskPct, premium, vehicle, isCall]);

  // ── Operations brief ─────────────────────────────────────────────────────
  const operationsBrief = useMemo(() => {
    if (!results.valid || !ticker) return "";
    const fmt = (n: number) => n > 0 ? `$${n.toFixed(2)}` : "—";
    const tfLabel = TIMEFRAME_GUIDANCE[timeframe].label;
    const posLine = vehicle === "stock"
      ? `Shares: ${results.shares > 0 ? results.shares : "—"}`
      : `Contracts: ${results.contracts > 0 ? results.contracts : "—"} (premium ${fmt(parseFloat(premium))})`;

    return `1-2-3 ${isCall ? "CALL" : "PUT"} SETUP — ${ticker.toUpperCase()}
Timeframe: ${tfLabel}
─────────────────────────────
P1: ${fmt(parseFloat(p1))}   P2: ${fmt(parseFloat(p2))}   P3: ${fmt(parseFloat(p3))}
Entry:  ${fmt(parseFloat(entry))}
Stop:   ${fmt(results.stopLoss)}
Target: ${fmt(results.effectiveTarget)}${results.measuredMove > 0 ? ` (measured move: ${fmt(results.measuredMove)})` : ""}
─────────────────────────────
Risk/Share: ${results.risk > 0 ? `$${results.risk.toFixed(2)}` : "—"}
R/R Ratio:  ${results.rr !== null ? `1:${results.rr.toFixed(2)}` : "—"}
${posLine}
Max Risk:   ${results.maxRisk > 0 ? `$${results.maxRisk.toFixed(0)}` : "—"}
─────────────────────────────
Management: ${TIMEFRAME_GUIDANCE[timeframe].guidance}
Rule: Set stop loss IMMEDIATELY on entry. No exceptions.`;
  }, [results, ticker, p1, p2, p3, entry, timeframe, vehicle, premium, isCall]);

  const copyBrief = () => {
    if (!operationsBrief) return;
    navigator.clipboard.writeText(operationsBrief).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Level 3: AI analysis ─────────────────────────────────────────────────
  const analyzeSetup = async () => {
    if (!results.valid || !ticker) return;
    setIsAnalyzing(true);
    setAiAnalysis("");

    const regimeLabel = getRegimeLabel(macroData);
    const headlines = tickerCtx?.news?.map((n: any) => `- ${n.title}`).join("\n") || "No recent news available.";
    const priceLine = tickerCtx?.quote
      ? `$${tickerCtx.quote.price.toFixed(2)} (${tickerCtx.quote.change_pct >= 0 ? "+" : ""}${tickerCtx.quote.change_pct.toFixed(2)}% today)`
      : "Unknown";

    const prompt = `You are analyzing a 1-2-3 ${isCall ? "CALL" : "PUT"} setup for ${ticker.toUpperCase()}.

Setup:
- Direction: ${isCall ? "CALL (bullish)" : "PUT (bearish)"}
- Point 1 (${isCall ? "Low" : "High"}): $${p1}
- Point 2 (${isCall ? "High / trigger line" : "Low / trigger line"}): $${p2}
- Point 3 (${isCall ? "Higher Low" : "Lower High"}): $${p3}
- Stop Loss: $${results.stopLoss.toFixed(2)}${entry ? `\n- Entry: $${entry}` : ""}
- Target: $${results.effectiveTarget.toFixed(2)} (${parseFloat(target) > 0 ? "manual" : "measured move"})
${results.rr ? `- Risk/Reward: 1:${results.rr.toFixed(2)}` : ""}
- Timeframe: ${TIMEFRAME_GUIDANCE[timeframe].label}
- Vehicle: ${vehicle === "stock" ? "Stock shares" : "Options"}

Market context:
- Current price: ${priceLine}
- Market regime: ${regimeLabel}

Recent news for ${ticker.toUpperCase()}:
${headlines}

Give a concise 3-4 sentence assessment of this 1-2-3 setup. Cover: (1) structure validity and quality, (2) whether the news aligns with or contradicts the ${isCall ? "bullish" : "bearish"} direction, (3) any regime or macro risk factors, (4) your overall confidence rating — HIGH, MODERATE, or LOW — and why.`;

    try {
      const resp = await fetch(AI_ADVISOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });

      if (!resp.ok || !resp.body) {
        setAiAnalysis("Could not reach AI advisor. Check your API connection.");
        setIsAnalyzing(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") { done = true; break; }
          try {
            const { choices } = JSON.parse(payload);
            const delta = choices?.[0]?.delta?.content;
            if (delta) setAiAnalysis((prev) => prev + delta);
          } catch { /* skip malformed chunks */ }
        }
      }
    } catch {
      setAiAnalysis("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAll = () => {
    setP1(""); setP2(""); setP3(""); setP3Wick(""); setEntry(""); setTarget("");
    setPremium(""); setAiAnalysis("");
  };

  const fmt = (n: string | number) => {
    const v = typeof n === "string" ? parseFloat(n) : n;
    return v > 0 ? `$${v.toFixed(2)}` : "—";
  };

  const regimeLabel = getRegimeLabel(macroData);
  const regimeAlign = getRegimeAlignment(regimeLabel, direction);

  // Verdict config
  const verdictConfig = {
    go: { label: "GO", sub: "R/R ≥ 1.5 — Setup is valid. Execute the plan.", bg: "bg-bullish/12 border-bullish/40", text: "text-bullish", icon: CheckCircle2 },
    warn: { label: "WARN", sub: "R/R below 1.5 — Setup valid but edge is thin. Size down or skip.", bg: "bg-watch/10 border-watch/30", text: "text-watch", icon: AlertTriangle },
    no: { label: "NO", sub: "Setup invalid — Do not enter. Wait for a clean 1-2-3.", bg: "bg-bearish/8 border-bearish/30", text: "text-bearish", icon: XCircle },
  };
  const vc = verdictConfig[results.verdict];

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── Left: Inputs ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 p-5 sm:p-6">

          <FormRow label="Direction">
            <DirectionToggle value={direction} onChange={(d) => { setDirection(d); resetAll(); }} />
          </FormRow>

          {/* Ticker input + watchlist picker */}
          <FormRow label="Ticker Symbol">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={ticker}
                  placeholder="SPY, QQQ, AAPL..."
                  onChange={(e) => { setTicker(e.target.value.toUpperCase()); setAiAnalysis(""); }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-[14px] font-medium text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_2px_hsl(217_91%_60%/0.12)] uppercase"
                />
                {ctxLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              {watchlistItems.length > 0 && (
                <div className="relative" ref={watchlistRef}>
                  <button
                    onClick={() => setShowWatchlist((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors whitespace-nowrap"
                  >
                    Watchlist <ChevronDown className="h-3 w-3" />
                  </button>
                  <AnimatePresence>
                    {showWatchlist && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-card shadow-xl overflow-hidden"
                      >
                        <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                          {watchlistItems.map((item: any) => (
                            <button
                              key={item.ticker}
                              onClick={() => {
                                setTicker(item.ticker);
                                setAiAnalysis("");
                                setShowWatchlist(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                            >
                              <span className="font-mono text-[12px] font-bold text-foreground">{item.ticker}</span>
                              {item.company_name && (
                                <span className="font-mono text-[10px] text-muted-foreground truncate">{item.company_name}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </FormRow>

          {/* Live price card */}
          <AnimatePresence>
            {tickerCtx?.quote && debouncedTicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-border bg-surface/60 px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{debouncedTicker} — Prev Close</span>
                  <div className="font-display text-[20px] font-extrabold text-foreground">
                    ${tickerCtx.quote.price.toFixed(2)}
                  </div>
                </div>
                <div className={`text-right font-mono text-[13px] font-bold ${tickerCtx.quote.change_pct >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {tickerCtx.quote.change_pct >= 0 ? "+" : ""}{tickerCtx.quote.change_pct.toFixed(2)}%
                  <div className="font-mono text-[9px] text-muted-foreground font-normal">day change</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-px bg-border/60" />

          {/* Timeframe selector */}
          <FormRow label="Timeframe">
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(TIMEFRAME_GUIDANCE) as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`rounded-lg border py-2 flex flex-col items-center gap-0.5 transition-all ${
                    timeframe === tf
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wide">{TIMEFRAME_GUIDANCE[tf].label.split(" ")[0]}</span>
                  <span className="font-mono text-[8px] opacity-70">{TIMEFRAME_GUIDANCE[tf].short}</span>
                </button>
              ))}
            </div>
            {timeframe && (
              <p className="font-mono text-[10px] text-muted-foreground/70 mt-0.5">{TIMEFRAME_GUIDANCE[timeframe].guidance}</p>
            )}
          </FormRow>

          <div className="h-px bg-border/60" />

          <FormRow label={isCall ? "Point 1 — The Low" : "Point 1 — The High"} sublabel="mark it, do nothing yet">
            <NumberInput value={p1} onChange={setP1} placeholder={isCall ? "e.g. 521.50" : "e.g. 451.20"} step={0.01} />
          </FormRow>

          <FormRow label={isCall ? "Point 2 — The High (bounce top)" : "Point 2 — The Low (drop bottom)"} sublabel="draw your trigger line here">
            <NumberInput value={p2} onChange={setP2} placeholder={isCall ? "e.g. 524.80" : "e.g. 447.80"} step={0.01} />
          </FormRow>

          <FormRow label={isCall ? "Point 3 — Higher Low" : "Point 3 — Lower High"} sublabel="must sit between P1 and P2">
            <NumberInput value={p3} onChange={setP3} placeholder={isCall ? "e.g. 522.70" : "e.g. 449.60"} step={0.01} />
          </FormRow>

          <FormRow label={isCall ? "P3 Bottom Wick — Stop Loss" : "P3 Top Wick — Stop Loss"} sublabel="leave blank to use P3 close">
            <NumberInput value={p3Wick} onChange={setP3Wick} placeholder={isCall ? "e.g. 522.40" : "e.g. 449.90"} step={0.01} />
          </FormRow>

          <div className="h-px bg-border/60" />

          <FormRow label={isCall ? "Entry Price (candle closed above P2)" : "Entry Price (candle closed below P2)"}>
            <NumberInput value={entry} onChange={setEntry} placeholder={isCall ? "e.g. 525.10" : "e.g. 447.40"} step={0.01} />
          </FormRow>

          <FormRow label="Target Price" sublabel="leave blank to use measured move">
            <NumberInput value={target} onChange={setTarget} placeholder={isCall ? "e.g. 526.40" : "e.g. 446.20"} step={0.01} />
          </FormRow>

          <div className="h-px bg-border/60" />

          {/* Position sizing inputs */}
          <FormRow label="Account Size" sublabel="for position sizing">
            <NumberInput value={account} onChange={setAccount} placeholder="e.g. 25000" step={100} />
          </FormRow>

          <FormRow label="Risk Per Trade">
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((pct) => (
                <button
                  key={pct}
                  onClick={() => setRiskPct(pct)}
                  className={`flex-1 rounded-lg border py-2.5 font-mono text-[12px] font-bold transition-all ${
                    riskPct === pct
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </FormRow>

          <FormRow label="Vehicle">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setVehicle("stock")}
                className={`flex-1 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-all border-r border-border ${
                  vehicle === "stock" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Stock / ETF
              </button>
              <button
                onClick={() => setVehicle("option")}
                className={`flex-1 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-all ${
                  vehicle === "option" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Options
              </button>
            </div>
          </FormRow>

          {vehicle === "option" && (
            <FormRow label="Option Premium (per contract)" sublabel="cost of 1 contract ÷ 100">
              <NumberInput value={premium} onChange={setPremium} placeholder="e.g. 2.45" step={0.01} />
            </FormRow>
          )}
        </div>

        {/* ── Right: Results ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 p-5 sm:p-6">

          {/* Regime badge */}
          {macroData && (
            <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${regimeAlign.bg}`}>
              {regimeLabel === "BULL" ? <TrendingUp className={`h-3.5 w-3.5 ${regimeAlign.color}`} /> :
               regimeLabel === "BEAR" ? <TrendingDown className={`h-3.5 w-3.5 ${regimeAlign.color}`} /> :
               regimeLabel === "VOLATILE" ? <Activity className={`h-3.5 w-3.5 ${regimeAlign.color}`} /> :
               <Gauge className={`h-3.5 w-3.5 ${regimeAlign.color}`} />}
              <span className={`font-mono text-[11px] font-semibold ${regimeAlign.color}`}>
                Regime: {regimeLabel}
              </span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">{regimeAlign.label}</span>
            </div>
          )}

          {/* Verdict card */}
          <AnimatePresence mode="wait">
            {results.valid !== null && (
              <motion.div
                key={results.verdict}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${vc.bg}`}
              >
                <div className={`font-display text-[32px] font-extrabold leading-none ${vc.text}`}>
                  {vc.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className={`font-mono text-[11px] font-bold ${vc.text}`}>Trade Verdict</span>
                  <span className="font-mono text-[10px] text-muted-foreground leading-snug">{vc.sub}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation message */}
          <AnimatePresence mode="wait">
            {results.valid !== null && (
              <motion.div
                key={results.reason}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                  results.valid ? "border-bullish/30 bg-bullish/8" : "border-bearish/30 bg-bearish/8"
                }`}
              >
                {results.valid
                  ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-bullish mt-0.5" />
                  : <AlertTriangle className="h-4 w-4 flex-shrink-0 text-bearish mt-0.5" />}
                <p className={`font-mono text-[11px] leading-relaxed font-semibold ${results.valid ? "text-bullish" : "text-bearish"}`}>
                  {results.reason}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SVG Diagram */}
          <AnimatePresence>
            {parseFloat(p1) > 0 && parseFloat(p2) > 0 && parseFloat(p3) > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-border bg-surface/50 p-3 overflow-hidden"
              >
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Trade Diagram</p>
                <TradeDiagram
                  p1={parseFloat(p1)}
                  p2={parseFloat(p2)}
                  p3={parseFloat(p3)}
                  entry={parseFloat(entry) || 0}
                  stopLoss={results.stopLoss}
                  effectiveTarget={results.effectiveTarget}
                  isCall={isCall}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results table */}
          <div className="rounded-xl border border-border bg-surface/60 px-4">
            <ResultRow label="Ticker" value={ticker || "—"} accent="blue" />
            <ResultRow label="Direction" value={isCall ? "CALL — Bullish" : "PUT — Bearish"} accent={isCall ? "green" : "red"} />
            <ResultRow label="Point 1" value={fmt(p1)} accent="muted" />
            <ResultRow label="Point 2 (trigger)" value={fmt(p2)} accent="blue" />
            <ResultRow label="Point 3" value={fmt(p3)} accent="muted" />
            <ResultRow label="Stop Loss" value={results.stopLoss > 0 ? `$${results.stopLoss.toFixed(2)}` : "—"} accent="red" large />
            <ResultRow label="Entry" value={fmt(entry)} accent={isCall ? "green" : "red"} large />
            <ResultRow
              label={`Target ${parseFloat(target) === 0 && results.measuredTarget > 0 ? "(measured)" : "(manual)"}`}
              value={results.effectiveTarget > 0 ? `$${results.effectiveTarget.toFixed(2)}` : "—"}
              accent="blue"
            />
            {results.measuredMove > 0 && (
              <ResultRow label="Measured Move" value={`$${results.measuredMove.toFixed(2)}`} accent="muted" />
            )}
            <ResultRow label="Risk per Share" value={results.risk > 0 ? `$${results.risk.toFixed(2)}` : "—"} accent="red" />
            <ResultRow label="Reward per Share" value={results.reward > 0 ? `$${results.reward.toFixed(2)}` : "—"} accent="green" />
            <ResultRow
              label="Risk / Reward"
              value={results.rr !== null ? `1 : ${results.rr.toFixed(2)}` : "—"}
              accent={results.rr !== null ? (results.rr >= 2 ? "green" : results.rr >= 1 ? "yellow" : "red") : "muted"}
              large
            />
          </div>

          {/* Position sizing results */}
          {results.maxRisk > 0 && (
            <div className="rounded-xl border border-border bg-surface/60 px-4">
              <ResultRow label="Account Size" value={fmt(account)} accent="muted" />
              <ResultRow label="Max Risk" value={`$${results.maxRisk.toFixed(0)} (${riskPct}%)`} accent="red" />
              {vehicle === "stock" && (
                <ResultRow label="Shares to Buy" value={results.shares > 0 ? `${results.shares} shares` : "—"} accent="blue" large />
              )}
              {vehicle === "option" && (
                <>
                  <ResultRow label="Contracts to Buy" value={results.contracts > 0 ? `${results.contracts} contracts` : "—"} accent="blue" large />
                  {results.contracts > 0 && parseFloat(premium) > 0 && (
                    <ResultRow label="Total Outlay" value={`$${(results.contracts * parseFloat(premium) * 100).toFixed(0)}`} accent="yellow" />
                  )}
                </>
              )}
            </div>
          )}

          {/* AI Analysis button */}
          {results.valid && ticker && (
            <motion.button
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={analyzeSetup}
              disabled={isAnalyzing}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-wider transition-all ${
                isAnalyzing
                  ? "border-primary/30 bg-primary/5 text-primary/60 cursor-not-allowed"
                  : "border-primary/40 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/60"
              }`}
            >
              {isAnalyzing
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing setup...</>
                : <><Sparkles className="h-3.5 w-3.5" /> AI Analysis</>}
            </motion.button>
          )}

          {/* Operations brief */}
          {operationsBrief && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[1px] text-muted-foreground">Operations Brief</span>
                <button
                  onClick={copyBrief}
                  className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[10px] transition-all ${
                    copied
                      ? "border-bullish/40 bg-bullish/10 text-bullish"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  }`}
                >
                  <Copy className="h-3 w-3" />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="rounded-lg border border-border bg-surface/60 px-4 py-3 font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap overflow-x-auto">
                {operationsBrief}
              </pre>
            </div>
          )}

          <div className="mt-auto rounded-lg border border-border bg-card px-4 py-3">
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              <span className="text-foreground font-semibold">Rule: </span>
              Set stop loss the MOMENT you enter. Before anything else. Never skip it.
            </p>
          </div>
        </div>
      </div>

      {/* ── News panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {tickerCtx?.news?.length > 0 && debouncedTicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 sm:p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-[10px] uppercase tracking-[1px] text-muted-foreground">
                  Recent News — {debouncedTicker}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tickerCtx.news.map((article: any, i: number) => (
                  <motion.a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="group flex flex-col gap-1.5 rounded-lg border border-border bg-surface/60 p-3 hover:bg-accent/40 hover:border-border/80 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-[11px] font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {article.title}
                      </p>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors mt-0.5" />
                    </div>
                    <div className="flex items-center gap-2 mt-auto">
                      {article.source && (
                        <span className="font-mono text-[9px] text-muted-foreground/60 truncate">{article.source}</span>
                      )}
                      <span className="ml-auto font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
                        {timeAgo(article.published_utc)}
                      </span>
                    </div>
                  </motion.a>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI analysis panel ───────────────────────────────────── */}
      <AnimatePresence>
        {(aiAnalysis || isAnalyzing) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 sm:p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-[1px] text-primary">
                  AI Setup Analysis
                </span>
                {isAnalyzing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
                {aiAnalysis ? (
                  <p className="font-mono text-[12px] leading-relaxed text-foreground whitespace-pre-wrap">
                    {aiAnalysis}
                  </p>
                ) : (
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab: Checklist ────────────────────────────────────────────────────────

const CALL_CHECKLIST = [
  "I can clearly see Point 1 (a Low) marked on my chart.",
  "I have drawn a horizontal line at Point 2 (the High after Point 1).",
  "I can see Point 3 (a Higher Low) that is ABOVE Point 1.",
  "Point 3 is between Points 1 and 2. (If not — I start over.)",
  "A bullish green candle has CLOSED above my Point 2 line.",
  "I know my stop loss level (bottom wick of Point 3).",
  "I know my exit target (next key level OR next High or Higher High).",
  "I am buying a CALL option.",
  "Stop loss is set the MOMENT I enter.",
];

const PUT_CHECKLIST = [
  "I can clearly see Point 1 (a High) marked on my chart.",
  "I have drawn a horizontal line at Point 2 (the Low after Point 1).",
  "I can see Point 3 (a Lower High) that is BELOW Point 1.",
  "Point 3 is between Points 1 and 2. (If not — I start over.)",
  "A bearish red candle has CLOSED below my Point 2 line.",
  "I know my stop loss level (top wick of Point 3).",
  "I know my exit target (next key level OR next Low or Lower Low).",
  "I am buying a PUT option.",
  "Stop loss is set the MOMENT I enter.",
];

const CALL_TECH_CHECKLIST = [
  "RSI is turning UP from below 30 or 50 — momentum shifting bullish.",
  "Volume is RISING on the P3-to-entry move — buyers are showing up.",
  "Price is reclaiming the 20 EMA or 50 SMA — structure supports trade.",
  "P3 formed at or near a known support level (prior high, gap fill, MA).",
  "Daily AND weekly trend are both pointing UP — multi-timeframe aligned.",
  "Bullish candle pattern at P3 (hammer, engulf, doji reversal).",
];

const PUT_TECH_CHECKLIST = [
  "RSI is turning DOWN from above 70 or 50 — momentum shifting bearish.",
  "Volume is RISING on the P3-to-entry move — sellers are showing up.",
  "Price is failing below the 20 EMA or 50 SMA — structure supports trade.",
  "P3 formed at or near a known resistance level (prior low, gap fill, MA).",
  "Daily AND weekly trend are both pointing DOWN — multi-timeframe aligned.",
  "Bearish candle pattern at P3 (shooting star, engulf, doji reversal).",
];

function ChecklistTab() {
  const [direction, setDirection] = useState<Direction>("call");
  const [checked, setChecked] = useState<boolean[]>(Array(9).fill(false));
  const [techChecked, setTechChecked] = useState<boolean[]>(Array(6).fill(false));

  const isCall = direction === "call";
  const items = isCall ? CALL_CHECKLIST : PUT_CHECKLIST;
  const techItems = isCall ? CALL_TECH_CHECKLIST : PUT_TECH_CHECKLIST;
  const checkedCount = checked.filter(Boolean).length;
  const techCheckedCount = techChecked.filter(Boolean).length;
  const allChecked = checkedCount === items.length;
  const totalCount = checkedCount + techCheckedCount;
  const totalItems = items.length + techItems.length;

  const toggle = (i: number) => setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  const toggleTech = (i: number) => setTechChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const handleDirectionChange = (d: Direction) => {
    setDirection(d);
    setChecked(Array(9).fill(false));
    setTechChecked(Array(6).fill(false));
  };

  return (
    <div className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <DirectionToggle value={direction} onChange={handleDirectionChange} />
        </div>
        <button
          onClick={() => { setChecked(Array(9).fill(false)); setTechChecked(Array(6).fill(false)); }}
          className="shrink-0 rounded-lg border border-border px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Combined progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Overall Progress
          </span>
          <span className={`font-mono text-[11px] font-bold ${totalCount === totalItems ? (isCall ? "text-bullish" : "text-bearish") : "text-muted-foreground"}`}>
            {totalCount} / {totalItems}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isCall ? "bg-bullish" : "bg-bearish"}`}
            animate={{ width: `${(totalCount / totalItems) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
        </div>
      </div>

      {/* Pre-Trade Checklist */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Pre-Trade Checklist
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{checkedCount} / {items.length}</span>
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={direction} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {items.map((item, i) => (
                <motion.button
                  key={i}
                  onClick={() => toggle(i)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b border-border/40 last:border-b-0 ${
                    checked[i]
                      ? isCall ? "bg-bullish/6 hover:bg-bullish/10" : "bg-bearish/6 hover:bg-bearish/10"
                      : "hover:bg-accent/40"
                  }`}
                >
                  {checked[i]
                    ? <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isCall ? "text-bullish" : "text-bearish"}`} />
                    : <Circle className="h-4 w-4 flex-shrink-0 mt-0.5 text-border" />}
                  <span className={`font-mono text-[11px] leading-relaxed ${checked[i] ? "text-foreground" : "text-muted-foreground"}`}>
                    {item}
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Technical Confirmation */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Technical Confirmation
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{techCheckedCount} / {techItems.length}</span>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/60">Check any that apply. More checks = higher conviction.</p>
        <div className="rounded-xl border border-border overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={direction + "-tech"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {techItems.map((item, i) => (
                <motion.button
                  key={i}
                  onClick={() => toggleTech(i)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b border-border/40 last:border-b-0 ${
                    techChecked[i]
                      ? "bg-primary/6 hover:bg-primary/10"
                      : "hover:bg-accent/40"
                  }`}
                >
                  {techChecked[i]
                    ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary" />
                    : <Circle className="h-4 w-4 flex-shrink-0 mt-0.5 text-border" />}
                  <span className={`font-mono text-[11px] leading-relaxed ${techChecked[i] ? "text-foreground" : "text-muted-foreground"}`}>
                    {item}
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
        {/* Conviction meter */}
        {techCheckedCount > 0 && (
          <div className={`rounded-lg border px-3 py-2 font-mono text-[10px] ${
            techCheckedCount >= 5 ? "border-bullish/30 bg-bullish/8 text-bullish" :
            techCheckedCount >= 3 ? "border-primary/30 bg-primary/8 text-primary" :
            "border-watch/30 bg-watch/8 text-watch"
          }`}>
            {techCheckedCount >= 5 ? "HIGH conviction — strong technical alignment" :
             techCheckedCount >= 3 ? "MODERATE conviction — enough to proceed with proper sizing" :
             "LOW conviction — consider waiting for more signals"}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {allChecked ? (
          <motion.div
            key="confirmed"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${
              isCall ? "border-bullish/40 bg-bullish/10" : "border-bearish/40 bg-bearish/10"
            }`}
          >
            <CheckCheck className={`h-5 w-5 flex-shrink-0 ${isCall ? "text-bullish" : "text-bearish"}`} />
            <div>
              <p className={`font-mono text-[12px] font-extrabold uppercase tracking-wide ${isCall ? "text-bullish" : "text-bearish"}`}>
                Setup confirmed — {isCall ? "Buy your CALL now." : "Buy your PUT now."}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                Set your stop loss immediately after entry. Then wait for the market to do the work.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-border bg-card px-5 py-4"
          >
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground text-center">
              If you cannot check every single pre-trade box —{" "}
              <span className="text-foreground font-semibold">do NOT enter the trade</span>. Wait for a cleaner setup.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "reference", label: "Strategy Reference" },
  { id: "tracker", label: "Setup Tracker" },
  { id: "checklist", label: "Trade Checklist" },
];

export default function Strategy123() {
  const [activeTab, setActiveTab] = useState<TabId>("reference");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 className="font-display text-xl sm:text-[28px] font-extrabold leading-none tracking-tight">
              1-2-3 <span className="text-primary">Strategy</span>
            </h1>
            <p className="mt-1.5 font-mono text-[11px] sm:text-[13px] text-muted-foreground hidden sm:block">
              // Mark. Confirm. Enter. The market proves itself 3 times before you risk a dollar.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Target className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[11px] text-muted-foreground">P1 → P2 → P3 → Entry</span>
          </div>
        </motion.div>

        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={0}
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          <div className="flex border-b border-border overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-shrink-0 px-5 sm:px-7 py-4 font-mono text-[11px] sm:text-[12px] font-semibold uppercase tracking-[1px] transition-colors ${
                  activeTab === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="tab-underline-123"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {activeTab === "reference" && <ReferenceTab />}
              {activeTab === "tracker" && <SetupTrackerTab />}
              {activeTab === "checklist" && <ChecklistTab />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
