import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Search,
  Filter,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Mock Data ────────────────────────────────────────────────────────────────

interface OptionsFlowRow {
  id: number;
  time: string;
  ticker: string;
  expDate: string;
  strike: number;
  type: "Call" | "Put";
  sentiment: "Bullish" | "Bearish" | "Neutral";
  premium: number;
  openInterest: number;
  volume: number;
  iv: number;
}

const FLOW_DATA: OptionsFlowRow[] = [
  {
    id: 1,
    time: "09:32",
    ticker: "SPY",
    expDate: "2025-06-20",
    strike: 540,
    type: "Call",
    sentiment: "Bullish",
    premium: 4_820_000,
    openInterest: 18_450,
    volume: 32_100,
    iv: 14.2,
  },
  {
    id: 2,
    time: "09:35",
    ticker: "NVDA",
    expDate: "2025-06-27",
    strike: 1050,
    type: "Call",
    sentiment: "Bullish",
    premium: 3_650_000,
    openInterest: 5_200,
    volume: 9_800,
    iv: 38.7,
  },
  {
    id: 3,
    time: "09:41",
    ticker: "QQQ",
    expDate: "2025-07-18",
    strike: 460,
    type: "Put",
    sentiment: "Bearish",
    premium: 3_110_000,
    openInterest: 24_000,
    volume: 8_400,
    iv: 15.9,
  },
  {
    id: 4,
    time: "09:48",
    ticker: "TSLA",
    expDate: "2025-06-20",
    strike: 200,
    type: "Put",
    sentiment: "Bearish",
    premium: 2_940_000,
    openInterest: 12_000,
    volume: 28_500,
    iv: 62.4,
  },
  {
    id: 5,
    time: "09:52",
    ticker: "AAPL",
    expDate: "2025-07-18",
    strike: 200,
    type: "Call",
    sentiment: "Bullish",
    premium: 2_780_000,
    openInterest: 31_200,
    volume: 15_600,
    iv: 22.1,
  },
  {
    id: 6,
    time: "10:01",
    ticker: "META",
    expDate: "2025-06-27",
    strike: 530,
    type: "Call",
    sentiment: "Bullish",
    premium: 2_430_000,
    openInterest: 7_800,
    volume: 14_200,
    iv: 29.3,
  },
  {
    id: 7,
    time: "10:09",
    ticker: "AMD",
    expDate: "2025-07-18",
    strike: 175,
    type: "Call",
    sentiment: "Neutral",
    premium: 1_870_000,
    openInterest: 9_400,
    volume: 7_200,
    iv: 41.5,
  },
  {
    id: 8,
    time: "10:14",
    ticker: "IWM",
    expDate: "2025-06-20",
    strike: 205,
    type: "Put",
    sentiment: "Bearish",
    premium: 1_650_000,
    openInterest: 16_500,
    volume: 42_000,
    iv: 18.8,
  },
  {
    id: 9,
    time: "10:22",
    ticker: "AMZN",
    expDate: "2025-08-15",
    strike: 205,
    type: "Call",
    sentiment: "Bullish",
    premium: 1_580_000,
    openInterest: 6_300,
    volume: 5_100,
    iv: 27.6,
  },
  {
    id: 10,
    time: "10:31",
    ticker: "GLD",
    expDate: "2025-09-19",
    strike: 235,
    type: "Call",
    sentiment: "Bullish",
    premium: 1_340_000,
    openInterest: 11_200,
    volume: 4_800,
    iv: 16.3,
  },
  {
    id: 11,
    time: "10:38",
    ticker: "SPY",
    expDate: "2025-06-06",
    strike: 525,
    type: "Put",
    sentiment: "Bearish",
    premium: 1_210_000,
    openInterest: 8_700,
    volume: 36_400,
    iv: 13.1,
  },
  {
    id: 12,
    time: "10:45",
    ticker: "MSFT",
    expDate: "2025-07-18",
    strike: 430,
    type: "Call",
    sentiment: "Bullish",
    premium: 1_090_000,
    openInterest: 14_300,
    volume: 9_200,
    iv: 19.7,
  },
  {
    id: 13,
    time: "10:52",
    ticker: "GOOGL",
    expDate: "2025-06-20",
    strike: 175,
    type: "Call",
    sentiment: "Neutral",
    premium: 980_000,
    openInterest: 5_800,
    volume: 3_400,
    iv: 24.8,
  },
  {
    id: 14,
    time: "11:03",
    ticker: "XLE",
    expDate: "2025-07-18",
    strike: 88,
    type: "Put",
    sentiment: "Bearish",
    premium: 870_000,
    openInterest: 19_200,
    volume: 22_800,
    iv: 26.4,
  },
  {
    id: 15,
    time: "11:11",
    ticker: "TLT",
    expDate: "2025-09-19",
    strike: 88,
    type: "Call",
    sentiment: "Bullish",
    premium: 760_000,
    openInterest: 7_500,
    volume: 4_100,
    iv: 17.2,
  },
  {
    id: 16,
    time: "11:19",
    ticker: "COIN",
    expDate: "2025-06-20",
    strike: 220,
    type: "Call",
    sentiment: "Bullish",
    premium: 690_000,
    openInterest: 3_200,
    volume: 8_900,
    iv: 84.2,
  },
  {
    id: 17,
    time: "11:28",
    ticker: "NFLX",
    expDate: "2025-07-18",
    strike: 680,
    type: "Put",
    sentiment: "Bearish",
    premium: 580_000,
    openInterest: 2_100,
    volume: 6_700,
    iv: 35.9,
  },
  {
    id: 18,
    time: "11:34",
    ticker: "DIA",
    expDate: "2025-06-20",
    strike: 400,
    type: "Put",
    sentiment: "Neutral",
    premium: 510_000,
    openInterest: 8_300,
    volume: 3_200,
    iv: 12.6,
  },
  {
    id: 19,
    time: "11:41",
    ticker: "SOFI",
    expDate: "2025-06-27",
    strike: 12,
    type: "Call",
    sentiment: "Bullish",
    premium: 430_000,
    openInterest: 41_000,
    volume: 128_000,
    iv: 68.3,
  },
  {
    id: 20,
    time: "11:49",
    ticker: "BAC",
    expDate: "2025-07-18",
    strike: 42,
    type: "Call",
    sentiment: "Bullish",
    premium: 370_000,
    openInterest: 22_000,
    volume: 18_400,
    iv: 23.1,
  },
];

