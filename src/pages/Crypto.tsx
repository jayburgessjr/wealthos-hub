import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Globe, Zap, Activity, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  market_cap: number;
  total_volume: number;
  market_cap_rank: number;
  sparkline_in_7d: { price: number[] };
  circulating_supply: number;
  ath: number;
  ath_change_percentage: number;
}

interface GlobalData {
  total_market_cap: { usd: number };
  total_volume: { usd: number };
  market_cap_percentage: { btc: number; eth: number };
  market_cap_change_percentage_24h_usd: number;
}

const CATEGORIES = [
  { value: "all",     label: "All" },
  { value: "layer1",  label: "Layer 1",  ids: ["bitcoin","ethereum","solana","avalanche-2","cardano","polkadot","near","cosmos"] },
  { value: "defi",    label: "DeFi",     ids: ["uniswap","aave","chainlink","the-graph","synthetix","curve-dao-token"] },
  { value: "layer2",  label: "Layer 2",  ids: ["matic-network","arbitrum","optimism","starknet"] },
  { value: "ai",      label: "AI",       ids: ["render-token","fetch-ai","singularitynet","ocean-protocol"] },
];

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ prices, positive }: { prices: number[]; positive: boolean }) {
  if (!prices?.length) return <div className="h-8 w-20 bg-accent/30 rounded" />;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 80; const h = 32;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  const color = positive ? "#00E5A0" : "#FF4D6A";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}80)` }} />
    </svg>
  );
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2) {
  return n?.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) ?? "—";
}
function fmtBig(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n?.toLocaleString() ?? "—"}`;
}
function fmtPrice(n: number) {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1)    return `$${fmt(n)}`;
  return `$${n.toFixed(6)}`;
}

