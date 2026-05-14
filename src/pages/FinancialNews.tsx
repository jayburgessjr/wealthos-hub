import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper,
  RefreshCw,
  ExternalLink,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  BarChart2,
  Zap,
  Bell,
  Activity,
  Radio,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  source_provider: string;
  url: string;
  published_at: string;
  tickers: string[];
  sentiment: "bullish" | "bearish" | "neutral";
  sentiment_score: number;
  category: string;
  image_url?: string;
  impact?: "high" | "medium" | "low";
}

interface NewsResponse {
  articles: NewsItem[];
  sources: string[];
  sentiment_summary: {
    overall: "bullish" | "bearish" | "neutral";
    bullish_count: number;
    bearish_count: number;
    neutral_count: number;
    avg_score: number;
  };
  fetched_at: string;
  api_keys_missing: string[];
}

// ── Helper functions ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getSentimentColor(sentiment: string): string {
  if (sentiment === "bullish") return "border-l-[#00E5A0] text-[#00E5A0]";
  if (sentiment === "bearish") return "border-l-red-500 text-red-500";
  return "border-l-slate-500 text-slate-400";
}

function getSentimentBg(sentiment: string): string {
  if (sentiment === "bullish") return "bg-[#00E5A0]/10 text-[#00E5A0]";
  if (sentiment === "bearish") return "bg-red-500/10 text-red-400";
  return "bg-slate-700/40 text-slate-400";
}

function getSourceColor(provider: string): string {
  const p = provider.toLowerCase();
  if (p.includes("polygon")) return "bg-emerald-600/20 text-emerald-400 border-emerald-600/30";
  if (p.includes("finnhub")) return "bg-blue-600/20 text-blue-400 border-blue-600/30";
  if (p.includes("bloomberg")) return "bg-slate-700 text-slate-200 border-slate-600";
  if (p.includes("reuters")) return "bg-orange-600/20 text-orange-400 border-orange-600/30";
  if (p.includes("wsj") || p.includes("wall street")) return "bg-indigo-600/20 text-indigo-400 border-indigo-600/30";
  if (p.includes("ft") || p.includes("financial times")) return "bg-pink-700/20 text-pink-400 border-pink-700/30";
  if (p.includes("cnbc")) return "bg-yellow-600/20 text-yellow-400 border-yellow-600/30";
  if (p.includes("marketwatch")) return "bg-teal-600/20 text-teal-400 border-teal-600/30";
  if (p.includes("barron")) return "bg-violet-600/20 text-violet-400 border-violet-600/30";
  if (p.includes("economist")) return "bg-red-700/20 text-red-400 border-red-700/30";
  if (p.includes("newsapi") || p.includes("alphavantage") || p.includes("marketaux")) return "bg-cyan-700/20 text-cyan-400 border-cyan-700/30";
  return "bg-slate-700/30 text-slate-400 border-slate-600/30";
}

function getCategoryFromHeadline(headline: string): string {
  const h = headline.toLowerCase();
  if (/bitcoin|ethereum|crypto|defi|nft|blockchain|btc|eth|sol|bnb/.test(h)) return "CRYPTO";
  if (/earnings|revenue|profit|eps|quarterly|guidance|beat|miss/.test(h)) return "EARNINGS";
  if (/fed|fomc|powell|rate|inflation|cpi|pce|gdp|unemployment|jobs|payroll/.test(h)) return "ECONOMY";
  if (/merger|acquisition|buyout|deal|takeover|m&a/.test(h)) return "M&A";
  if (/ipo|offering|listing|spac|debut/.test(h)) return "M&A";
  if (/nvidia|apple|microsoft|google|meta|amazon|tesla|openai|ai|chips|semiconductor/.test(h)) return "TECH";
  if (/oil|opec|crude|gold|silver|wheat|commodity|energy/.test(h)) return "MARKETS";
  if (/china|russia|war|geopolit|tariff|sanction|nato|israel|ukraine/.test(h)) return "MACRO";
  if (/bank|jpmorgan|goldman|morgan stanley|citi|wells fargo|credit/.test(h)) return "MARKETS";
  return "MARKETS";
}

