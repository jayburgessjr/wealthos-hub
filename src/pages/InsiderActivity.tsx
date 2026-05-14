import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Users,
  BarChart2,
  AlertCircle,
  Search,
  ExternalLink,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CongressionalTrade {
  politician: string;
  party: "D" | "R" | "I";
  chamber: "House" | "Senate";
  ticker: string;
  transaction_type: "buy" | "sell";
  amount_min: number;
  amount_max: number;
  trade_date: string;
  disclosure_date: string;
  description: string;
}

interface InsiderTrade {
  name: string;
  title: string;
  company: string;
  ticker: string;
  transaction_type: "purchase" | "sale" | "grant";
  shares: number;
  value: number;
  filing_date: string;
}

interface TradeResponse<T> {
  trades: T[];
  source: "live" | "mock";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmountRange(min: number, max: number): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${n.toLocaleString()}`;
  };
  if (min === max || max === 0) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}

function formatValue(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
}

function formatShares(n: number): string {
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getThisMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function isThisMonth(iso: string): boolean {
  if (!iso) return false;
  const [year, month] = iso.split("-").map(Number);
  const { start } = getThisMonthBounds();
  return year === start.getFullYear() && month === start.getMonth() + 1;
}

// ── Summary stat card ─────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "bullish" | "bearish" | "neutral";
}

function StatCard({ label, value, icon, accent = "neutral" }: StatCardProps) {
  const accentClass =
    accent === "bullish"
      ? "text-bullish"
      : accent === "bearish"
      ? "text-bearish"
      : "text-foreground";

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider">
        <span>{label}</span>
        {icon}
      </div>
      <span className={`font-mono text-xl font-semibold ${accentClass}`}>{value}</span>
    </div>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={99} className="text-center py-12 text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8 opacity-40" />
          <span className="text-sm">No recent transactions found.</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InsiderActivity() {
  const navigate = useNavigate();

  // Congress filters
  const [congressTypeFilter, setCongressTypeFilter] = useState<"all" | "buy" | "sell">("all");
  const [partyFilter, setPartyFilter] = useState<"all" | "D" | "R">("all");
  const [congressSearch, setCongressSearch] = useState("");

  // Insider filters
  const [insiderTypeFilter, setInsiderTypeFilter] = useState<"all" | "purchase" | "sale" | "grant">("all");
  const [insiderSearch, setInsiderSearch] = useState("");

  // ── Data fetching ────────────────────────────────────────────────────────────

  const { data: congressData, isLoading: congressLoading } = useQuery<TradeResponse<CongressionalTrade>>({
    queryKey: ["congress-trades"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-congress-trades", {
        body: { type: "congressional", limit: 50 },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: insiderData, isLoading: insiderLoading } = useQuery<TradeResponse<InsiderTrade>>({
    queryKey: ["insider-trades"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-congress-trades", {
        body: { type: "insider", limit: 50 },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const congressTrades = congressData?.trades ?? [];
  const insiderTrades = insiderData?.trades ?? [];
  const congressSource = congressData?.source;
  const insiderSource = insiderData?.source;

  // ── Summary stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    // Congress: buy/sell totals this month (midpoint of range)
    let congressBuyTotal = 0;
    let congressSellTotal = 0;
    const tickerBuyCounts: Record<string, number> = {};
    const politicianCounts: Record<string, number> = {};

    for (const t of congressTrades) {
      const mid = (t.amount_min + t.amount_max) / 2;
      if (isThisMonth(t.trade_date)) {
        if (t.transaction_type === "buy") congressBuyTotal += mid;
        else congressSellTotal += mid;
      }
      if (t.transaction_type === "buy") {
        tickerBuyCounts[t.ticker] = (tickerBuyCounts[t.ticker] ?? 0) + 1;
      }
      politicianCounts[t.politician] = (politicianCounts[t.politician] ?? 0) + 1;
    }

    // Insider: buy/sell totals this month
    let insiderBuyTotal = 0;
    let insiderSellTotal = 0;
    const insiderNameCounts: Record<string, number> = {};

    for (const t of insiderTrades) {
      if (isThisMonth(t.filing_date)) {
        if (t.transaction_type === "purchase") insiderBuyTotal += t.value;
        else if (t.transaction_type === "sale") insiderSellTotal += t.value;
      }
      insiderNameCounts[t.name] = (insiderNameCounts[t.name] ?? 0) + 1;
    }

    const totalBuy = congressBuyTotal + insiderBuyTotal;
    const totalSell = congressSellTotal + insiderSellTotal;

    const mostBoughtTicker =
      Object.entries(tickerBuyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    const mostActivePolitician =
      Object.entries(politicianCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    return { totalBuy, totalSell, mostBoughtTicker, mostActivePolitician };
  }, [congressTrades, insiderTrades]);

  // ── Filtered data ────────────────────────────────────────────────────────────

  const filteredCongress = useMemo(() => {
    const q = congressSearch.toLowerCase();
    return congressTrades
      .filter((t) => {
        if (congressTypeFilter !== "all" && t.transaction_type !== congressTypeFilter) return false;
        if (partyFilter !== "all" && t.party !== partyFilter) return false;
        if (q && !t.politician.toLowerCase().includes(q) && !t.ticker.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (a.trade_date < b.trade_date ? 1 : -1));
  }, [congressTrades, congressTypeFilter, partyFilter, congressSearch]);

  const filteredInsider = useMemo(() => {
    const q = insiderSearch.toLowerCase();
    return insiderTrades
      .filter((t) => {
        if (insiderTypeFilter !== "all" && t.transaction_type !== insiderTypeFilter) return false;
        if (q && !t.name.toLowerCase().includes(q) && !t.ticker.toLowerCase().includes(q) && !t.company.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (a.filing_date < b.filing_date ? 1 : -1));
  }, [insiderTrades, insiderTypeFilter, insiderSearch]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col gap-1"
        >
          <h1 className="text-2xl font-bold text-foreground">
            Insider &amp; Congressional Activity
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time tracking of congressional disclosures and SEC Form 4 filings.
          </p>
        </motion.div>

        {/* Disclaimer banner */}
        <div className="flex items-start gap-2 bg-muted/40 border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Data sourced from public congressional financial disclosures and SEC Form 4 filings.
            All trades shown are legally permitted. Not investment advice.
          </span>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Buy Value (Month)"
            value={formatValue(stats.totalBuy)}
            icon={<TrendingUp className="w-4 h-4" />}
            accent="bullish"
          />
          <StatCard
            label="Total Sell Value (Month)"
            value={formatValue(stats.totalSell)}
            icon={<TrendingDown className="w-4 h-4" />}
            accent="bearish"
          />
          <StatCard
            label="Most Bought Ticker"
            value={stats.mostBoughtTicker}
            icon={<BarChart2 className="w-4 h-4" />}
          />
          <StatCard
            label="Most Active Politician"
            value={stats.mostActivePolitician}
            icon={<Users className="w-4 h-4" />}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="congressional">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <TabsList>
              <TabsTrigger value="congressional">Congressional Trades</TabsTrigger>
              <TabsTrigger value="insider">Insider Transactions</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Congressional tab ─────────────────────────────────────────── */}
          <TabsContent value="congressional" className="mt-4 flex flex-col gap-4">
            {/* Source badge */}
            {congressSource === "mock" && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/40">
                  Sample Data — Add QUIVER_KEY for live data
                </Badge>
              </div>
            )}

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 items-center">
              <Select
                value={congressTypeFilter}
                onValueChange={(v) => setCongressTypeFilter(v as typeof congressTypeFilter)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={partyFilter}
                onValueChange={(v) => setPartyFilter(v as typeof partyFilter)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Party" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parties</SelectItem>
                  <SelectItem value="D">Democrat</SelectItem>
                  <SelectItem value="R">Republican</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search politician or ticker…"
                  value={congressSearch}
                  onChange={(e) => setCongressSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Politician</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Chamber</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount Range</TableHead>
                    <TableHead>Trade Date</TableHead>
                    <TableHead>Disclosed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {congressLoading ? (
                    <SkeletonRows cols={8} />
                  ) : filteredCongress.length === 0 ? (
                    <EmptyState />
                  ) : (
                    filteredCongress.map((trade, i) => (
                      <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-foreground whitespace-nowrap">
                          {trade.politician}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              trade.party === "D"
                                ? "border-blue-500/50 text-blue-400"
                                : trade.party === "R"
                                ? "border-red-500/50 text-red-400"
                                : "border-muted-foreground/40 text-muted-foreground"
                            }
                          >
                            {trade.party}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {trade.chamber}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="h-auto p-0 font-mono font-semibold text-foreground hover:text-primary gap-1"
                            onClick={() => navigate(`/chart?ticker=${trade.ticker}`)}
                          >
                            {trade.ticker}
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              trade.transaction_type === "buy"
                                ? "bg-bullish/10 text-bullish border-bullish/20"
                                : "bg-bearish/10 text-bearish border-bearish/20"
                            }
                            variant="outline"
                          >
                            {trade.transaction_type === "buy" ? "Buy" : "Sell"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatAmountRange(trade.amount_min, trade.amount_max)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(trade.trade_date)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(trade.disclosure_date)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Insider tab ───────────────────────────────────────────────── */}
          <TabsContent value="insider" className="mt-4 flex flex-col gap-4">
            {/* Source badge */}
            {insiderSource === "mock" && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/40">
                  Sample Data — Add QUIVER_KEY for live data
                </Badge>
              </div>
            )}

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 items-center">
              <Select
                value={insiderTypeFilter}
                onValueChange={(v) => setInsiderTypeFilter(v as typeof insiderTypeFilter)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="grant">Grant</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, company, or ticker…"
                  value={insiderSearch}
                  onChange={(e) => setInsiderSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Executive</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Filed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insiderLoading ? (
                    <SkeletonRows cols={8} />
                  ) : filteredInsider.length === 0 ? (
                    <EmptyState />
                  ) : (
                    filteredInsider.map((trade, i) => (
                      <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-foreground whitespace-nowrap">
                          {trade.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                          {trade.title}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                          {trade.company}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="h-auto p-0 font-mono font-semibold text-foreground hover:text-primary gap-1"
                            onClick={() => navigate(`/chart?ticker=${trade.ticker}`)}
                          >
                            {trade.ticker}
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              trade.transaction_type === "purchase"
                                ? "bg-bullish/10 text-bullish border-bullish/20"
                                : trade.transaction_type === "sale"
                                ? "bg-bearish/10 text-bearish border-bearish/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }
                            variant="outline"
                          >
                            {trade.transaction_type.charAt(0).toUpperCase() + trade.transaction_type.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatShares(trade.shares)}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">
                          {formatValue(trade.value)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(trade.filing_date)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