interface DarkPoolRow {
  id: number;
  time: string;
  ticker: string;
  price: number;
  size: number;
  value: number;
  exchange: string;
}

const DARK_POOL_DATA: DarkPoolRow[] = [
  {
    id: 1,
    time: "09:33",
    ticker: "SPY",
    price: 535.42,
    size: 2_850_000,
    value: 1_525_947_000,
    exchange: "FINRA ADF",
  },
  {
    id: 2,
    time: "09:47",
    ticker: "AAPL",
    price: 196.18,
    size: 4_200_000,
    value: 824_556_000,
    exchange: "IEX Dark",
  },
  {
    id: 3,
    time: "09:58",
    ticker: "NVDA",
    price: 1038.5,
    size: 620_000,
    value: 643_870_000,
    exchange: "FINRA ADF",
  },
  {
    id: 4,
    time: "10:12",
    ticker: "TSLA",
    price: 178.64,
    size: 3_100_000,
    value: 554_784_000,
    exchange: "CBOE EDGX Dark",
  },
  {
    id: 5,
    time: "10:25",
    ticker: "MSFT",
    price: 422.3,
    size: 1_200_000,
    value: 506_760_000,
    exchange: "NYSE Arca Dark",
  },
  {
    id: 6,
    time: "10:39",
    ticker: "QQQ",
    price: 456.88,
    size: 1_050_000,
    value: 479_724_000,
    exchange: "FINRA ADF",
  },
  {
    id: 7,
    time: "10:54",
    ticker: "META",
    price: 522.15,
    size: 820_000,
    value: 428_163_000,
    exchange: "IEX Dark",
  },
  {
    id: 8,
    time: "11:08",
    ticker: "AMZN",
    price: 201.72,
    size: 1_900_000,
    value: 383_268_000,
    exchange: "CBOE BYX Dark",
  },
  {
    id: 9,
    time: "11:22",
    ticker: "GS",
    price: 484.6,
    size: 640_000,
    value: 310_144_000,
    exchange: "FINRA ADF",
  },
  {
    id: 10,
    time: "11:36",
    ticker: "JPM",
    price: 218.9,
    size: 1_350_000,
    value: 295_515_000,
    exchange: "NYSE Arca Dark",
  },
];

// ─── Helper Utilities ─────────────────────────────────────────────────────────