export default function Crypto() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "change24h" | "change7d" | "volume">("rank");

  // Global market data
  const { data: globalData } = useQuery<GlobalData>({
    queryKey: ["crypto-global"],
    queryFn: async () => {
      const res = await fetch("https://api.coingecko.com/api/v3/global");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60_000,
    retry: 2,
  });

  // Fear & Greed
  const { data: fearGreed } = useQuery<{ value: string; value_classification: string }>({
    queryKey: ["fear-greed"],
    queryFn: async () => {
      const res = await fetch("https://api.alternative.me/fng/?limit=1");
      const json = await res.json();
      return json.data?.[0];
    },
    staleTime: 300_000,
    retry: 2,
  });

  // Coin list
  const { data: coins = [], isLoading } = useQuery<CoinData[]>({
    queryKey: ["crypto-markets"],
    queryFn: async () => {
      const ids = CATEGORIES.find(c => c.value === category)?.ids;
      const idsParam = ids ? `&ids=${ids.join(",")}` : "";
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h%2C7d${idsParam}`
      );
      if (!res.ok) throw new Error("CoinGecko rate limit — try again shortly");
      return res.json();
    },
    staleTime: 60_000,
    retry: 2,
  });

  // Filter + sort
  const displayed = coins
    .filter(c => {
      if (search) return c.name.toLowerCase().includes(search.toLowerCase()) || c.symbol.toLowerCase().includes(search.toLowerCase());
      if (category !== "all") {
        const catIds = CATEGORIES.find(cat => cat.value === category)?.ids ?? [];
        return catIds.includes(c.id);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "change24h") return (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0);
      if (sortBy === "change7d") return (b.price_change_percentage_7d_in_currency ?? 0) - (a.price_change_percentage_7d_in_currency ?? 0);
      if (sortBy === "volume") return (b.total_volume ?? 0) - (a.total_volume ?? 0);
      return (a.market_cap_rank ?? 99) - (b.market_cap_rank ?? 99);
    });

  const fgValue = parseInt(fearGreed?.value ?? "50");
  const fgColor = fgValue >= 75 ? "text-bullish" : fgValue >= 50 ? "text-watch" : fgValue >= 25 ? "text-watch" : "text-bearish";
  const fgLabel = fearGreed?.value_classification ?? "—";

  const totalMcap = globalData?.total_market_cap?.usd ?? 0;
  const btcDom = globalData?.market_cap_percentage?.btc ?? 0;
  const ethDom = globalData?.market_cap_percentage?.eth ?? 0;
  const mcapChange = globalData?.market_cap_change_percentage_24h_usd ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Globe size={12} className="text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Digital Assets</span>
            </div>
            <h2 className="font-display text-3xl font-black tracking-tight">Crypto Markets</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live prices, market cap, and 7-day performance.</p>
          </div>

          {/* Global stat pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Total Mkt Cap",  value: fmtBig(totalMcap),           color: mcapChange >= 0 ? "text-bullish" : "text-bearish", icon: Activity },
              { label: "BTC Dominance",  value: `${btcDom.toFixed(1)}%`,     color: "text-watch",                                       icon: Zap },
              { label: "ETH Dominance",  value: `${ethDom.toFixed(1)}%`,     color: "text-primary",                                     icon: Zap },
              { label: "Fear & Greed",   value: `${fearGreed?.value ?? "—"} · ${fgLabel}`, color: fgColor,                              icon: Activity },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5">
                <stat.icon size={13} className={stat.color} />
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                  <p className={`font-mono text-sm font-black ${stat.color}`}>{value(stat.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  category === cat.value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search + sort */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-8 w-36 rounded-lg border border-border bg-card pl-8 pr-3 font-mono text-xs text-foreground outline-none focus:border-primary/50"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-8 rounded-lg border border-border bg-card px-2 font-mono text-xs text-muted-foreground outline-none"
            >
              <option value="rank">By Rank</option>
              <option value="change24h">24h Change</option>
              <option value="change7d">7d Change</option>
              <option value="volume">Volume</option>
            </select>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {["#", "Asset", "Price", "24h", "7d", "Market Cap", "Volume (24h)", "ATH %", "7-Day"].map(h => (
                  <th key={h} className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-accent/40" /></td>
                      ))}
                    </tr>
                  ))
                : displayed.map((coin, i) => {
                    const c24 = coin.price_change_percentage_24h ?? 0;
                    const c7 = coin.price_change_percentage_7d_in_currency ?? 0;
                    const athChg = coin.ath_change_percentage ?? 0;
                    const pos24 = c24 >= 0;
                    const pos7 = c7 >= 0;
                    return (
                      <motion.tr
                        key={coin.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-border/40 transition-colors hover:bg-accent/20"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{coin.market_cap_rank}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <img src={coin.image} alt={coin.name} className="h-7 w-7 rounded-full" />
                            <div>
                              <p className="font-display text-sm font-bold text-foreground">{coin.name}</p>
                              <p className="font-mono text-[10px] uppercase text-muted-foreground">{coin.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-bold text-foreground">{fmtPrice(coin.current_price)}</td>
                        <td className={`px-4 py-3 font-mono text-sm font-bold ${pos24 ? "text-bullish" : "text-bearish"}`}>
                          <div className="flex items-center gap-1">
                            {pos24 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {pos24 ? "+" : ""}{fmt(c24)}%
                          </div>
                        </td>
                        <td className={`px-4 py-3 font-mono text-sm font-bold ${pos7 ? "text-bullish" : "text-bearish"}`}>
                          {pos7 ? "+" : ""}{fmt(c7)}%
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{fmtBig(coin.market_cap)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{fmtBig(coin.total_volume)}</td>
                        <td className={`px-4 py-3 font-mono text-xs ${athChg >= -10 ? "text-watch" : "text-muted-foreground"}`}>
                          {fmt(athChg)}%
                        </td>
                        <td className="px-4 py-3">
                          <Sparkline prices={coin.sparkline_in_7d?.price ?? []} positive={pos7} />
                        </td>
                      </motion.tr>
                    );
                  })}
            </tbody>
          </table>

          {!isLoading && displayed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="font-mono text-xs uppercase text-muted-foreground/50">No assets match your filter</p>
            </div>
          )}
        </div>

        {/* ── Footer note ── */}
        <p className="text-center font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
          Data from CoinGecko · refreshes every 60 seconds · prices in USD
        </p>
      </div>
    </DashboardLayout>
  );
}

// Prevent "stat.value is not a function" — it's a direct string
function value(v: string) { return v; }
