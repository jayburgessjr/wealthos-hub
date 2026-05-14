import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Activity, Landmark, Wheat, Zap,
  Brain, Trophy, Ticket, ExternalLink, Calculator, Info,
  Target, BarChart2, ChevronRight, AlertCircle, Filter
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ForexPair {
  pair: string; base: string; quote: string;
  rate: number; rawRate: number; changePct: number; change: number;
}
interface Commodity {
  ticker: string; name: string; unit: string; category: string;
  price: number; open: number; high: number; low: number;
  volume: number; changePct: number; change: number;
}
interface BondYield {
  id: string; label: string; maturity: number;
  yield: number; prevYield: number; change: number;
}
interface MarketData {
  forex: ForexPair[];
  commodities: Commodity[];
  bonds: { yields: BondYield[]; spread10y2y: number; inverted: boolean };
  updatedAt: string;
}
interface PolymarketEvent {
  id: string;
  title: string;
  volume: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  outcomes: { name: string; price: number }[];
  category?: string;
  url?: string;
}
interface OddsGame {
  id: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    title: string;
    markets: { key: string; outcomes: { name: string; price: number }[] }[];
  }[];
}
interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  yes_bid: number;   // cents (0–100)
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  volume_24h: number;
  open_interest: number;
  close_time: string;
  status: string;
  category?: string;
}

interface LotteryJackpot {
  name: string;
  jackpot: number;
  nextDraw: string;
  ticketPrice: number;
  oddsJackpot: number;
  oddsMillion: number;
  taxRate: number;
  lumpSumPct: number;
  color: string;
  logo: string;
}

const TABS = [
  { id: "forex",       label: "Forex",             icon: Activity  },
  { id: "commodities", label: "Commodities",        icon: Wheat     },
  { id: "bonds",       label: "Fixed Income",       icon: Landmark  },
  { id: "kalshi",      label: "Kalshi",             icon: Target    },
  { id: "predictions", label: "Polymarket",         icon: Brain     },
  { id: "sports",      label: "Sports Trading",     icon: Trophy    },
  { id: "lottery",     label: "Lottery / EV",       icon: Ticket    },
];

const COMMODITY_CATEGORIES = ["all", "metals", "energy", "agriculture"];

const FOREX_REGIONS: Record<string, { flag: string; name: string }> = {
  EUR: { flag: "🇪🇺", name: "Euro" },
  GBP: { flag: "🇬🇧", name: "British Pound" },
  JPY: { flag: "🇯🇵", name: "Japanese Yen" },
  AUD: { flag: "🇦🇺", name: "Australian Dollar" },
  CAD: { flag: "🇨🇦", name: "Canadian Dollar" },
  CHF: { flag: "🇨🇭", name: "Swiss Franc" },
  CNY: { flag: "🇨🇳", name: "Chinese Yuan" },
  HKD: { flag: "🇭🇰", name: "Hong Kong Dollar" },
  NOK: { flag: "🇳🇴", name: "Norwegian Krone" },
  SEK: { flag: "🇸🇪", name: "Swedish Krona" },
  NZD: { flag: "🇳🇿", name: "New Zealand Dollar" },
  SGD: { flag: "🇸🇬", name: "Singapore Dollar" },
  MXN: { flag: "🇲🇽", name: "Mexican Peso" },
  BRL: { flag: "🇧🇷", name: "Brazilian Real" },
  INR: { flag: "🇮🇳", name: "Indian Rupee" },
};

// Lottery data (jackpots updated via public APIs / static fallback)
const LOTTERIES: LotteryJackpot[] = [
  {
    name: "Powerball",
    jackpot: 500_000_000,
    nextDraw: "Saturday",
    ticketPrice: 2,
    oddsJackpot: 292_201_338,
    oddsMillion: 11_688_054,
    taxRate: 0.37,
    lumpSumPct: 0.60,
    color: "#FF4D6A",
    logo: "🔴",
  },
  {
    name: "Mega Millions",
    jackpot: 325_000_000,
    nextDraw: "Friday",
    ticketPrice: 2,
    oddsJackpot: 302_575_350,
    oddsMillion: 12_607_306,
    taxRate: 0.37,
    lumpSumPct: 0.60,
    color: "#FFB830",
    logo: "🟡",
  },
  {
    name: "Lucky for Life",
    jackpot: 1_000 * 365 * 20,
    nextDraw: "Monday / Thursday",
    ticketPrice: 2,
    oddsJackpot: 30_821_472,
    oddsMillion: 1_813_028,
    taxRate: 0.37,
    lumpSumPct: 0.55,
    color: "#00E5A0",
    logo: "🍀",
  },
  {
    name: "Cash4Life",
    jackpot: 1_000 * 365 * 20, // $1k/day for life
    nextDraw: "Monday / Thursday",
    ticketPrice: 2,
    oddsJackpot: 21_846_048,
    oddsMillion: 7_282_016,
    taxRate: 0.37,
    lumpSumPct: 0.60,
    color: "#06B6D4",
    logo: "💎",
  },
  {
    name: "Lotto America",
    jackpot: 12_600_000,
    nextDraw: "Wednesday / Saturday",
    ticketPrice: 1,
    oddsJackpot: 25_989_600,
    oddsMillion: 2_887_733,
    taxRate: 0.37,
    lumpSumPct: 0.60,
    color: "#8B5CF6",
    logo: "🇺🇸",
  },
  {
    name: "CA SuperLotto Plus",
    jackpot: 22_000_000,
    nextDraw: "Wednesday / Saturday",
    ticketPrice: 1,
    oddsJackpot: 41_416_353,
    oddsMillion: 1_592_937,
    taxRate: 0.133, // California state tax
    lumpSumPct: 0.60,
    color: "#F59E0B",
    logo: "🐻",
  },
  {
    name: "NY Lotto",
    jackpot: 8_400_000,
    nextDraw: "Wednesday / Saturday",
    ticketPrice: 1,
    oddsJackpot: 22_528_737,
    oddsMillion: 1_000_000,
    taxRate: 0.37 + 0.0882, // federal + NY state
    lumpSumPct: 0.58,
    color: "#EF4444",
    logo: "🗽",
  },
];

// Kelly Criterion
function kelly(prob: number, americanOdds: number) {
  const decimal = americanOdds > 0 ? americanOdds / 100 + 1 : 100 / Math.abs(americanOdds) + 1;
  const b = decimal - 1;
  const q = 1 - prob;
  const k = (b * prob - q) / b;
  return Math.max(0, k);
}

