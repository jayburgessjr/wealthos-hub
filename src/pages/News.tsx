import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, TrendingUp, TrendingDown, Minus, Calendar,
  Radio, Filter, ExternalLink, Clock, Tag, Zap, ChevronDown,
  AlertCircle, BarChart2, Globe, Search
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

// ── Types ──────────────────────────────────────────────────────────────────────
type Sentiment = "bullish" | "bearish" | "neutral";
type Category = "macro" | "fed" | "earnings" | "crypto" | "commodities" | "geopolitical" | "tech";

interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  category: Category;
  sentiment: Sentiment;
  sentimentScore: number; // -1 to 1
  tickers: string[];
  publishedAt: Date;
  impact: "high" | "medium" | "low";
  url?: string;
}

interface EconEvent {
  id: string;
  name: string;
  date: Date;
  time: string;
  importance: "high" | "medium" | "low";
  previous?: string;
  forecast?: string;
  actual?: string;
  country: string;
  flag: string;
  description: string;
}

// ── Mock data — realistic, date-anchored ──────────────────────────────────────
const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const daysFromNow = (d: number) => {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + d);
  return dt;
};

const ARTICLES: NewsArticle[] = [
  {
    id: "1", source: "Bloomberg", category: "fed", sentiment: "bearish", sentimentScore: -0.62,
    headline: "Fed Officials Signal Higher-for-Longer Stance as Inflation Proves Sticky",
    summary: "Federal Reserve policymakers reinforced their commitment to maintaining restrictive monetary policy after core PCE data came in above expectations for the third consecutive month. Markets are now pricing in zero cuts for 2025.",
    tickers: ["SPY", "TLT", "GLD"], publishedAt: hoursAgo(0.5), impact: "high",
  },
  {
    id: "2", source: "Reuters", category: "tech", sentiment: "bullish", sentimentScore: 0.78,
    headline: "NVIDIA Posts Record Data Center Revenue; Raises Full-Year Guidance",
    summary: "NVIDIA's quarterly results smashed expectations with data center revenue surging 427% YoY to $22.6B. CEO Jensen Huang cited insatiable AI infrastructure demand and announced a $10B share buyback program.",
    tickers: ["NVDA", "AMD", "INTC", "SMCI"], publishedAt: hoursAgo(1.2), impact: "high",
  },
  {
    id: "3", source: "Financial Times", category: "macro", sentiment: "neutral", sentimentScore: -0.08,
    headline: "US GDP Growth Revised Down to 1.6% in Q1, Below Initial 2.4% Estimate",
    summary: "The Bureau of Economic Analysis revised first-quarter GDP growth sharply lower, reflecting weaker consumer spending and a larger trade deficit. Analysts remain divided on whether this signals a soft landing or the beginning of a slowdown.",
    tickers: ["SPY", "DXY"], publishedAt: hoursAgo(2.8), impact: "high",
  },
  {
    id: "4", source: "CoinDesk", category: "crypto", sentiment: "bullish", sentimentScore: 0.71,
    headline: "Bitcoin ETF Inflows Hit $1.2B in Single Day as Institutional Demand Surges",
    summary: "US-listed spot Bitcoin ETFs recorded their highest single-day inflows since launch, led by BlackRock's IBIT and Fidelity's FBTC. Options market positioning suggests traders are positioned for a move to $90K.",
    tickers: ["BTC", "IBIT", "FBTC", "MSTR"], publishedAt: hoursAgo(3.5), impact: "high",
  },
  {
    id: "5", source: "WSJ", category: "earnings", sentiment: "bullish", sentimentScore: 0.54,
    headline: "Apple Beats Revenue Estimates; Services Business Hits All-Time High",
    summary: "Apple reported better-than-expected quarterly earnings driven by record Services revenue of $23.9B. iPhone sales were slightly below estimates, but management's upbeat commentary on Vision Pro adoption lifted shares in after-hours trading.",
    tickers: ["AAPL"], publishedAt: hoursAgo(5.1), impact: "medium",
  },
  {
    id: "6", source: "CNBC", category: "geopolitical", sentiment: "bearish", sentimentScore: -0.45,
    headline: "Oil Surges 4% as Middle East Tensions Escalate; Brent Tops $92",
    summary: "Crude prices jumped sharply after reports of escalating conflict in a key shipping corridor raised supply disruption fears. Analysts warn that sustained prices above $90 could reignite inflation and complicate the Fed's easing path.",
    tickers: ["USO", "XLE", "CVX", "XOM"], publishedAt: hoursAgo(6.9), impact: "high",
  },
  {
    id: "7", source: "Bloomberg", category: "macro", sentiment: "bullish", sentimentScore: 0.38,
    headline: "Job Openings Fall to Lowest Since 2021, Signaling Labor Market Cooling",
    summary: "JOLTS data showed job openings declined to 8.49M, closer to pre-pandemic norms. The quits rate also fell, which the Fed views as a key indicator of wage pressure. Bond markets rallied on hopes this data gives the Fed room to cut.",
    tickers: ["TLT", "IEF", "SPY"], publishedAt: hoursAgo(9.4), impact: "medium",
  },
  {
    id: "8", source: "The Block", category: "crypto", sentiment: "neutral", sentimentScore: 0.12,
    headline: "Ethereum Pectra Upgrade Testnet Goes Live; EIP-7702 Draws Mixed Reactions",
    summary: "Ethereum's Pectra upgrade — the most significant since Dencun — deployed to the Holesky testnet. Developers highlighted EIP-7702's account abstraction improvements but debated its security implications for smart contract wallets.",
    tickers: ["ETH", "ETHENA"], publishedAt: hoursAgo(11.2), impact: "medium",
  },
  {
    id: "9", source: "Reuters", category: "commodities", sentiment: "bearish", sentimentScore: -0.33,
    headline: "Gold Pulls Back from Record Highs as Dollar Strengthens Post-Fed Comments",
    summary: "Gold retreated 1.8% from record levels above $2,400 after Fed officials pushed back on near-term rate cut expectations. Central bank buying remains a structural tailwind, but analysts caution on short-term dollar strength.",
    tickers: ["GLD", "SLV", "GDX"], publishedAt: hoursAgo(13.6), impact: "medium",
  },
  {
    id: "10", source: "FT", category: "tech", sentiment: "bearish", sentimentScore: -0.29,
    headline: "Tesla Deliveries Miss Estimates by 7%; Price Wars Squeeze Margins Further",
    summary: "Tesla reported Q1 deliveries of 386,810 vehicles, below the 449,000 analyst consensus. The company blamed factory shutdowns and Red Sea logistics disruptions. Margins compressed to 17.4%, the lowest since 2019.",
    tickers: ["TSLA"], publishedAt: hoursAgo(16.0), impact: "medium",
  },
  {
    id: "11", source: "Bloomberg", category: "fed", sentiment: "neutral", sentimentScore: -0.15,
    headline: "Waller Says 'No Rush' to Cut Rates; Wants Several More Months of Good Data",
    summary: "Fed Governor Christopher Waller stated that while inflation is moving in the right direction, the Fed needs several more months of positive data before considering rate cuts. He did not rule out cuts in 2025 but pushed back on timing.",
    tickers: ["TLT", "SPY", "DXY"], publishedAt: hoursAgo(18.5), impact: "high",
  },
  {
    id: "12", source: "Axios", category: "tech", sentiment: "bullish", sentimentScore: 0.66,
    headline: "Microsoft Azure Revenues Jump 31% as Copilot AI Features Gain Enterprise Traction",
    summary: "Microsoft's cloud segment delivered another blowout quarter, with Azure growth accelerating to 31% driven by AI workloads. CEO Satya Nadella noted that over 65,000 enterprise customers now use Copilot features.",
    tickers: ["MSFT", "GOOGL"], publishedAt: hoursAgo(21.0), impact: "medium",
  },
];