const fmt = {
  premium: (v: number) =>
    v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(2)}M`
      : `$${(v / 1_000).toFixed(0)}K`,
  value: (v: number) =>
    v >= 1_000_000_000
      ? `$${(v / 1_000_000_000).toFixed(2)}B`
      : `$${(v / 1_000_000).toFixed(0)}M`,
  number: (v: number) => v.toLocaleString(),
  price: (v: number) => `$${v.toFixed(2)}`,
  pct: (v: number) => `${v.toFixed(1)}%`,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  delay,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SentimentBadge({
  sentiment,
}: {
  sentiment: "Bullish" | "Bearish" | "Neutral";
}) {
  if (sentiment === "Bullish")
    return (
      <Badge className="bg-bullish/10 text-bullish border-bullish/30 text-xs">
        Bullish
      </Badge>
    );
  if (sentiment === "Bearish")
    return (
      <Badge className="bg-bearish/10 text-bearish border-bearish/30 text-xs">
        Bearish
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground text-xs">
      Neutral
    </Badge>
  );
}

function TypeBadge({ type }: { type: "Call" | "Put" }) {
  return type === "Call" ? (
    <Badge className="bg-bullish/10 text-bullish border-bullish/30 text-xs font-semibold">
      CALL
    </Badge>
  ) : (
    <Badge className="bg-bearish/10 text-bearish border-bearish/30 text-xs font-semibold">
      PUT
    </Badge>
  );
}

function PutCallGauge({ ratio }: { ratio: number }) {
  const isGreen = ratio < 0.7;
  const isRed = ratio > 1.0;
  const color = isGreen
    ? "text-bullish"
    : isRed
      ? "text-bearish"
      : "text-yellow-400";
  const label = isGreen ? "Bullish" : isRed ? "Bearish" : "Neutral";
  const bg = isGreen
    ? "bg-bullish/10 border-bullish/30"
    : isRed
      ? "bg-bearish/10 border-bearish/30"
      : "bg-yellow-400/10 border-yellow-400/30";

  return (
    <Card className={`border ${bg}`}>
      <CardContent className="p-5 flex items-center gap-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Put/Call Ratio
          </p>
          <p className={`text-4xl font-bold ${color}`}>{ratio.toFixed(2)}</p>
        </div>
        <div>
          <Badge className={`${bg} ${color} border text-sm px-3 py-1`}>
            {label}
          </Badge>
          <p className="text-xs text-muted-foreground mt-2">
            {isGreen &&
              "Below 0.70 — more calls than puts, market skewing bullish"}
            {isRed &&
              "Above 1.00 — more puts than calls, market skewing bearish"}
            {!isGreen && !isRed && "0.70–1.00 — balanced call/put activity"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OptionsFlow() {
  const [typeFilter, setTypeFilter] = useState<"All" | "Call" | "Put">("All");
  const [sentimentFilter, setSentimentFilter] = useState<
    "All" | "Bullish" | "Bearish" | "Neutral"
  >("All");
  const [tickerSearch, setTickerSearch] = useState("");

  const filteredFlow = useMemo(() => {
    return FLOW_DATA.filter((row) => {
      if (typeFilter !== "All" && row.type !== typeFilter) return false;
      if (sentimentFilter !== "All" && row.sentiment !== sentimentFilter)
        return false;
      if (
        tickerSearch &&
        !row.ticker.toLowerCase().includes(tickerSearch.toLowerCase())
      )
        return false;
      return true;
    });
  }, [typeFilter, sentimentFilter, tickerSearch]);

  const totalPremium = FLOW_DATA.reduce((s, r) => s + r.premium, 0);
  const bullishCount = FLOW_DATA.filter(
    (r) => r.sentiment === "Bullish",
  ).length;
  const bearishCount = FLOW_DATA.filter(
    (r) => r.sentiment === "Bearish",
  ).length;
  const unusualCount = FLOW_DATA.filter(
    (r) => r.volume > r.openInterest,
  ).length;
  const totalPuts = FLOW_DATA.filter((r) => r.type === "Put").length;
  const totalCalls = FLOW_DATA.filter((r) => r.type === "Call").length;
  const pcRatio = totalPuts / (totalCalls || 1);

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
        <div className="space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-2xl font-bold text-foreground">Options Flow</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time institutional options activity and dark pool prints
            </p>
          </motion.div>

          {/* Disclaimer */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
          >
            <div className="flex items-start gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Options flow data is for informational purposes only. Not
                investment advice. Past unusual activity does not guarantee
                future price movements.
              </p>
            </div>
          </motion.div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Total Premium Today"
              value={fmt.premium(totalPremium)}
              icon={Activity}
              color="text-primary"
              delay={0.1}
            />
            <KpiCard
              title="Bullish Flow"
              value={`${((bullishCount / FLOW_DATA.length) * 100).toFixed(0)}%`}
              icon={TrendingUp}
              color="text-bullish"
              delay={0.15}
            />
            <KpiCard
              title="Bearish Flow"
              value={`${((bearishCount / FLOW_DATA.length) * 100).toFixed(0)}%`}
              icon={TrendingDown}
              color="text-bearish"
              delay={0.2}
            />
            <KpiCard
              title="Unusual Activity"
              value={String(unusualCount)}
              icon={AlertTriangle}
              color="text-yellow-400"
              delay={0.25}
            />
          </div>

          {/* Put/Call Ratio */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <PutCallGauge ratio={pcRatio} />
          </motion.div>

          {/* Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search ticker…"
                      value={tickerSearch}
                      onChange={(e) => setTickerSearch(e.target.value)}
                      className="pl-9 w-40 h-9 bg-background"
                    />
                  </div>
                  <Select
                    value={typeFilter}
                    onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
                  >
                    <SelectTrigger className="w-36 h-9 bg-background">
                      <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Types</SelectItem>
                      <SelectItem value="Call">Calls Only</SelectItem>
                      <SelectItem value="Put">Puts Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={sentimentFilter}
                    onValueChange={(v) =>
                      setSentimentFilter(v as typeof sentimentFilter)
                    }
                  >
                    <SelectTrigger className="w-40 h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Sentiment</SelectItem>
                      <SelectItem value="Bullish">Bullish</SelectItem>
                      <SelectItem value="Bearish">Bearish</SelectItem>
                      <SelectItem value="Neutral">Neutral</SelectItem>
                    </SelectContent>
                  </Select>
                  {(typeFilter !== "All" ||
                    sentimentFilter !== "All" ||
                    tickerSearch) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTypeFilter("All");
                        setSentimentFilter("All");
                        setTickerSearch("");
                      }}
                      className="h-9 text-muted-foreground"
                    >
                      Clear filters
                    </Button>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {filteredFlow.length} of {FLOW_DATA.length} trades
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Options Flow Table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Options Flow
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">
                          Time
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Ticker
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Exp Date
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Strike
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Type
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Sentiment
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Premium
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Open Int.
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Volume
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          IV %
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFlow.map((row) => {
                        const isUnusual = row.volume > row.openInterest;
                        return (
                          <TableRow
                            key={row.id}
                            className="border-border hover:bg-accent/50 transition-colors"
                          >
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {row.time}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">
                                  {row.ticker}
                                </span>
                                {isUnusual && (
                                  <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/30 text-[10px] px-1.5 py-0">
                                    Unusual
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {row.expDate}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              ${row.strike}
                            </TableCell>
                            <TableCell>
                              <TypeBadge type={row.type} />
                            </TableCell>
                            <TableCell>
                              <SentimentBadge sentiment={row.sentiment} />
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm text-foreground">
                              {fmt.premium(row.premium)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground font-mono">
                              {fmt.number(row.openInterest)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono text-foreground">
                              {fmt.number(row.volume)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono text-muted-foreground">
                              {fmt.pct(row.iv)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredFlow.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="text-center py-10 text-muted-foreground text-sm"
                          >
                            No flow matching current filters
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Dark Pool Prints */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
          >
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    Dark Pool Prints
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="text-xs text-muted-foreground"
                  >
                    Off-Exchange Block Trades
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Large block trades executed outside public exchanges — often
                  indicative of institutional positioning.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">
                          Time
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Ticker
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Price
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Size (shares)
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Value
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Exchange
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {DARK_POOL_DATA.map((row) => (
                        <TableRow
                          key={row.id}
                          className="border-border hover:bg-accent/50 transition-colors"
                        >
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {row.time}
                          </TableCell>
                          <TableCell className="font-semibold text-sm text-foreground">
                            {row.ticker}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {fmt.price(row.price)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {fmt.number(row.size)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm text-primary">
                            {fmt.value(row.value)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.exchange}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