// ── Mock data (20 articles) ───────────────────────────────────────────────────

const now = new Date("2026-05-13T10:00:00Z");
const ha = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const MOCK_ARTICLES: NewsItem[] = [
  {
    id: "1", headline: "Fed Signals Potential Rate Cut in June as Inflation Cools to 2.3%",
    summary: "Federal Reserve officials indicated they are increasingly comfortable with the inflation trajectory after core PCE fell to 2.3%, putting a June rate cut back on the table. Multiple FOMC members cited easing labor market pressure as an additional tailwind.",
    source: "Bloomberg", source_provider: "Bloomberg", url: "#",
    published_at: ha(0.5), tickers: ["SPY", "QQQ", "TLT", "GLD"],
    sentiment: "bullish", sentiment_score: 0.72, category: "ECONOMY", impact: "high",
  },
  {
    id: "2", headline: "NVIDIA Posts Record $26B Quarter, Raises Full-Year Guidance on AI Demand Surge",
    summary: "NVIDIA blew past analyst estimates for the fourth consecutive quarter, driven by insatiable data center demand for Blackwell GPUs. The company raised its full-year revenue guidance by $8B, citing no slowdown in hyperscaler AI infrastructure spending.",
    source: "Reuters", source_provider: "Reuters", url: "#",
    published_at: ha(1.2), tickers: ["NVDA", "AMD", "INTC", "TSM"],
    sentiment: "bullish", sentiment_score: 0.91, category: "EARNINGS", impact: "high",
  },
  {
    id: "3", headline: "Bitcoin Retreats 8% as Mt. Gox Trustee Moves 12,000 BTC to Exchange Wallets",
    summary: "On-chain data confirmed the Mt. Gox estate moved roughly 12,000 BTC to Kraken and Bitbank in preparation for creditor distributions. The market reacted with a sharp sell-off, briefly pushing BTC below $94,000 before partial recovery.",
    source: "CoinDesk", source_provider: "Finnhub", url: "#",
    published_at: ha(2), tickers: ["BTC", "ETH", "COIN", "MSTR"],
    sentiment: "bearish", sentiment_score: -0.68, category: "CRYPTO", impact: "high",
  },
  {
    id: "4", headline: "WTI Crude Drops to $74 as OPEC+ Considers Output Hike for Second Straight Month",
    summary: "Oil prices fell to a six-month low after reports that Saudi Arabia and UAE are pushing within OPEC+ for a larger-than-expected production increase. The decision, expected at the June ministerial meeting, would add roughly 400K barrels per day.",
    source: "Financial Times", source_provider: "FT", url: "#",
    published_at: ha(2.5), tickers: ["XLE", "CVX", "XOM", "USO"],
    sentiment: "bearish", sentiment_score: -0.55, category: "MARKETS", impact: "high",
  },
  {
    id: "5", headline: "JPMorgan Q1 Earnings Exceed Estimates; Investment Banking Revenue Up 34%",
    summary: "JPMorgan Chase reported first-quarter net income of $14.6B, surpassing the $13.2B consensus. Investment banking fees surged 34% driven by a rebound in debt underwriting and M&A advisory activity. CEO Jamie Dimon warned of 'significant geopolitical uncertainty' despite the strong results.",
    source: "WSJ", source_provider: "WSJ", url: "#",
    published_at: ha(3), tickers: ["JPM", "BAC", "GS", "MS"],
    sentiment: "bullish", sentiment_score: 0.61, category: "EARNINGS", impact: "medium",
  },
  {
    id: "6", headline: "Microsoft and OpenAI Deepen Partnership with $15B Compute Commitment Through 2030",
    summary: "Microsoft announced an expanded agreement with OpenAI worth $15B in cloud compute through 2030, reinforcing Azure as the exclusive cloud provider for frontier model training. The deal includes co-development rights for enterprise AI products.",
    source: "Bloomberg", source_provider: "Bloomberg", url: "#",
    published_at: ha(4), tickers: ["MSFT", "GOOGL", "AMZN", "META"],
    sentiment: "bullish", sentiment_score: 0.77, category: "TECH", impact: "medium",
  },
  {
    id: "7", headline: "US-China Trade Truce Extended 90 Days; Tariffs Frozen at 30% on Consumer Goods",
    summary: "The Biden administration announced a 90-day extension of the US-China trade truce, keeping tariffs steady at 30% on most consumer goods while high-level talks continue. Markets responded positively, though exporters remain cautious about long-term visibility.",
    source: "Reuters", source_provider: "Reuters", url: "#",
    published_at: ha(5), tickers: ["SPY", "IEF", "FXI", "KWEB"],
    sentiment: "neutral", sentiment_score: 0.12, category: "MACRO", impact: "high",
  },
  {
    id: "8", headline: "Stripe Files Confidential IPO Documents; Valuation Expected Near $80B",
    summary: "Stripe has submitted a confidential S-1 to the SEC, setting the stage for what could be the largest fintech IPO of 2026. Sources familiar with the matter suggest a valuation target of $75–85B, representing a modest discount to its 2021 private peak of $95B.",
    source: "CNBC", source_provider: "CNBC", url: "#",
    published_at: ha(6), tickers: ["PYPL", "SQ", "V", "MA"],
    sentiment: "bullish", sentiment_score: 0.58, category: "M&A", impact: "medium",
  },
  {
    id: "9", headline: "April Non-Farm Payrolls Miss: +142K vs +180K Estimate, Unemployment Ticks to 4.3%",
    summary: "The US economy added just 142,000 jobs in April, below the 180,000 consensus estimate, while the unemployment rate edged up to 4.3%. Wage growth slowed to 3.8% YoY. Economists read the miss as reinforcing the case for Fed easing, sparking a rally in rate-sensitive assets.",
    source: "MarketWatch", source_provider: "MarketWatch", url: "#",
    published_at: ha(7), tickers: ["TLT", "IEF", "SPY", "XLF"],
    sentiment: "neutral", sentiment_score: 0.08, category: "ECONOMY", impact: "high",
  },
  {
    id: "10", headline: "Tesla Deliveries Fall 18% YoY in Q1; Musk Pledges New Affordable Model by Year-End",
    summary: "Tesla reported 336,000 vehicle deliveries in Q1 2026, an 18% decline from the year-ago period, as competition from BYD and legacy automakers intensified. CEO Elon Musk attempted to reassure investors by pledging a sub-$30K model for delivery in Q4.",
    source: "Bloomberg", source_provider: "Bloomberg", url: "#",
    published_at: ha(8), tickers: ["TSLA", "GM", "F", "RIVN"],
    sentiment: "bearish", sentiment_score: -0.63, category: "EARNINGS", impact: "high",
  },
  {
    id: "11", headline: "Ethereum ETF Net Inflows Hit $620M in a Single Day, New All-Time Record",
    summary: "Spot Ethereum ETFs saw record net inflows of $620M on Tuesday, eclipsing the previous single-day record set in November 2024. BlackRock's ETHA alone accounted for $310M of inflows as institutional allocation to digital assets continued to accelerate.",
    source: "The Block", source_provider: "Finnhub", url: "#",
    published_at: ha(9), tickers: ["ETH", "ETHA", "BTC", "COIN"],
    sentiment: "bullish", sentiment_score: 0.83, category: "CRYPTO", impact: "medium",
  },
  {
    id: "12", headline: "Housing Starts Collapse 14% in March; 30-Year Mortgage Back Above 7%",
    summary: "US housing starts fell 14% in March to a seasonally adjusted annual rate of 1.19M, the weakest reading in two years. The culprit: mortgage rates have climbed back above 7% on stronger-than-expected economic data, pricing out first-time buyers.",
    source: "WSJ", source_provider: "WSJ", url: "#",
    published_at: ha(10), tickers: ["XHB", "DHI", "LEN", "ITB"],
    sentiment: "bearish", sentiment_score: -0.49, category: "ECONOMY", impact: "medium",
  },
  {
    id: "13", headline: "ExxonMobil to Acquire Pioneer's Gulf Assets for $8B in All-Cash Deal",
    summary: "ExxonMobil announced an $8B all-cash acquisition of Pioneer Natural Resources' remaining Gulf of Mexico deepwater assets, adding 180,000 barrels per day of production capacity. The deal, expected to close in Q3, is subject to FTC review.",
    source: "Barron's", source_provider: "Barron's", url: "#",
    published_at: ha(12), tickers: ["XOM", "PXD", "CVX", "COP"],
    sentiment: "bullish", sentiment_score: 0.44, category: "M&A", impact: "medium",
  },
  {
    id: "14", headline: "Bank of Japan Raises Rates to 0.75%, Yen Surges 2.1% Against Dollar",
    summary: "The Bank of Japan hiked its benchmark rate by 25bps to 0.75%, citing persistent wage-driven inflation and a weaker yen as justification. The yen rallied sharply, pressuring Japanese exporters and sparking volatility in carry trade positions globally.",
    source: "Financial Times", source_provider: "FT", url: "#",
    published_at: ha(14), tickers: ["FXY", "EWJ", "DXY", "TLT"],
    sentiment: "neutral", sentiment_score: -0.15, category: "MACRO", impact: "high",
  },
  {
    id: "15", headline: "Meta Launches Llama 4 Scout with 17B Parameters; Claims GPT-4o Parity at 1/10th Cost",
    summary: "Meta AI released Llama 4 Scout, a 17B parameter multimodal model that the company claims matches GPT-4o on standard benchmarks while running at roughly one-tenth the inference cost. The model is immediately available under Meta's commercial license.",
    source: "The Economist", source_provider: "The Economist", url: "#",
    published_at: ha(16), tickers: ["META", "GOOGL", "MSFT", "AMZN"],
    sentiment: "bullish", sentiment_score: 0.65, category: "TECH", impact: "medium",
  },
  {
    id: "16", headline: "S&P 500 Valuation Hits 22x Forward P/E — Highest Since Dot-Com Peak",
    summary: "The S&P 500 is now trading at 22x forward earnings, a multiple not seen since January 2000. Strategists at Goldman Sachs note that while earnings growth remains solid, the risk premium compression leaves little room for macro disappointment.",
    source: "Bloomberg", source_provider: "Bloomberg", url: "#",
    published_at: ha(18), tickers: ["SPY", "QQQ", "VTI", "IVV"],
    sentiment: "bearish", sentiment_score: -0.38, category: "MARKETS", impact: "medium",
  },
  {
    id: "17", headline: "Apple Announces $110B Share Buyback — Largest in Corporate History",
    summary: "Apple authorized a $110B share repurchase program at its annual shareholder meeting, surpassing last year's record $90B buyback. The company also raised its quarterly dividend by 4% to $0.26 per share, signaling management confidence in free cash flow durability.",
    source: "CNBC", source_provider: "CNBC", url: "#",
    published_at: ha(22), tickers: ["AAPL", "QQQ", "SPY"],
    sentiment: "bullish", sentiment_score: 0.71, category: "MARKETS", impact: "medium",
  },
  {
    id: "18", headline: "Russia Cuts Urals Crude Export to India After New EU Sanctions Package",
    summary: "India's oil ministry confirmed that Russian Urals crude shipments fell 22% in April following the EU's 15th sanctions package, which targeted shadow fleet tankers. Indian refiners are scrambling to source replacement barrels from Middle Eastern producers.",
    source: "Reuters", source_provider: "Reuters", url: "#",
    published_at: ha(28), tickers: ["XLE", "USO", "OIH", "MRO"],
    sentiment: "neutral", sentiment_score: 0.05, category: "MACRO", impact: "medium",
  },
  {
    id: "19", headline: "Coinbase Q1 Revenue Surges 80% as Crypto Trading Volume Doubles",
    summary: "Coinbase reported Q1 revenue of $2.4B, up 80% year-over-year, as retail and institutional trading volumes doubled from Q4 2025. The exchange also highlighted growth in its Base L2 network and USDC stablecoin revenue as diversified earnings drivers.",
    source: "MarketWatch", source_provider: "MarketWatch", url: "#",
    published_at: ha(36), tickers: ["COIN", "MSTR", "BTC", "ETH"],
    sentiment: "bullish", sentiment_score: 0.76, category: "CRYPTO", impact: "medium",
  },
  {
    id: "20", headline: "US Regional Banks Face Renewed CRE Stress; FDIC Issues Targeted Guidance",
    summary: "The FDIC issued supplemental guidance to regional banks with commercial real estate (CRE) concentrations above 300% of capital, flagging elevated risk from office sector repricing. Three mid-sized lenders were placed on the agency's informal watch list.",
    source: "Barron's", source_provider: "Barron's", url: "#",
    published_at: ha(48), tickers: ["KRE", "SBNY", "WAL", "SIVB"],
    sentiment: "bearish", sentiment_score: -0.57, category: "MARKETS", impact: "medium",
  },
];