const ECON_EVENTS: EconEvent[] = [
  {
    id: "ev1", name: "FOMC Rate Decision", date: daysFromNow(3), time: "2:00 PM ET",
    importance: "high", previous: "5.25–5.50%", forecast: "5.25–5.50%", actual: undefined,
    country: "US", flag: "🇺🇸",
    description: "Federal Open Market Committee interest rate announcement. Markets expect no change with a 94% probability.",
  },
  {
    id: "ev2", name: "Powell Press Conference", date: daysFromNow(3), time: "2:30 PM ET",
    importance: "high", country: "US", flag: "🇺🇸",
    description: "Fed Chair Jerome Powell holds press conference following FOMC decision. Tone and forward guidance are the key watch.",
  },
  {
    id: "ev3", name: "US CPI (Core & Headline)", date: daysFromNow(7), time: "8:30 AM ET",
    importance: "high", previous: "3.5%", forecast: "3.4%",
    country: "US", flag: "🇺🇸",
    description: "Consumer Price Index — the Fed's most-watched inflation gauge. A surprise above 3.5% could push rate-cut expectations further out.",
  },
  {
    id: "ev4", name: "Non-Farm Payrolls", date: daysFromNow(10), time: "8:30 AM ET",
    importance: "high", previous: "303K", forecast: "240K",
    country: "US", flag: "🇺🇸",
    description: "Monthly jobs report. Strong payrolls reduce pressure on the Fed to cut; weak numbers increase recession fears.",
  },
  {
    id: "ev5", name: "ECB Rate Decision", date: daysFromNow(5), time: "8:15 AM ET",
    importance: "high", previous: "4.50%", forecast: "4.25%",
    country: "EU", flag: "🇪🇺",
    description: "European Central Bank expected to deliver its first rate cut since 2019. EUR/USD pairs on high alert.",
  },
  {
    id: "ev6", name: "US PCE Price Index", date: daysFromNow(14), time: "8:30 AM ET",
    importance: "high", previous: "2.8%", forecast: "2.7%",
    country: "US", flag: "🇺🇸",
    description: "Personal Consumption Expenditures — the Fed's preferred inflation measure. Closely watched by fixed income markets.",
  },
  {
    id: "ev7", name: "NVIDIA Earnings (Q1)", date: daysFromNow(4), time: "After Close",
    importance: "high", country: "US", flag: "🇺🇸",
    description: "Most anticipated earnings call of Q1. Data center revenue and forward guidance will set the tone for the AI trade.",
  },
  {
    id: "ev8", name: "Apple Earnings (Q2)", date: daysFromNow(8), time: "After Close",
    importance: "medium", country: "US", flag: "🇺🇸",
    description: "Services revenue and Vision Pro adoption metrics will be the key focus. iPhone China demand also in spotlight.",
  },
  {
    id: "ev9", name: "UK CPI", date: daysFromNow(6), time: "7:00 AM ET",
    importance: "medium", previous: "3.2%", forecast: "3.1%",
    country: "UK", flag: "🇬🇧",
    description: "UK inflation data that will influence the Bank of England's rate path. Pound volatility expected around release.",
  },
  {
    id: "ev10", name: "US Retail Sales", date: daysFromNow(9), time: "8:30 AM ET",
    importance: "medium", previous: "0.6%", forecast: "0.3%",
    country: "US", flag: "🇺🇸",
    description: "Measures consumer spending — the largest driver of US GDP. A miss here would add to soft landing concerns.",
  },
  {
    id: "ev11", name: "Michigan Consumer Sentiment", date: daysFromNow(11), time: "10:00 AM ET",
    importance: "medium", previous: "77.2", forecast: "76.5",
    country: "US", flag: "🇺🇸",
    description: "Leading indicator of consumer confidence and spending intentions.",
  },
  {
    id: "ev12", name: "Japan BOJ Policy Meeting", date: daysFromNow(13), time: "Overnight",
    importance: "medium", country: "JP", flag: "🇯🇵",
    description: "Bank of Japan rate decision. Markets watching for any further normalization signals following the historic rate hike.",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "wire",     label: "Wire Feed",      icon: Radio     },
  { id: "calendar", label: "Event Calendar", icon: Calendar  },
  { id: "sentiment",label: "Sentiment",      icon: BarChart2 },
];