// Implied probability from American odds
function impliedProb(odds: number) {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

// American odds to decimal
function toDecimal(odds: number) {
  return odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
}

// ── Yield curve ───────────────────────────────────────────────────────────────
function YieldCurve({ yields }: { yields: BondYield[] }) {
  const sorted = [...yields].filter(y => y.maturity > 0).sort((a, b) => a.maturity - b.maturity);
  if (!sorted.length) return null;
  const values = sorted.map(y => y.yield);
  const min = Math.min(...values) - 0.1;
  const max = Math.max(...values) + 0.1;
  const range = max - min || 0.5;
  const W = 400; const H = 100;
  const pts = sorted.map((y, i) => {
    const x = (i / (sorted.length - 1)) * W;
    const yy = H - ((y.yield - min) / range) * H;
    return `${x},${yy}`;
  }).join(" ");
  const fillPts = `0,${H} ${pts} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3D8EFF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3D8EFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#curveGrad)" />
      <polyline points={pts} fill="none" stroke="#3D8EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 4px #3D8EFF60)" }} />
      {sorted.map((y, i) => {
        const x = (i / (sorted.length - 1)) * W;
        const yy = H - ((y.yield - min) / range) * H;
        return <circle key={y.id} cx={x} cy={yy} r={3} fill="#3D8EFF" />;
      })}
    </svg>
  );
}

// ── Probability bar ───────────────────────────────────────────────────────────
function ProbBar({ yes, no }: { yes: number; no: number }) {
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/40">
      <div className="h-full rounded-l-full bg-bullish transition-all" style={{ width: `${yes * 100}%` }} />
      <div className="h-full rounded-r-full bg-bearish transition-all" style={{ width: `${no * 100}%` }} />
    </div>
  );
}

// ── EV badge ──────────────────────────────────────────────────────────────────
function EVBadge({ ev }: { ev: number }) {
  const pos = ev > 0;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase ${
      pos ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
    }`}>
      EV {pos ? "+" : ""}{(ev * 100).toFixed(1)}¢
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Markets() {
  const [tab, setTab] = useState("forex");
  const [commFilter, setCommFilter] = useState("all");
  const [polyFilter, setPolyFilter] = useState("all");
  const [lotteryIdx, setLotteryIdx] = useState(0);
  const [betAmount, setBetAmount] = useState("100");
  const [oddsApiKey, setOddsApiKey] = useState("");
  const [selectedSport, setSelectedSport] = useState("americanfootball_nfl");
  const [kellyFraction, setKellyFraction] = useState<"full" | "half" | "quarter">("half");
  const [kalshiFilter, setKalshiFilter] = useState("all");

  // ── Lottery number picker ──────────────────────────────────────────────────
  const [selectedWhite, setSelectedWhite] = useState<number[]>([]);
  const [selectedBonus, setSelectedBonus] = useState<number | null>(null);
  const [savedPicks, setSavedPicks] = useState<{ white: number[]; bonus: number; label: string }[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<{ white: number[]; bonus: number } | null>(null);

  const PICKER_CONFIGS: Record<number, { whiteBalls: number; whiteMax: number; bonusMax: number; bonusLabel: string; bonusColor: string }> = {
    0: { whiteBalls: 5, whiteMax: 69, bonusMax: 26, bonusLabel: "Powerball",  bonusColor: "#FF4D6A" },
    5: { whiteBalls: 5, whiteMax: 47, bonusMax: 27, bonusLabel: "MEGA",       bonusColor: "#F59E0B" },
  };
  const pickerCfg = PICKER_CONFIGS[lotteryIdx];

  function toggleWhite(n: number) {
    setSelectedWhite(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : prev.length < (pickerCfg?.whiteBalls ?? 5) ? [...prev, n].sort((a, b) => a - b) : prev
    );
  }

  function quickPick() {
    if (!pickerCfg) return;
    const pool = Array.from({ length: pickerCfg.whiteMax }, (_, i) => i + 1);
    const shuffled = pool.sort(() => Math.random() - 0.5);
    setSelectedWhite(shuffled.slice(0, pickerCfg.whiteBalls).sort((a, b) => a - b));
    setSelectedBonus(Math.floor(Math.random() * pickerCfg.bonusMax) + 1);
    setDrawnNumbers(null);
  }

  function savePick() {
    if (!pickerCfg || selectedWhite.length < pickerCfg.whiteBalls || selectedBonus === null) return;
    setSavedPicks(prev => [
      { white: [...selectedWhite], bonus: selectedBonus, label: LOTTERIES[lotteryIdx].name },
      ...prev.slice(0, 9),
    ]);
  }

  function simulateDraw() {
    if (!pickerCfg) return;
    const pool = Array.from({ length: pickerCfg.whiteMax }, (_, i) => i + 1);
    const white = pool.sort(() => Math.random() - 0.5).slice(0, pickerCfg.whiteBalls).sort((a, b) => a - b);
    const bonus = Math.floor(Math.random() * pickerCfg.bonusMax) + 1;
    setDrawnNumbers({ white, bonus });
  }

  // ── Kalshi ─────────────────────────────────────────────────────────────────
  const { data: kalshiMarkets = [], isLoading: kalshiLoading, error: kalshiError } = useQuery<KalshiMarket[]>({
    queryKey: ["kalshi-markets"],
    queryFn: async () => {
      const res = await fetch(
        "https://trading-api.kalshi.com/trade-api/v2/markets?limit=30&status=open",
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) throw new Error("Kalshi API unavailable");
      const json = await res.json();
      return (json.markets ?? []) as KalshiMarket[];
    },
    staleTime: 60_000,
    retry: 1,
    enabled: tab === "kalshi",
  });

  const kalshiCategories = useMemo(() => {
    const cats = new Set(kalshiMarkets.map(m => m.category ?? "Other"));
    return ["all", ...Array.from(cats)];
  }, [kalshiMarkets]);

  const filteredKalshi = kalshiFilter === "all"
    ? kalshiMarkets
    : kalshiMarkets.filter(m => (m.category ?? "Other") === kalshiFilter);

  // ── Market data (forex / commodities / bonds) ──────────────────────────────
  const { data, isLoading } = useQuery<MarketData>({
    queryKey: ["market-data"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-market-data", { body: { type: "all" } });
      if (error) throw error;
      return data as MarketData;
    },
    staleTime: 120_000,
    retry: 1,
    enabled: ["forex", "commodities", "bonds"].includes(tab),
  });

  // ── Polymarket ─────────────────────────────────────────────────────────────
  const { data: polyMarkets = [], isLoading: polyLoading } = useQuery<PolymarketEvent[]>({
    queryKey: ["polymarket", polyFilter],
    queryFn: async () => {
      const url = `https://gamma-api.polymarket.com/markets?limit=30&active=true&closed=false&order=volume&ascending=false`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Polymarket API unavailable");
      const raw = await res.json();
      return (raw as any[]).map((m: any) => ({
        id: m.id,
        title: m.question ?? m.title ?? "Unknown",
        volume: parseFloat(m.volume ?? 0),
        liquidity: parseFloat(m.liquidity ?? 0),
        endDate: m.endDate ?? m.end_date_iso ?? "",
        active: m.active ?? true,
        category: m.category ?? "Other",
        url: `https://polymarket.com/event/${m.slug ?? m.id}`,
        outcomes: m.tokens
          ? m.tokens.map((t: any) => ({ name: t.outcome ?? t.title, price: parseFloat(t.price ?? 0.5) }))
          : [{ name: "Yes", price: parseFloat(m.outcomePrices?.[0] ?? 0.5) }, { name: "No", price: parseFloat(m.outcomePrices?.[1] ?? 0.5) }],
      }));
    },
    staleTime: 60_000,
    retry: 2,
    enabled: tab === "predictions",
  });

  const polyCategories = useMemo(() => {
    const cats = new Set(polyMarkets.map(m => m.category ?? "Other"));
    return ["all", ...Array.from(cats)];
  }, [polyMarkets]);

  const filteredPoly = polyFilter === "all"
    ? polyMarkets
    : polyMarkets.filter(m => m.category === polyFilter);

  // ── Odds API ───────────────────────────────────────────────────────────────
  const SPORTS = [
    { key: "americanfootball_nfl", label: "NFL" },
    { key: "basketball_nba",       label: "NBA" },
    { key: "baseball_mlb",         label: "MLB" },
    { key: "icehockey_nhl",        label: "NHL" },
    { key: "soccer_epl",           label: "Premier League" },
    { key: "soccer_uefa_champs_league", label: "Champions League" },
    { key: "mma_mixed_martial_arts", label: "MMA / UFC" },
    { key: "tennis_atp_wimbledon", label: "Tennis" },
  ];

  const { data: oddsData = [], isLoading: oddsLoading, error: oddsError } = useQuery<OddsGame[]>({
    queryKey: ["odds", selectedSport, oddsApiKey],
    queryFn: async () => {
      if (!oddsApiKey) return [];
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${selectedSport}/odds/?apiKey=${oddsApiKey}&regions=us&markets=h2h&oddsFormat=american`
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 120_000,
    enabled: tab === "sports" && !!oddsApiKey,
  });

  // ── Lottery EV ─────────────────────────────────────────────────────────────
  const lottery = LOTTERIES[lotteryIdx];
  const evCalc = useMemo(() => {
    if (!lottery) return null;
    const lumpSum = lottery.jackpot * lottery.lumpSumPct;
    const afterTax = lumpSum * (1 - lottery.taxRate);
    const ticketEV = (afterTax / lottery.oddsJackpot) - lottery.ticketPrice;
    const milEV = (1_000_000 * (1 - lottery.taxRate) / lottery.oddsMillion);
    const totalEV = ticketEV + milEV;
    const bet = parseFloat(betAmount) || 0;
    const tickets = Math.floor(bet / lottery.ticketPrice);
    const expectedReturn = tickets * (totalEV + lottery.ticketPrice);
    const expectedLoss = bet - expectedReturn;
    return { lumpSum, afterTax, ticketEV, totalEV, tickets, expectedReturn, expectedLoss };
  }, [lottery, betAmount]);

  // ── Shared helpers ─────────────────────────────────────────────────────────
  const forex = data?.forex ?? [];
  const commodities = (data?.commodities ?? []).filter(c =>
    commFilter === "all" ? true : c.category === commFilter
  );
  const bonds = data?.bonds ?? { yields: [], spread10y2y: 0, inverted: false };

  function PctBadge({ v }: { v: number }) {
    const pos = v >= 0;
    return (
      <span className={`flex items-center gap-1 font-mono text-sm font-bold ${pos ? "text-bullish" : "text-bearish"}`}>
        {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {pos ? "+" : ""}{v.toFixed(3)}%
      </span>
    );
  }

  const kFrac = kellyFraction === "full" ? 1 : kellyFraction === "half" ? 0.5 : 0.25;

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Zap size={12} className="text-muted-foreground" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Global Markets</span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">Markets</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Forex · Commodities · Fixed Income · Prediction Markets · Sports Trading · Lottery EV
          </p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                tab === t.id
                  ? "border-border bg-card text-foreground -mb-px"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════ FOREX ══════════════ */}
        {tab === "forex" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Pairs Tracked",  value: String(forex.length),         color: "text-foreground" },
                { label: "Rising",         value: String(forex.filter(f => f.changePct > 0).length), color: "text-bullish" },
                { label: "Falling",        value: String(forex.filter(f => f.changePct < 0).length), color: "text-bearish" },
                { label: "Base Currency",  value: "USD",                         color: "text-primary" },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
                  <p className={`font-mono text-xl font-black ${s.color}`}>{isLoading ? "—" : s.value}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    {["Pair","Name","Rate (vs USD)","Raw Rate","24h Change","Direction"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/40">
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-accent/40" /></td>
                          ))}
                        </tr>
                      ))
                    : forex.map((f, i) => {
                        const region = FOREX_REGIONS[f.base];
                        const pos = f.changePct >= 0;
                        return (
                          <motion.tr key={f.pair} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                            className="border-b border-border/40 transition-colors hover:bg-accent/20">
                            <td className="px-4 py-3 font-mono text-sm font-black text-foreground">{f.pair}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{region?.flag ?? "🌐"}</span>
                                <span className="text-xs text-muted-foreground">{region?.name ?? f.base}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-sm font-bold text-foreground">{f.rate.toFixed(5)}</td>
                            <td className="px-4 py-3 font-mono text-sm text-muted-foreground">1 USD = {f.rawRate.toFixed(4)} {f.base}</td>
                            <td className="px-4 py-3"><PctBadge v={f.changePct} /></td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${pos ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"}`}>
                                {pos ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                {pos ? "Gaining" : "Losing"}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-right text-xs uppercase tracking-widest text-muted-foreground/40">Data: Frankfurter · ECB reference rates</p>
          </motion.div>
        )}

        {/* ══════════════ COMMODITIES ══════════════ */}
        {tab === "commodities" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {COMMODITY_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCommFilter(cat)}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold capitalize transition-all ${commFilter === cat ? "border-watch/40 bg-watch/10 text-watch" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
                  {cat === "all" ? "All" : cat}
                </button>
              ))}
            </div>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-accent/30" />)}
              </div>
            ) : commodities.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20">
                <p className="font-mono text-xs uppercase text-muted-foreground/50">Market data unavailable — check POLYGON_KEY secret</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {commodities.map((c, i) => {
                  const pos = c.changePct >= 0;
                  const catColor = c.category === "metals" ? "#F59E0B" : c.category === "energy" ? "#3D8EFF" : "#00E5A0";
                  return (
                    <motion.div key={c.ticker} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80 hover:shadow-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-lg font-black text-foreground">{c.name}</span>
                            <span className="rounded-full px-2 py-0.5 text-xs font-bold uppercase" style={{ background: `${catColor}18`, color: catColor }}>{c.category}</span>
                          </div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground">{c.ticker} · {c.unit}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xl font-black text-foreground">${c.price.toFixed(2)}</p>
                          <p className={`flex items-center justify-end gap-1 font-mono text-sm font-bold ${pos ? "text-bullish" : "text-bearish"}`}>
                            {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{pos ? "+" : ""}{c.changePct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
                        {[{ label: "Open", value: `$${c.open?.toFixed(2)}` }, { label: "High", value: `$${c.high?.toFixed(2)}` }, { label: "Low", value: `$${c.low?.toFixed(2)}` }].map(s => (
                          <div key={s.label}>
                            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
                            <p className="font-mono text-xs font-bold text-foreground">{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            <p className="text-right text-xs uppercase tracking-widest text-muted-foreground/40">Metals: Polygon C:XAUUSD · ETFs: Polygon prev close</p>
          </motion.div>
        )}

        {/* ══════════════ BONDS ══════════════ */}
        {tab === "bonds" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className={`rounded-2xl border p-5 ${bonds.inverted ? "border-bearish/30 bg-bearish/5" : "border-bullish/30 bg-bullish/5"}`}>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">10Y–2Y Spread</p>
                <p className={`font-mono text-3xl font-black ${bonds.spread10y2y >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {bonds.spread10y2y >= 0 ? "+" : ""}{bonds.spread10y2y?.toFixed(2) ?? "—"}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{bonds.inverted ? "⚠ Inverted — recession signal" : "Normal — curve not inverted"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Fed Funds Rate</p>
                <p className="font-mono text-3xl font-black text-primary">{bonds.yields.find(y => y.id === "FEDFUNDS")?.yield?.toFixed(2) ?? "—"}%</p>
                <p className="mt-1 text-xs text-muted-foreground">Current effective rate</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">10-Year Yield</p>
                <p className="font-mono text-3xl font-black text-foreground">{bonds.yields.find(y => y.id === "DGS10")?.yield?.toFixed(2) ?? "—"}%</p>
                <p className="mt-1 text-xs text-muted-foreground">US Treasury benchmark</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-1 font-display text-sm font-bold text-foreground">US Treasury Yield Curve</h3>
              <p className="mb-4 text-xs text-muted-foreground uppercase tracking-widest">
                {bonds.inverted ? "Inverted — historically precedes recession 12–18 months out" : "Normal — positive slope, healthy credit conditions"}
              </p>
              <div className="h-24"><YieldCurve yields={bonds.yields} /></div>
              <div className="mt-3 flex justify-between">
                {bonds.yields.filter(y => y.maturity > 0).sort((a, b) => a.maturity - b.maturity).map(y => (
                  <span key={y.id} className="text-xs text-muted-foreground">{y.label.replace("-Year","Y").replace("-Month","M")}</span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    {["Maturity","Yield","Prev Yield","Change","Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/40">
                          {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-accent/40" /></td>)}
                        </tr>
                      ))
                    : bonds.yields.sort((a, b) => a.maturity - b.maturity).map((y, i) => {
                        const pos = y.change >= 0;
                        return (
                          <motion.tr key={y.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                            className="border-b border-border/40 transition-colors hover:bg-accent/20">
                            <td className="px-4 py-3 font-display text-sm font-bold text-foreground">{y.label}</td>
                            <td className="px-4 py-3 font-mono text-lg font-black text-primary">{y.yield?.toFixed(3) ?? "—"}%</td>
                            <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{y.prevYield?.toFixed(3) ?? "—"}%</td>
                            <td className={`px-4 py-3 font-mono text-sm font-bold ${pos ? "text-bullish" : "text-bearish"}`}>{pos ? "+" : ""}{y.change?.toFixed(3) ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${pos ? "bg-bearish/10 text-bearish" : "bg-bullish/10 text-bullish"}`}>
                                {pos ? "Rates Rising" : "Rates Falling"}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
            <p className="text-right text-xs uppercase tracking-widest text-muted-foreground/40">Data: FRED · Federal Reserve Bank of St. Louis</p>
          </motion.div>
        )}

        {/* ══════════════ KALSHI ══════════════ */}
        {tab === "kalshi" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Target size={15} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-mono text-xs font-bold text-foreground">Kalshi — CFTC-Regulated Event Contracts</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Kalshi is the first US federally regulated prediction market. Unlike crypto-based Polymarket, Kalshi is supervised by the CFTC and settles in USD. Prices represent the market's probability estimate for each event.
                  <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer" className="ml-1 text-primary underline">kalshi.com</a>
                </p>
              </div>
            </div>

            {/* Stats */}
            {!kalshiError && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Open Markets",   value: String(kalshiMarkets.length),                                                                       color: "text-foreground" },
                  { label: "Total Volume",   value: `$${(kalshiMarkets.reduce((a, m) => a + (m.volume ?? 0), 0) / 1000).toFixed(0)}K`,                  color: "text-primary"    },
                  { label: "24h Volume",     value: `$${(kalshiMarkets.reduce((a, m) => a + (m.volume_24h ?? 0), 0) / 1000).toFixed(0)}K`,              color: "text-bullish"    },
                  { label: "Open Interest",  value: `$${(kalshiMarkets.reduce((a, m) => a + (m.open_interest ?? 0), 0) / 1000).toFixed(0)}K`,           color: "text-watch"      },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
                    <p className={`font-mono text-lg font-black ${s.color}`}>{kalshiLoading ? "—" : s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Category filter */}
            {kalshiCategories.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {kalshiCategories.slice(0, 10).map(cat => (
                  <button key={cat} onClick={() => setKalshiFilter(cat)}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold capitalize transition-all ${
                      kalshiFilter === cat
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}>
                    {cat === "all" ? "All Categories" : cat}
                  </button>
                ))}
              </div>
            )}

            {/* Market cards or fallback */}
            {kalshiLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-accent/30" />)}
              </div>
            ) : kalshiError ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-watch/20 bg-watch/5 p-4">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-watch" />
                  <div>
                    <p className="font-mono text-xs font-bold text-foreground">Kalshi API Unavailable</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      CORS restrictions are blocking the browser request. To resolve this, add a Supabase edge function proxy for Kalshi or use the Kalshi API key with server-side requests.
                      Below are illustrative market examples.
                    </p>
                  </div>
                </div>

                {/* Fallback mock markets */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    { ticker: "FED-25MAY-B450", title: "Fed holds rates at 4.25–4.50% in May 2025?", yes: 0.89, volume: 284000, close: "2025-05-07", category: "Economics" },
                    { ticker: "KXBTCD-25-B80000", title: "Bitcoin above $80,000 by end of Q2 2025?", yes: 0.61, volume: 512000, close: "2025-06-30", category: "Crypto" },
                    { ticker: "UNEMP-APR25-B4", title: "US unemployment rate below 4.0% in April?", yes: 0.74, volume: 96000, close: "2025-05-02", category: "Economics" },
                    { ticker: "CPICORE-APR-B03", title: "Core CPI month-over-month below 0.3% in April?", yes: 0.52, volume: 178000, close: "2025-05-13", category: "Economics" },
                    { ticker: "SP500-Q2-B5500", title: "S&P 500 above 5,500 at end of Q2 2025?", yes: 0.47, volume: 341000, close: "2025-06-30", category: "Financials" },
                    { ticker: "RECESSION-2025", title: "US enters recession in 2025?", yes: 0.28, volume: 892000, close: "2025-12-31", category: "Economics" },
                    { ticker: "NVIDIA-Q1BEAT", title: "NVIDIA beats Q1 EPS estimates?", yes: 0.72, volume: 127000, close: "2025-05-28", category: "Equities" },
                    { ticker: "GOLD-Q2-B2500", title: "Gold above $2,500/oz at end of Q2?", yes: 0.58, volume: 203000, close: "2025-06-30", category: "Commodities" },
                  ].map((m, i) => {
                    const no = 1 - m.yes;
                    const vol = m.volume >= 1e6 ? `$${(m.volume / 1e6).toFixed(1)}M` : `$${(m.volume / 1e3).toFixed(0)}K`;
                    return (
                      <motion.div key={m.ticker} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="group rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="rounded-full border border-border bg-accent px-2 py-0.5 text-xs text-muted-foreground">{m.category}</span>
                          <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-bold text-primary">CFTC Regulated</span>
                        </div>
                        <p className="font-display text-sm font-bold leading-snug text-foreground mb-3">{m.title}</p>
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                          <div className="h-full rounded-l-full bg-bullish" style={{ width: `${m.yes * 100}%` }} />
                          <div className="h-full rounded-r-full bg-bearish" style={{ width: `${no * 100}%` }} />
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="flex gap-3">
                            <span className="font-mono text-sm font-black text-bullish">{(m.yes * 100).toFixed(0)}¢ Yes</span>
                            <span className="font-mono text-sm font-black text-bearish">{(no * 100).toFixed(0)}¢ No</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Vol {vol} · Closes {new Date(m.close).toLocaleDateString()}
                          </div>
                        </div>
                        <p className="mt-1.5 text-xs uppercase tracking-widest text-muted-foreground/40">{m.ticker}</p>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-5 py-2.5 font-mono text-xs font-bold text-primary hover:brightness-110">
                    Open Kalshi <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ) : filteredKalshi.length === 0 ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-border py-16">
                <p className="font-mono text-xs uppercase text-muted-foreground/50">No open markets</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredKalshi.map((m, i) => {
                  const yesPct = m.last_price ?? m.yes_bid ?? 50;
                  const noPct = 100 - yesPct;
                  const vol = (m.volume ?? 0) >= 1e6
                    ? `$${((m.volume ?? 0) / 1e6).toFixed(1)}M`
                    : `$${((m.volume ?? 0) / 1e3).toFixed(0)}K`;
                  const closeDate = m.close_time ? new Date(m.close_time).toLocaleDateString() : "—";
                  return (
                    <motion.div key={m.ticker} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30">
                      <div className="mb-1.5 flex flex-wrap gap-1.5">
                        {m.category && (
                          <span className="rounded-full border border-border bg-accent px-2 py-0.5 text-xs text-muted-foreground">{m.category}</span>
                        )}
                        <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-bold text-primary">CFTC</span>
                      </div>
                      <p className="font-display text-sm font-bold leading-snug text-foreground mb-3">{m.title}</p>
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                        <div className="h-full rounded-l-full bg-bullish transition-all" style={{ width: `${yesPct}%` }} />
                        <div className="h-full rounded-r-full bg-bearish transition-all" style={{ width: `${noPct}%` }} />
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="flex gap-3">
                          <span className="font-mono text-sm font-black text-bullish">{yesPct}¢ Yes</span>
                          <span className="font-mono text-sm font-black text-bearish">{noPct}¢ No</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Vol {vol} · Closes {closeDate}
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs uppercase tracking-widest text-muted-foreground/40">{m.ticker}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
            <p className="text-right text-xs uppercase tracking-widest text-muted-foreground/40">
              Data: Kalshi API · CFTC-regulated prediction contracts · Prices in cents (1¢ = 1%)
            </p>
          </motion.div>
        )}

        {/* ══════════════ PREDICTION MARKETS ══════════════ */}
        {tab === "predictions" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Info size={15} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-mono text-xs font-bold text-foreground">Prediction Markets</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Real-money markets where the price = the market's estimated probability of an event occurring. Powered by Polymarket — a decentralized prediction exchange on Polygon.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Active Markets", value: String(polyMarkets.length),                                  color: "text-foreground" },
                { label: "Total Volume",   value: `$${(polyMarkets.reduce((a,m) => a + m.volume, 0) / 1e6).toFixed(1)}M`, color: "text-primary" },
                { label: "Total Liquidity",value: `$${(polyMarkets.reduce((a,m) => a + m.liquidity, 0) / 1e6).toFixed(1)}M`, color: "text-bullish" },
                { label: "Categories",     value: String(polyCategories.length - 1),                          color: "text-watch" },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
                  <p className={`font-mono text-lg font-black ${s.color}`}>{polyLoading ? "—" : s.value}</p>
                </div>
              ))}
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-1.5">
              {polyCategories.slice(0, 10).map(cat => (
                <button key={cat} onClick={() => setPolyFilter(cat)}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold capitalize transition-all ${
                    polyFilter === cat ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}>
                  {cat === "all" ? "All Categories" : cat}
                </button>
              ))}
            </div>

            {/* Market cards */}
            {polyLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-accent/30" />)}
              </div>
            ) : filteredPoly.length === 0 ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-border py-16">
                <p className="font-mono text-xs uppercase text-muted-foreground/50">No markets available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredPoly.map((m, i) => {
                  const yes = m.outcomes.find(o => o.name.toLowerCase() === "yes")?.price ?? m.outcomes[0]?.price ?? 0.5;
                  const no = 1 - yes;
                  const volume = m.volume >= 1e6 ? `$${(m.volume / 1e6).toFixed(1)}M` : `$${(m.volume / 1e3).toFixed(0)}K`;
                  const endDate = m.endDate ? new Date(m.endDate).toLocaleDateString() : "—";
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="group rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <p className="font-display text-sm font-bold leading-snug text-foreground">{m.title}</p>
                        <a href={m.url} target="_blank" rel="noopener noreferrer"
                          className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary">
                          <ExternalLink size={13} />
                        </a>
                      </div>
                      <ProbBar yes={yes} no={no} />
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-black text-bullish">{(yes * 100).toFixed(1)}% Yes</span>
                          <span className="font-mono text-sm font-black text-bearish">{(no * 100).toFixed(1)}% No</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                          <span>Vol {volume}</span>
                          <span>·</span>
                          <span>Ends {endDate}</span>
                        </div>
                      </div>
                      {m.category && (
                        <div className="mt-2">
                          <span className="rounded-full border border-border bg-accent px-2 py-0.5 text-xs text-muted-foreground">{m.category}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
            <p className="text-right text-xs uppercase tracking-widest text-muted-foreground/40">
              Data: Polymarket · Decentralized prediction market · USDC collateral
            </p>
          </motion.div>
        )}

        {/* ══════════════ SPORTS TRADING ══════════════ */}
        {tab === "sports" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Info */}
            <div className="flex items-start gap-3 rounded-xl border border-watch/20 bg-watch/5 p-4">
              <Trophy size={15} className="mt-0.5 shrink-0 text-watch" />
              <div>
                <p className="font-mono text-xs font-bold text-foreground">Sports Trading — Kelly Criterion Sizing</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Treat sports betting as a capital allocation problem. The Kelly Criterion tells you what % of bankroll to deploy based on your edge over the market.
                  Enter your <a href="https://the-odds-api.com" target="_blank" rel="noopener noreferrer" className="text-watch underline">The Odds API</a> key to load live lines.
                </p>
              </div>
            </div>

            {/* API key input + sport selector */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
                <Target size={13} className="shrink-0 text-muted-foreground" />
                <input
                  type="password"
                  value={oddsApiKey}
                  onChange={e => setOddsApiKey(e.target.value)}
                  placeholder="Paste Odds API key (free tier: 500 req/mo)"
                  className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <select value={selectedSport} onChange={e => setSelectedSport(e.target.value)}
                className="rounded-xl border border-border bg-card px-4 py-2.5 font-mono text-xs text-foreground outline-none">
                {SPORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
                {(["full","half","quarter"] as const).map(f => (
                  <button key={f} onClick={() => setKellyFraction(f)}
                    className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition-all ${kellyFraction === f ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {f === "full" ? "Full Kelly" : f === "half" ? "½ Kelly" : "¼ Kelly"}
                  </button>
                ))}
              </div>
            </div>

            {!oddsApiKey ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20">
                <Trophy size={32} className="text-muted-foreground/20" />
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/50">Add Odds API key above to load live lines</p>
                <a href="https://the-odds-api.com/#get-access" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-watch/30 bg-watch/10 px-4 py-2 font-mono text-xs font-bold text-watch hover:brightness-110">
                  Get Free API Key <ExternalLink size={11} />
                </a>
              </div>
            ) : oddsLoading ? (
              <div className="grid grid-cols-1 gap-4">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-accent/30" />)}
              </div>
            ) : oddsError ? (
              <div className="flex items-center justify-center rounded-2xl border border-bearish/30 bg-bearish/5 py-10">
                <p className="font-mono text-xs text-bearish">API error — check key or try again</p>
              </div>
            ) : oddsData.length === 0 ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-border py-12">
                <p className="font-mono text-xs uppercase text-muted-foreground/50">No upcoming games found for this sport</p>
              </div>
            ) : (
              <div className="space-y-3">
                {oddsData.slice(0, 20).map((game, i) => {
                  const book = game.bookmakers?.[0];
                  const market = book?.markets?.find(m => m.key === "h2h");
                  const homeOdds = market?.outcomes?.find(o => o.name === game.home_team)?.price ?? 0;
                  const awayOdds = market?.outcomes?.find(o => o.name === game.away_team)?.price ?? 0;
                  const homeProb = impliedProb(homeOdds);
                  const awayProb = impliedProb(awayOdds);
                  const homeKelly = kelly(homeProb, homeOdds) * kFrac * 100;
                  const awayKelly = kelly(awayProb, awayOdds) * kFrac * 100;
                  const homeEV = (homeProb * (toDecimal(homeOdds) - 1)) - (1 - homeProb);
                  const awayEV = (awayProb * (toDecimal(awayOdds) - 1)) - (1 - awayProb);
                  const commence = new Date(game.commence_time);
                  return (
                    <motion.div key={game.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground">{game.sport_title} · {book?.title ?? "N/A"}</p>
                          <p className="text-xs text-muted-foreground/60">{commence.toLocaleDateString()} {commence.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <EVBadge ev={homeEV} />
                          <EVBadge ev={awayEV} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { team: game.away_team, odds: awayOdds, prob: awayProb, kelly: awayKelly, ev: awayEV, label: "Away" },
                          { team: game.home_team, odds: homeOdds, prob: homeProb, kelly: homeKelly, ev: homeEV, label: "Home" },
                        ].map(side => (
                          <div key={side.team} className={`rounded-xl border p-3 ${side.ev > 0 ? "border-bullish/20 bg-bullish/5" : "border-border bg-accent/20"}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">{side.label}</p>
                                <p className="font-display text-sm font-bold text-foreground">{side.team}</p>
                              </div>
                              <p className={`font-mono text-lg font-black ${side.odds > 0 ? "text-bullish" : "text-foreground"}`}>
                                {side.odds > 0 ? "+" : ""}{side.odds}
                              </p>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-1">
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">Implied</p>
                                <p className="font-mono text-xs font-bold text-foreground">{(side.prob * 100).toFixed(1)}%</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">Kelly</p>
                                <p className={`font-mono text-xs font-bold ${side.kelly > 0 ? "text-watch" : "text-muted-foreground"}`}>{side.kelly.toFixed(2)}%</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">Edge</p>
                                <p className={`font-mono text-xs font-bold ${side.ev > 0 ? "text-bullish" : "text-bearish"}`}>{(side.ev * 100).toFixed(1)}¢</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            <p className="text-right text-xs uppercase tracking-widest text-muted-foreground/40">
              Data: The Odds API · Kelly Criterion position sizing · {kellyFraction === "full" ? "Full" : kellyFraction === "half" ? "½" : "¼"} Kelly applied
            </p>
          </motion.div>
        )}

        {/* ══════════════ LOTTERY EV ══════════════ */}
        {tab === "lottery" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Info */}
            <div className="flex items-start gap-3 rounded-xl border border-bearish/20 bg-bearish/5 p-4">
              <Calculator size={15} className="mt-0.5 shrink-0 text-bearish" />
              <div>
                <p className="font-mono text-xs font-bold text-foreground">Expected Value Analysis</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Lottery tickets are negative EV assets — but at extreme jackpot sizes the EV improves significantly. This tool calculates the after-tax, lump-sum expected return per dollar spent.
                </p>
              </div>
            </div>

            {/* Lottery selector */}
            <div className="flex flex-wrap gap-2">
              {LOTTERIES.map((l, i) => (
                <button key={l.name} onClick={() => setLotteryIdx(i)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-sm font-bold transition-all ${
                    lotteryIdx === i ? "border-current text-foreground bg-accent" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  style={lotteryIdx === i ? { borderColor: l.color, color: l.color } : undefined}>
                  <span>{l.logo}</span> {l.name}
                </button>
              ))}
            </div>

            {/* ── Number Picker (Powerball / CA SuperLotto Plus) ── */}
            {pickerCfg && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-foreground">
                    <Ticket size={14} className="mr-2 inline" />
                    Pick Your Numbers — {LOTTERIES[lotteryIdx].name}
                  </h3>
                  <button onClick={quickPick}
                    className="rounded-lg border border-border bg-accent/30 px-3 py-1.5 font-mono text-xs font-bold text-foreground hover:bg-accent transition-all">
                    Quick Pick
                  </button>
                </div>

                {/* White balls grid */}
                <div>
                  <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                    Pick {pickerCfg.whiteBalls} numbers (1–{pickerCfg.whiteMax})
                    <span className="ml-2 text-bullish">{selectedWhite.length}/{pickerCfg.whiteBalls} selected</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: pickerCfg.whiteMax }, (_, i) => i + 1).map(n => {
                      const sel = selectedWhite.includes(n);
                      const drawn = drawnNumbers?.white.includes(n);
                      const match = sel && drawn;
                      return (
                        <button key={n} onClick={() => toggleWhite(n)}
                          className={`h-8 w-8 rounded-full font-mono text-xs font-bold transition-all border
                            ${match ? "bg-bullish text-background border-bullish shadow-[0_0_8px_rgba(0,204,115,0.6)]"
                              : sel ? "bg-foreground text-background border-foreground"
                              : drawn ? "border-bullish/40 text-bullish/60 bg-bullish/10"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bonus ball grid */}
                <div>
                  <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                    Pick 1 {pickerCfg.bonusLabel} (1–{pickerCfg.bonusMax})
                    {selectedBonus !== null && (
                      <span className="ml-2" style={{ color: pickerCfg.bonusColor }}>Selected: {selectedBonus}</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: pickerCfg.bonusMax }, (_, i) => i + 1).map(n => {
                      const sel = selectedBonus === n;
                      const drawn = drawnNumbers?.bonus === n;
                      const match = sel && drawn;
                      return (
                        <button key={n} onClick={() => setSelectedBonus(sel ? null : n)}
                          className={`h-8 w-8 rounded-full font-mono text-xs font-bold transition-all border
                            ${match ? "text-background shadow-[0_0_8px_rgba(0,204,115,0.6)]"
                              : sel ? "text-background"
                              : drawn ? "border-2"
                              : "border-border text-muted-foreground hover:text-foreground"}`}
                          style={
                            match ? { background: pickerCfg.bonusColor, borderColor: pickerCfg.bonusColor }
                            : sel ? { background: pickerCfg.bonusColor, borderColor: pickerCfg.bonusColor }
                            : drawn ? { borderColor: pickerCfg.bonusColor, color: pickerCfg.bonusColor }
                            : undefined
                          }>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action row */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={savePick}
                    disabled={selectedWhite.length < pickerCfg.whiteBalls || selectedBonus === null}
                    className="rounded-lg border border-border px-4 py-2 font-mono text-xs font-bold text-foreground hover:bg-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    Save Pick
                  </button>
                  <button onClick={simulateDraw}
                    className="rounded-lg px-4 py-2 font-mono text-xs font-bold text-background transition-all hover:opacity-90"
                    style={{ background: lottery.color }}>
                    Simulate Draw
                  </button>
                  {(selectedWhite.length > 0 || selectedBonus !== null || drawnNumbers) && (
                    <button onClick={() => { setSelectedWhite([]); setSelectedBonus(null); setDrawnNumbers(null); }}
                      className="rounded-lg border border-border/50 px-4 py-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-all">
                      Clear
                    </button>
                  )}
                </div>

                {/* Drawn numbers display */}
                {drawnNumbers && (
                  <div className="rounded-xl border border-bullish/20 bg-bullish/5 p-4">
                    <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Simulated Draw Result</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {drawnNumbers.white.map(n => (
                        <span key={n}
                          className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-black border ${
                            selectedWhite.includes(n) ? "bg-bullish text-background border-bullish" : "border-border text-foreground"
                          }`}>
                          {n}
                        </span>
                      ))}
                      <span className="mx-1 text-muted-foreground">+</span>
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-black border`}
                        style={
                          selectedBonus === drawnNumbers.bonus
                            ? { background: pickerCfg.bonusColor, borderColor: pickerCfg.bonusColor, color: "#000" }
                            : { borderColor: pickerCfg.bonusColor, color: pickerCfg.bonusColor }
                        }>
                        {drawnNumbers.bonus}
                      </span>
                    </div>
                    {(() => {
                      const whiteMatches = selectedWhite.filter(n => drawnNumbers.white.includes(n)).length;
                      const bonusMatch = selectedBonus === drawnNumbers.bonus;
                      const total = whiteMatches + (bonusMatch ? 1 : 0);
                      return (
                        <p className="mt-3 font-mono text-sm">
                          <span className={`font-black ${total >= 3 ? "text-bullish" : "text-muted-foreground"}`}>
                            {whiteMatches} white{whiteMatches !== 1 ? "s" : ""} + {bonusMatch ? "1" : "0"} {pickerCfg.bonusLabel} matched
                          </span>
                          {total === 0 && <span className="ml-2 text-muted-foreground/60">· No match — try again!</span>}
                          {total === pickerCfg.whiteBalls + 1 && <span className="ml-2 text-bullish"> 🎉 JACKPOT!</span>}
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* Saved picks */}
                {savedPicks.filter(p => p.label === LOTTERIES[lotteryIdx].name).length > 0 && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Saved Picks</p>
                    <div className="space-y-2">
                      {savedPicks.filter(p => p.label === LOTTERIES[lotteryIdx].name).map((pick, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/50 bg-accent/20 px-3 py-2">
                          {pick.white.map(n => (
                            <span key={n}
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold border ${
                                drawnNumbers?.white.includes(n) ? "bg-bullish text-background border-bullish" : "border-border text-foreground"
                              }`}>
                              {n}
                            </span>
                          ))}
                          <span className="mx-0.5 text-muted-foreground text-xs">+</span>
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold border"
                            style={
                              drawnNumbers?.bonus === pick.bonus
                                ? { background: pickerCfg.bonusColor, borderColor: pickerCfg.bonusColor, color: "#000" }
                                : { borderColor: pickerCfg.bonusColor, color: pickerCfg.bonusColor }
                            }>
                            {pick.bonus}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {evCalc && (
              <>
                {/* Jackpot header */}
                <div className="rounded-2xl border p-6 text-center" style={{ borderColor: `${lottery.color}40`, background: `${lottery.color}08` }}>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Current Jackpot</p>
                  <p className="font-display text-5xl font-black" style={{ color: lottery.color }}>
                    ${(lottery.jackpot / 1e6).toFixed(0)}M
                  </p>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">Next draw: {lottery.nextDraw} · ${lottery.ticketPrice} per ticket</p>
                </div>

                {/* EV breakdown grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Lump Sum (pre-tax)", value: `$${(evCalc.lumpSum / 1e6).toFixed(1)}M`, color: "text-foreground", sub: `${(lottery.lumpSumPct * 100).toFixed(0)}% of advertised` },
                    { label: "After Tax (37%)",    value: `$${(evCalc.afterTax / 1e6).toFixed(1)}M`,  color: "text-watch",      sub: "Federal + state est." },
                    { label: "EV per Ticket",      value: evCalc.totalEV >= 0 ? `+$${evCalc.totalEV.toFixed(4)}` : `-$${Math.abs(evCalc.totalEV).toFixed(4)}`, color: evCalc.totalEV >= 0 ? "text-bullish" : "text-bearish", sub: "vs $2 ticket cost" },
                    { label: "Odds of Jackpot",    value: `1 in ${(lottery.oddsJackpot / 1e6).toFixed(0)}M`, color: "text-muted-foreground", sub: "Your chance" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
                      <p className={`font-mono text-base font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground/60">{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Investment calculator */}
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="mb-4 font-display text-sm font-bold text-foreground">
                    <Calculator size={14} className="mr-2 inline" />
                    Ticket Investment Calculator
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
                      <span className="font-mono text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={betAmount}
                        onChange={e => setBetAmount(e.target.value)}
                        className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none"
                        placeholder="Amount to spend"
                        min="2"
                        step="2"
                      />
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                    <div className="font-mono text-sm text-muted-foreground">
                      <span className="font-bold text-foreground">{evCalc.tickets}</span> tickets
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { label: "You Spend",        value: `$${parseFloat(betAmount || "0").toLocaleString()}`,       color: "text-bearish" },
                      { label: "Expected Return",  value: `$${evCalc.expectedReturn.toFixed(4)}`,                   color: evCalc.expectedReturn >= parseFloat(betAmount || "0") ? "text-bullish" : "text-muted-foreground" },
                      { label: "Expected Loss",    value: `-$${evCalc.expectedLoss.toFixed(2)}`,                    color: "text-bearish" },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border border-border bg-accent/30 p-4 text-center">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
                        <p className={`font-mono text-lg font-black ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground/50">
                    ⚠ This is a mathematical analysis tool. Lottery is entertainment, not investment. EV assumes a single winner splits no jackpot.
                    State taxes vary — this uses a flat 37% federal estimate. Seek qualified tax advice.
                  </p>
                </div>

                {/* Probability visualization */}
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="mb-4 font-display text-sm font-bold text-foreground">Probability Context</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Win jackpot",           odds: lottery.oddsJackpot,  color: lottery.color },
                      { label: "Win $1M+",              odds: lottery.oddsMillion,  color: "#F59E0B" },
                      { label: "Struck by lightning",   odds: 1_000_000,            color: "#3D8EFF" },
                      { label: "Dealt a royal flush",   odds: 649_740,              color: "#8B5CF6" },
                      { label: "Flip 20 heads in a row",odds: 1_048_576,            color: "#00E5A0" },
                    ].map(item => {
                      const barWidth = Math.max(0.2, Math.min(100, (1_000_000 / item.odds) * 100));
                      return (
                        <div key={item.label} className="flex items-center gap-4">
                          <div className="w-44 shrink-0 font-mono text-xs text-muted-foreground">{item.label}</div>
                          <div className="flex flex-1 items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/40">
                              <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}60` }} />
                            </div>
                            <span className="w-28 shrink-0 text-xs text-muted-foreground text-right">1 in {item.odds.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            <p className="text-right text-xs uppercase tracking-widest text-muted-foreground/40">
              Jackpot data: static estimates · Tax: 37% federal flat rate · Not financial advice
            </p>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