const MOCK_RESPONSE: NewsResponse = {
  articles: MOCK_ARTICLES,
  sources: ["Bloomberg", "Reuters", "WSJ", "FT", "CNBC", "MarketWatch", "Barron's", "The Economist", "Finnhub", "Polygon"],
  sentiment_summary: {
    overall: "bullish",
    bullish_count: 11,
    bearish_count: 6,
    neutral_count: 3,
    avg_score: 0.24,
  },
  fetched_at: now.toISOString(),
  api_keys_missing: ["POLYGON_KEY", "FINNHUB_KEY", "NEWSAPI_KEY", "ALPHAVANTAGE_KEY", "MARKETAUX_KEY"],
};

const CATEGORIES = ["ALL", "MARKETS", "EARNINGS", "ECONOMY", "CRYPTO", "M&A", "TECH", "MACRO"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

// ── Skeleton card ─────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-card border border-border rounded-lg p-4 space-y-3">
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-10" />
    </div>
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <div className="flex gap-2">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-3 w-8" />
    </div>
  </div>
);

// ── Article card ──────────────────────────────────────────────────────────────

interface ArticleCardProps {
  article: NewsItem;
  onTickerClick: (ticker: string) => void;
  index: number;
}

const ArticleCard = ({ article, onTickerClick, index }: ArticleCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const borderColor = article.sentiment === "bullish"
    ? "border-l-[#00E5A0]"
    : article.sentiment === "bearish"
    ? "border-l-red-500"
    : "border-l-slate-600";

  const score = article.sentiment_score;
  const scoreColor = score > 0.2 ? "text-[#00E5A0]" : score < -0.2 ? "text-red-400" : "text-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className={`bg-card border border-border border-l-4 ${borderColor} rounded-lg p-4 cursor-pointer hover:bg-slate-800/60 transition-colors`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getSourceColor(article.source_provider)}`}>
              {article.source}
            </span>
            {article.impact === "high" && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-600/30 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" /> HIGH IMPACT
              </span>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">
            {article.headline}
          </p>
        </div>
        <div className="shrink-0 ml-1 mt-1">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.p
            key="summary"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-muted-foreground mt-2 line-clamp-3 overflow-hidden"
          >
            {article.summary}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[11px] text-muted-foreground font-mono">{timeAgo(article.published_at)}</span>
        {article.tickers.slice(0, 4).map((t) => (
          <button
            key={t}
            onClick={(e) => { e.stopPropagation(); onTickerClick(t); }}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 hover:bg-slate-600 transition-colors border border-slate-600/40"
          >
            ${t}
          </button>
        ))}
        <span className={`text-[11px] font-mono ml-auto ${scoreColor}`}>
          {score > 0 ? "+" : ""}{score.toFixed(2)}
        </span>
        {article.url && article.url !== "#" && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
};

// ── Breaking news card ────────────────────────────────────────────────────────

const BreakingCard = ({ article }: { article: NewsItem }) => {
  const borderColor = article.sentiment === "bullish" ? "border-l-[#00E5A0]" : "border-l-red-500";
  return (
    <div className={`shrink-0 w-72 bg-card border border-border border-l-4 ${borderColor} rounded-lg p-3 snap-start`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getSourceColor(article.source_provider)}`}>
          {article.source}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">{timeAgo(article.published_at)}</span>
      </div>
      <p className="text-xs font-semibold leading-snug line-clamp-3">{article.headline}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        {article.tickers.slice(0, 3).map((t) => (
          <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-slate-600/40">
            ${t}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinancialNews() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

  const { data: rawData, isLoading, isError, refetch, dataUpdatedAt } = useQuery<NewsResponse>({
    queryKey: ["financial-news", selectedTickers],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-financial-news", {
        body: { tickers: selectedTickers, limit: 60 },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  // Fall back to mock when no live articles
  const responseData: NewsResponse = useMemo(() => {
    if (!rawData || !rawData.articles || rawData.articles.length === 0) return MOCK_RESPONSE;
    return rawData;
  }, [rawData]);

  const { articles, sources, sentiment_summary, api_keys_missing } = responseData;

  // Filtered articles
  const filteredArticles = useMemo(() => {
    let result = articles;
    if (selectedCategory !== "ALL") {
      result = result.filter((a) => {
        const cat = a.category?.toUpperCase() || getCategoryFromHeadline(a.headline);
        return cat === selectedCategory;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.headline.toLowerCase().includes(q) ||
          a.tickers.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (selectedTickers.length > 0) {
      result = result.filter((a) => a.tickers.some((t) => selectedTickers.includes(t)));
    }
    return result;
  }, [articles, selectedCategory, search, selectedTickers]);

  // Breaking / high-impact articles
  const breakingArticles = useMemo(
    () =>
      articles.filter(
        (a) => a.impact === "high" || a.sentiment_score > 0.5 || a.sentiment_score < -0.5
      ),
    [articles]
  );

  // Ticker mention counts
  const tickerMentions = useMemo(() => {
    const counts: Record<string, { count: number; scoreSum: number }> = {};
    for (const a of articles) {
      for (const t of a.tickers) {
        if (!counts[t]) counts[t] = { count: 0, scoreSum: 0 };
        counts[t].count++;
        counts[t].scoreSum += a.sentiment_score;
      }
    }
    return Object.entries(counts)
      .map(([ticker, { count, scoreSum }]) => ({ ticker, count, avgScore: scoreSum / count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [articles]);

  // Source counts
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of articles) {
      counts[a.source] = (counts[a.source] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [articles]);

  // Top movers by sentiment
  const topMovers = useMemo(() => {
    const counts: Record<string, { bullish: number; bearish: number; total: number }> = {};
    for (const a of articles) {
      for (const t of a.tickers) {
        if (!counts[t]) counts[t] = { bullish: 0, bearish: 0, total: 0 };
        counts[t].total++;
        if (a.sentiment === "bullish") counts[t].bullish++;
        else if (a.sentiment === "bearish") counts[t].bearish++;
      }
    }
    return Object.entries(counts)
      .filter(([, v]) => v.total >= 2)
      .map(([ticker, v]) => ({
        ticker,
        ...v,
        skew: (v.bullish - v.bearish) / v.total,
      }))
      .sort((a, b) => Math.abs(b.skew) - Math.abs(a.skew))
      .slice(0, 5);
  }, [articles]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  const overallColor =
    sentiment_summary.overall === "bullish"
      ? "text-[#00E5A0]"
      : sentiment_summary.overall === "bearish"
      ? "text-red-400"
      : "text-blue-400";

  const handleTickerClick = (ticker: string) => {
    setSelectedTickers((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
  };

  const totalArticles = articles.length || 1;
  const bullishPct = Math.round((sentiment_summary.bullish_count / totalArticles) * 100);
  const bearishPct = Math.round((sentiment_summary.bearish_count / totalArticles) * 100);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Newspaper className="w-6 h-6 text-[#00E5A0]" />
              <h1 className="text-2xl font-bold">Financial News</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Live intelligence from Bloomberg, Reuters, WSJ, Polygon, Finnhub, NewsAPI &amp; more
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Source pills */}
            <div className="flex flex-wrap gap-1">
              {sources.slice(0, 6).map((s) => (
                <span key={s} className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getSourceColor(s)}`}>
                  {s}
                </span>
              ))}
              {sources.length > 6 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-600/40 text-slate-400">
                  +{sources.length - 6}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Radio className="w-3.5 h-3.5 text-[#00E5A0] animate-pulse" />
              Updated {lastUpdated}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Missing API keys banner ── */}
        {isError || (api_keys_missing && api_keys_missing.length > 0) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Live data unavailable — showing curated mock data</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add these environment variables to your edge function to enable live news:&nbsp;
                {(api_keys_missing || ["POLYGON_KEY", "FINNHUB_KEY", "NEWSAPI_KEY", "ALPHAVANTAGE_KEY", "MARKETAUX_KEY"]).map((k, i, arr) => (
                  <span key={k}>
                    <code className="text-amber-300 font-mono">{k}</code>
                    {i < arr.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
          </motion.div>
        ) : null}

        {/* ── Sentiment overview ── */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Market Sentiment</p>
              <p className={`text-xl font-bold font-mono ${overallColor}`}>
                {sentiment_summary.overall.toUpperCase()}
              </p>
              <div className="flex items-center gap-1">
                {sentiment_summary.overall === "bullish" ? (
                  <TrendingUp className="w-4 h-4 text-[#00E5A0]" />
                ) : sentiment_summary.overall === "bearish" ? (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                ) : (
                  <Minus className="w-4 h-4 text-blue-400" />
                )}
                <span className="text-xs text-muted-foreground">{totalArticles} stories analyzed</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Bullish Stories</p>
              <p className="text-xl font-bold font-mono text-[#00E5A0]">{sentiment_summary.bullish_count}</p>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div
                  className="bg-[#00E5A0] h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${bullishPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">{bullishPct}% of coverage</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Bearish Stories</p>
              <p className="text-xl font-bold font-mono text-red-400">{sentiment_summary.bearish_count}</p>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div
                  className="bg-red-500 h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${bearishPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">{bearishPct}% of coverage</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Avg Sentiment Score</p>
              <p className={`text-xl font-bold font-mono ${sentiment_summary.avg_score > 0.1 ? "text-[#00E5A0]" : sentiment_summary.avg_score < -0.1 ? "text-red-400" : "text-blue-400"}`}>
                {sentiment_summary.avg_score > 0 ? "+" : ""}{sentiment_summary.avg_score.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Range: −1.00 to +1.00</p>
            </div>
          </div>
        </div>

        {/* ── Breaking news horizontal scroll ── */}
        {breakingArticles.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-red-400">Breaking / High Impact</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
              {breakingArticles.map((a) => (
                <BreakingCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        )}

        {/* ── Main two-column layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT — news feed */}
          <div className="xl:col-span-2 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search headlines or tickers…"
                className="pl-9 bg-card border-border text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Ticker filters */}
            {selectedTickers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Filtering by:</span>
                {selectedTickers.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTickerClick(t)}
                    className="text-xs font-mono px-2 py-0.5 rounded bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
                  >
                    ${t} ×
                  </button>
                ))}
                <button
                  onClick={() => setSelectedTickers([])}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Category tabs */}
            <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as CategoryFilter)}>
              <TabsList className="flex flex-wrap h-auto gap-1 bg-card border border-border p-1">
                {CATEGORIES.map((cat) => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="text-[11px] px-2.5 py-1 data-[state=active]:bg-[#00E5A0]/10 data-[state=active]:text-[#00E5A0]"
                  >
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Articles */}
            <div className="space-y-3">
              {isLoading ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Fetching from {sources.length || "multiple"} sources…
                  </div>
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </>
              ) : filteredArticles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Newspaper className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No articles match your filters.</p>
                  <button
                    onClick={() => { setSearch(""); setSelectedCategory("ALL"); setSelectedTickers([]); }}
                    className="text-xs underline mt-2 hover:text-foreground transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                filteredArticles.map((article, i) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onTickerClick={handleTickerClick}
                    index={i}
                  />
                ))
              )}
            </div>
          </div>

          {/* RIGHT — intelligence panel */}
          <div className="space-y-4">

            {/* A. Ticker in Focus */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-[#00E5A0]" />
                <h3 className="text-sm font-semibold">Ticker in Focus</h3>
              </div>
              <div className="space-y-2">
                {tickerMentions.map(({ ticker, count, avgScore }) => {
                  const pct = Math.round((count / tickerMentions[0].count) * 100);
                  const scoreColor = avgScore > 0.1 ? "text-[#00E5A0]" : avgScore < -0.1 ? "text-red-400" : "text-slate-400";
                  return (
                    <div key={ticker} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleTickerClick(ticker)}
                          className="text-xs font-mono text-slate-200 hover:text-[#00E5A0] transition-colors"
                        >
                          ${ticker}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono ${scoreColor}`}>
                            {avgScore > 0 ? "+" : ""}{avgScore.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">{count} mentions</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full transition-all duration-700 ${avgScore > 0.1 ? "bg-[#00E5A0]" : avgScore < -0.1 ? "bg-red-500" : "bg-slate-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* B. Source Activity */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold">Source Activity</h3>
              </div>
              <div className="space-y-2">
                {sourceCounts.map(({ source, count }) => {
                  const pct = Math.round((count / sourceCounts[0].count) * 100);
                  return (
                    <div key={source} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getSourceColor(source)}`}>
                          {source}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{count} stories</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1">
                        <div
                          className="bg-blue-500/60 h-1 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* C. Top Movers in News */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold">Top Movers in News</h3>
              </div>
              <div className="space-y-2">
                {topMovers.map(({ ticker, bullish, bearish, total, skew }) => {
                  const isBullish = skew > 0;
                  return (
                    <div key={ticker} className="flex items-center justify-between">
                      <button
                        onClick={() => handleTickerClick(ticker)}
                        className="text-xs font-mono text-slate-200 hover:text-[#00E5A0] transition-colors"
                      >
                        ${ticker}
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {isBullish ? (
                            <TrendingUp className="w-3 h-3 text-[#00E5A0]" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                          <span className={`text-[10px] font-mono ${isBullish ? "text-[#00E5A0]" : "text-red-400"}`}>
                            {bullish}B / {bearish}Be
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">{total} total</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* D. Quick links */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  to="/alerts"
                  className="flex items-center justify-between w-full text-xs px-3 py-2 rounded bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-muted-foreground hover:text-foreground border border-border"
                >
                  <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    Set Alert on Ticker
                  </div>
                  <span className="text-[#00E5A0]">→</span>
                </Link>
                <Link
                  to="/signals"
                  className="flex items-center justify-between w-full text-xs px-3 py-2 rounded bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-muted-foreground hover:text-foreground border border-border"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[#00E5A0]" />
                    Check Signal
                  </div>
                  <span className="text-[#00E5A0]">→</span>
                </Link>
                <Link
                  to="/decisions"
                  className="flex items-center justify-between w-full text-xs px-3 py-2 rounded bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-muted-foreground hover:text-foreground border border-border"
                >
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                    Decision Hub
                  </div>
                  <span className="text-[#00E5A0]">→</span>
                </Link>
                <Link
                  to="/screener"
                  className="flex items-center justify-between w-full text-xs px-3 py-2 rounded bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-muted-foreground hover:text-foreground border border-border"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-violet-400" />
                    Screener
                  </div>
                  <span className="text-[#00E5A0]">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