const CATEGORIES: { id: Category | "all"; label: string; color: string }[] = [
  { id: "all",         label: "All",          color: "#ffffff" },
  { id: "macro",       label: "Macro",        color: "#3D8EFF" },
  { id: "fed",         label: "Fed",          color: "#8B5CF6" },
  { id: "earnings",    label: "Earnings",     color: "#00cc73" },
  { id: "crypto",      label: "Crypto",       color: "#F59E0B" },
  { id: "commodities", label: "Commodities",  color: "#FF6B35" },
  { id: "tech",        label: "Tech",         color: "#06B6D4" },
  { id: "geopolitical",label: "Geopolitical", color: "#EF4444" },
];

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function SentimentBadge({ s }: { s: Sentiment }) {
  const cfg = {
    bullish:  { label: "Bullish",  icon: TrendingUp,   cls: "bg-bullish/10 text-bullish border-bullish/20"  },
    bearish:  { label: "Bearish",  icon: TrendingDown,  cls: "bg-bearish/10 text-bearish border-bearish/20"  },
    neutral:  { label: "Neutral",  icon: Minus,         cls: "bg-accent/60 text-muted-foreground border-border" },
  }[s];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${cfg.cls}`}>
      <Icon size={8} /> {cfg.label}
    </span>
  );
}

function ImpactDot({ impact }: { impact: "high" | "medium" | "low" }) {
  const colors = { high: "bg-bearish", medium: "bg-watch", low: "bg-muted-foreground" };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors[impact]}`} />;
}

function SentimentBar({ score }: { score: number }) {
  const pct = ((score + 1) / 2) * 100;
  const color = score > 0.2 ? "#00cc73" : score < -0.2 ? "#ef4444" : "#94a3b8";
  return (
    <div className="relative h-1 w-full overflow-hidden rounded-full bg-border/40">
      <div
        className="absolute h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}60` }}
      />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/60" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function News() {
  const [tab, setTab] = useState<"wire" | "calendar" | "sentiment">("wire");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [impactFilter, setImpactFilter] = useState<"all" | "high" | "medium" | "low">("all");

  const filtered = useMemo(() => {
    let items = ARTICLES;
    if (categoryFilter !== "all") items = items.filter(a => a.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(a =>
        a.headline.toLowerCase().includes(q) ||
        a.tickers.some(t => t.toLowerCase().includes(q)) ||
        a.source.toLowerCase().includes(q)
      );
    }
    return items;
  }, [categoryFilter, searchQuery]);

  const filteredEvents = useMemo(() => {
    if (impactFilter === "all") return ECON_EVENTS;
    return ECON_EVENTS.filter(e => e.importance === impactFilter);
  }, [impactFilter]);

  // Sentiment analytics
  const sentimentCounts = useMemo(() => {
    const all = ARTICLES;
    return {
      bullish: all.filter(a => a.sentiment === "bullish").length,
      bearish: all.filter(a => a.sentiment === "bearish").length,
      neutral: all.filter(a => a.sentiment === "neutral").length,
      avgScore: all.reduce((s, a) => s + a.sentimentScore, 0) / all.length,
    };
  }, []);

  const byCategory = useMemo(() =>
    CATEGORIES.filter(c => c.id !== "all").map(cat => {
      const arts = ARTICLES.filter(a => a.category === cat.id);
      const avg = arts.length ? arts.reduce((s, a) => s + a.sentimentScore, 0) / arts.length : 0;
      return { ...cat, count: arts.length, avgScore: avg };
    }),
  []);

  const tickerMentions = useMemo(() => {
    const map: Record<string, { count: number; score: number }> = {};
    ARTICLES.forEach(a => {
      a.tickers.forEach(t => {
        if (!map[t]) map[t] = { count: 0, score: 0 };
        map[t].count++;
        map[t].score += a.sentimentScore;
      });
    });
    return Object.entries(map)
      .map(([ticker, v]) => ({ ticker, count: v.count, avgScore: v.score / v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, []);

  const overallSentiment: Sentiment =
    sentimentCounts.avgScore > 0.1 ? "bullish" :
    sentimentCounts.avgScore < -0.1 ? "bearish" : "neutral";

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Newspaper size={12} className="text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Market Intelligence</span>
            </div>
            <h2 className="font-display text-3xl font-black tracking-tight">News & Intelligence</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              AI-scored wire feed · Economic calendar · Sentiment analytics
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-bullish/20 bg-bullish/5 px-4 py-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bullish opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-bullish" />
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-bullish">Live</span>
          </div>
        </div>

        {/* Quick stat bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Stories Today", value: String(ARTICLES.length), color: "text-foreground" },
            { label: "Bullish",  value: String(sentimentCounts.bullish),  color: "text-bullish" },
            { label: "Bearish",  value: String(sentimentCounts.bearish),  color: "text-bearish" },
            {
              label: "Market Mood",
              value: overallSentiment.charAt(0).toUpperCase() + overallSentiment.slice(1),
              color: overallSentiment === "bullish" ? "text-bullish" : overallSentiment === "bearish" ? "text-bearish" : "text-muted-foreground",
            },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <p className={`font-mono text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-border">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
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

        {/* ══ WIRE FEED ══ */}
        {tab === "wire" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Filters row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
                <Search size={13} className="shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search headlines, tickers, sources…"
                  className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id as Category | "all")}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                    categoryFilter === cat.id
                      ? "border-current"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                  style={categoryFilter === cat.id ? { borderColor: cat.color, color: cat.color, background: `${cat.color}12` } : undefined}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Article list */}
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16">
                  <Globe size={28} className="text-muted-foreground/20" />
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/50">No stories match your filter</p>
                </div>
              ) : filtered.map((article, i) => {
                const isExpanded = expandedId === article.id;
                const cat = CATEGORIES.find(c => c.id === article.category);
                return (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-border/70"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : article.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-4 p-4">
                        {/* Impact indicator */}
                        <div className="mt-1.5 flex shrink-0 flex-col items-center gap-1">
                          <ImpactDot impact={article.impact} />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Meta row */}
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{article.source}</span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground/60">
                              <Clock size={8} />{timeAgo(article.publishedAt)}
                            </span>
                            <span className="text-muted-foreground/30">·</span>
                            <span
                              className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold capitalize"
                              style={{ color: cat?.color, background: `${cat?.color}15` }}
                            >
                              {article.category}
                            </span>
                            <SentimentBadge s={article.sentiment} />
                          </div>

                          {/* Headline */}
                          <p className="font-display text-sm font-bold leading-snug text-foreground">{article.headline}</p>

                          {/* Tickers */}
                          {article.tickers.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {article.tickers.map(t => (
                                <span key={t} className="rounded-md border border-border bg-accent px-1.5 py-0.5 font-mono text-[9px] font-bold text-muted-foreground">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Score + chevron */}
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className={`font-mono text-sm font-black ${article.sentimentScore > 0 ? "text-bullish" : article.sentimentScore < 0 ? "text-bearish" : "text-muted-foreground"}`}>
                            {article.sentimentScore > 0 ? "+" : ""}{article.sentimentScore.toFixed(2)}
                          </span>
                          <ChevronDown
                            size={14}
                            className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border/50 px-4 pb-4 pt-3">
                            <p className="text-sm leading-relaxed text-muted-foreground">{article.summary}</p>
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div>
                                  <p className="font-mono text-[9px] uppercase text-muted-foreground">AI Sentiment Score</p>
                                  <div className="mt-1 w-48">
                                    <SentimentBar score={article.sentimentScore} />
                                  </div>
                                  <div className="mt-0.5 flex justify-between font-mono text-[8px] text-muted-foreground/50">
                                    <span>Bearish</span><span>Neutral</span><span>Bullish</span>
                                  </div>
                                </div>
                              </div>
                              {article.url && (
                                <a href={article.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 rounded-lg border border-border bg-accent px-3 py-1.5 font-mono text-[10px] font-bold text-muted-foreground transition-colors hover:text-foreground">
                                  Read Full Story <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            <p className="text-right font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
              AI sentiment scores computed from headline + summary NLP · Powered by WealthOS Intelligence
            </p>
          </motion.div>
        )}

        {/* ══ EVENT CALENDAR ══ */}
        {tab === "calendar" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Importance filter */}
            <div className="flex items-center gap-2">
              <Filter size={13} className="text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Impact:</span>
              {(["all", "high", "medium", "low"] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setImpactFilter(level)}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold capitalize transition-all ${
                    impactFilter === level
                      ? level === "high" ? "border-bearish/40 bg-bearish/10 text-bearish"
                        : level === "medium" ? "border-watch/40 bg-watch/10 text-watch"
                        : "border-border bg-accent text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {level === "all" ? "All" : level}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredEvents.map((event, i) => {
                const isPast = event.date < now;
                const isToday = event.date.toDateString() === now.toDateString();
                const isSoon = !isPast && (event.date.getTime() - now.getTime()) < 3 * 86_400_000;
                const importanceColor = event.importance === "high" ? "text-bearish border-bearish/20 bg-bearish/5"
                  : event.importance === "medium" ? "text-watch border-watch/20 bg-watch/5"
                  : "text-muted-foreground border-border bg-card";

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`rounded-2xl border p-5 transition-all ${
                      isPast ? "opacity-50" : isSoon ? "border-watch/30 bg-watch/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xl">{event.flag}</span>
                          {isSoon && !isPast && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-watch opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-watch" />
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-sm font-bold text-foreground">{event.name}</span>
                            <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${importanceColor}`}>
                              {event.importance} impact
                            </span>
                            {isToday && <span className="rounded-full bg-bullish/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-bullish">Today</span>}
                            {isPast && <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-muted-foreground">Past</span>}
                          </div>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {event.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {event.time}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{event.description}</p>
                        </div>
                      </div>

                      {(event.previous || event.forecast || event.actual) && (
                        <div className="flex shrink-0 gap-4">
                          {event.previous && (
                            <div className="text-right">
                              <p className="font-mono text-[9px] uppercase text-muted-foreground">Prev</p>
                              <p className="font-mono text-sm font-bold text-muted-foreground">{event.previous}</p>
                            </div>
                          )}
                          {event.forecast && (
                            <div className="text-right">
                              <p className="font-mono text-[9px] uppercase text-muted-foreground">Forecast</p>
                              <p className="font-mono text-sm font-bold text-foreground">{event.forecast}</p>
                            </div>
                          )}
                          {event.actual && (
                            <div className="text-right">
                              <p className="font-mono text-[9px] uppercase text-muted-foreground">Actual</p>
                              <p className="font-mono text-sm font-bold text-bullish">{event.actual}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                Calendar data is illustrative and anchored to today's date. Connect to a live data provider (Tradingeconomics, Investing.com API) to receive real scheduled events with consensus estimates.
              </p>
            </div>
          </motion.div>
        )}

        {/* ══ SENTIMENT ══ */}
        {tab === "sentiment" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Overall gauge */}
            <div className={`rounded-2xl border p-6 text-center ${
              overallSentiment === "bullish" ? "border-bullish/30 bg-bullish/5"
              : overallSentiment === "bearish" ? "border-bearish/30 bg-bearish/5"
              : "border-border bg-card"
            }`}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Aggregate Market Sentiment</p>
              <p className={`font-display text-5xl font-black mt-2 ${
                overallSentiment === "bullish" ? "text-bullish"
                : overallSentiment === "bearish" ? "text-bearish"
                : "text-muted-foreground"
              }`}>
                {overallSentiment.toUpperCase()}
              </p>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                Score: {sentimentCounts.avgScore > 0 ? "+" : ""}{sentimentCounts.avgScore.toFixed(3)} · Based on {ARTICLES.length} articles
              </p>
              <div className="mx-auto mt-4 max-w-xs">
                <SentimentBar score={sentimentCounts.avgScore} />
                <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground/50">
                  <span>-1.0 Max Bearish</span>
                  <span>+1.0 Max Bullish</span>
                </div>
              </div>
            </div>

            {/* Sentiment split */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Bullish",  count: sentimentCounts.bullish,  pct: (sentimentCounts.bullish / ARTICLES.length * 100).toFixed(0),  color: "#00cc73", icon: TrendingUp  },
                { label: "Neutral",  count: sentimentCounts.neutral,  pct: (sentimentCounts.neutral / ARTICLES.length * 100).toFixed(0),  color: "#94a3b8", icon: Minus       },
                { label: "Bearish",  count: sentimentCounts.bearish,  pct: (sentimentCounts.bearish / ARTICLES.length * 100).toFixed(0),  color: "#ef4444", icon: TrendingDown },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-2xl border border-border bg-card p-5 text-center">
                    <Icon size={24} className="mx-auto mb-2" style={{ color: s.color }} />
                    <p className="font-mono text-3xl font-black" style={{ color: s.color }}>{s.pct}%</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground/60">{s.count} stories</p>
                  </div>
                );
              })}
            </div>

            {/* By category */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Tag size={14} />
                Sentiment by Category
              </h3>
              <div className="space-y-4">
                {byCategory.filter(c => c.count > 0).map(cat => (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold" style={{ color: cat.color }}>{cat.label}</span>
                        <span className="font-mono text-[9px] text-muted-foreground/60">{cat.count} articles</span>
                      </div>
                      <span className={`font-mono text-xs font-black ${cat.avgScore > 0.1 ? "text-bullish" : cat.avgScore < -0.1 ? "text-bearish" : "text-muted-foreground"}`}>
                        {cat.avgScore > 0 ? "+" : ""}{cat.avgScore.toFixed(2)}
                      </span>
                    </div>
                    <SentimentBar score={cat.avgScore} />
                  </div>
                ))}
              </div>
            </div>

            {/* Ticker heat */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Zap size={14} />
                Most Mentioned Tickers
              </h3>
              <div className="flex flex-wrap gap-2">
                {tickerMentions.map(t => {
                  const color = t.avgScore > 0.15 ? "#00cc73" : t.avgScore < -0.15 ? "#ef4444" : "#94a3b8";
                  const Icon = t.avgScore > 0.15 ? TrendingUp : t.avgScore < -0.15 ? TrendingDown : Minus;
                  return (
                    <div
                      key={t.ticker}
                      className="flex items-center gap-2 rounded-xl border px-3 py-2"
                      style={{ borderColor: `${color}30`, background: `${color}08` }}
                    >
                      <Icon size={10} style={{ color }} />
                      <span className="font-mono text-sm font-black" style={{ color }}>{t.ticker}</span>
                      <span className="font-mono text-[9px] text-muted-foreground/60">{t.count}×</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
