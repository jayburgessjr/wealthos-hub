import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Globe,
  Calendar,
  BarChart2,
  Landmark,
  AlertCircle,
  Info,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Mock Data ────────────────────────────────────────────────────────────────

interface IndexRow {
  name: string;
  value: string;
  change: string;
  changePct: string;
  ytdPct: string;
  positive: boolean;
}

const INDICES: IndexRow[] = [
  {
    name: "S&P 500",
    value: "5,308.15",
    change: "+28.42",
    changePct: "+0.54%",
    ytdPct: "+11.2%",
    positive: true,
  },
  {
    name: "NASDAQ",
    value: "18,520.43",
    change: "+124.16",
    changePct: "+0.68%",
    ytdPct: "+14.8%",
    positive: true,
  },
  {
    name: "DOW",
    value: "39,760.08",
    change: "-45.22",
    changePct: "-0.11%",
    ytdPct: "+6.4%",
    positive: false,
  },
  {
    name: "Russell 2000",
    value: "2,084.61",
    change: "-18.37",
    changePct: "-0.87%",
    ytdPct: "+2.1%",
    positive: false,
  },
  {
    name: "VIX",
    value: "14.82",
    change: "+1.14",
    changePct: "+8.33%",
    ytdPct: "-22.4%",
    positive: false,
  },
  {
    name: "DAX",
    value: "18,722.39",
    change: "+91.05",
    changePct: "+0.49%",
    ytdPct: "+9.7%",
    positive: true,
  },
  {
    name: "FTSE 100",
    value: "8,328.64",
    change: "+14.22",
    changePct: "+0.17%",
    ytdPct: "+5.3%",
    positive: true,
  },
  {
    name: "Nikkei 225",
    value: "38,405.74",
    change: "-203.55",
    changePct: "-0.53%",
    ytdPct: "+8.6%",
    positive: false,
  },
  {
    name: "Hang Seng",
    value: "18,608.94",
    change: "+342.21",
    changePct: "+1.87%",
    ytdPct: "+12.4%",
    positive: true,
  },
  {
    name: "Shanghai",
    value: "3,154.03",
    change: "+22.48",
    changePct: "+0.72%",
    ytdPct: "+5.1%",
    positive: true,
  },
];

interface FedEvent {
  date: string;
  event: string;
  consensus: string;
  probability: number;
  impact: "High" | "Medium" | "Low";
}

const FED_CALENDAR: FedEvent[] = [
  {
    date: "Jun 11–12, 2025",
    event: "FOMC Meeting",
    consensus: "Rate Unchanged (5.25–5.50%)",
    probability: 82,
    impact: "High",
  },
  {
    date: "Jul 7, 2025",
    event: "FOMC Minutes Release",
    consensus: "Hawkish tone expected",
    probability: 70,
    impact: "Medium",
  },
  {
    date: "Jul 29–30, 2025",
    event: "FOMC Meeting",
    consensus: "Rate Unchanged",
    probability: 74,
    impact: "High",
  },
  {
    date: "Aug 21–23, 2025",
    event: "Jackson Hole Symposium",
    consensus: "Dovish pivot signal",
    probability: 55,
    impact: "High",
  },
  {
    date: "Sep 16–17, 2025",
    event: "FOMC Meeting",
    consensus: "25bps Cut",
    probability: 61,
    impact: "High",
  },
  {
    date: "Nov 4–5, 2025",
    event: "FOMC Meeting",
    consensus: "25bps Cut",
    probability: 58,
    impact: "High",
  },
  {
    date: "Dec 9–10, 2025",
    event: "FOMC Meeting",
    consensus: "Rate Unchanged",
    probability: 49,
    impact: "High",
  },
];

interface YieldRow {
  maturity: string;
  yield: string;
  change: string;
  rateUp: boolean;
}

const YIELD_CURVE: YieldRow[] = [
  { maturity: "1 Month", yield: "5.32%", change: "+2", rateUp: true },
  { maturity: "3 Month", yield: "5.28%", change: "-1", rateUp: false },
  { maturity: "6 Month", yield: "5.20%", change: "-3", rateUp: false },
  { maturity: "1 Year", yield: "5.04%", change: "-4", rateUp: false },
  { maturity: "2 Year", yield: "4.88%", change: "-6", rateUp: false },
  { maturity: "5 Year", yield: "4.52%", change: "-5", rateUp: false },
  { maturity: "7 Year", yield: "4.47%", change: "-3", rateUp: false },
  { maturity: "10 Year", yield: "4.41%", change: "-2", rateUp: false },
  { maturity: "20 Year", yield: "4.68%", change: "-1", rateUp: false },
  { maturity: "30 Year", yield: "4.60%", change: "+1", rateUp: true },
];

// 2-year (4.88%) > 10-year (4.41%) = inverted
const CURVE_INVERTED = true;

interface CentralBank {
  name: string;
  flag: string;
  currentRate: string;
  lastChange: string;
  nextDecision: string;
  expectedAction: string;
  sentiment: "dovish" | "hawkish" | "neutral";
}

const CENTRAL_BANKS: CentralBank[] = [
  {
    name: "Federal Reserve",
    flag: "🇺🇸",
    currentRate: "5.25–5.50%",
    lastChange: "Jul 26, 2023 (+25bps)",
    nextDecision: "Jun 12, 2025",
    expectedAction: "Hold",
    sentiment: "hawkish",
  },
  {
    name: "ECB",
    flag: "🇪🇺",
    currentRate: "4.25%",
    lastChange: "Jun 6, 2024 (-25bps)",
    nextDecision: "Jun 5, 2025",
    expectedAction: "Cut 25bps",
    sentiment: "dovish",
  },
  {
    name: "Bank of England",
    flag: "🇬🇧",
    currentRate: "5.25%",
    lastChange: "Aug 3, 2023 (+25bps)",
    nextDecision: "Jun 19, 2025",
    expectedAction: "Hold",
    sentiment: "neutral",
  },
  {
    name: "Bank of Japan",
    flag: "🇯🇵",
    currentRate: "0.10%",
    lastChange: "Mar 19, 2024 (+10bps)",
    nextDecision: "Jun 13, 2025",
    expectedAction: "Hold",
    sentiment: "hawkish",
  },
  {
    name: "Bank of Canada",
    flag: "🇨🇦",
    currentRate: "4.50%",
    lastChange: "Jan 24, 2024 (+25bps)",
    nextDecision: "Jun 4, 2025",
    expectedAction: "Cut 25bps",
    sentiment: "dovish",
  },
  {
    name: "RBA",
    flag: "🇦🇺",
    currentRate: "4.35%",
    lastChange: "Nov 7, 2023 (+25bps)",
    nextDecision: "Jun 17, 2025",
    expectedAction: "Hold",
    sentiment: "neutral",
  },
];

interface EconEvent {
  date: string;
  countryFlag: string;
  indicator: string;
  previous: string;
  forecast: string;
  actual: string;
  impact: "High" | "Medium" | "Low";
  actualBetter?: boolean;
}

const ECON_CALENDAR: EconEvent[] = [
  {
    date: "May 29",
    countryFlag: "🇺🇸",
    indicator: "Consumer Confidence",
    previous: "97.5",
    forecast: "96.0",
    actual: "98.7",
    impact: "Medium",
    actualBetter: true,
  },
  {
    date: "May 31",
    countryFlag: "🇺🇸",
    indicator: "PCE Price Index MoM",
    previous: "0.3%",
    forecast: "0.3%",
    actual: "0.3%",
    impact: "High",
    actualBetter: true,
  },
  {
    date: "Jun 3",
    countryFlag: "🇺🇸",
    indicator: "ISM Manufacturing PMI",
    previous: "49.2",
    forecast: "49.8",
    actual: "",
    impact: "High",
  },
  {
    date: "Jun 4",
    countryFlag: "🇺🇸",
    indicator: "JOLTS Job Openings",
    previous: "8.49M",
    forecast: "8.35M",
    actual: "",
    impact: "High",
  },
  {
    date: "Jun 5",
    countryFlag: "🇪🇺",
    indicator: "ECB Rate Decision",
    previous: "4.50%",
    forecast: "4.25%",
    actual: "",
    impact: "High",
  },
  {
    date: "Jun 6",
    countryFlag: "🇺🇸",
    indicator: "Non-Farm Payrolls (NFP)",
    previous: "175K",
    forecast: "185K",
    actual: "",
    impact: "High",
  },
  {
    date: "Jun 6",
    countryFlag: "🇺🇸",
    indicator: "Unemployment Rate",
    previous: "3.9%",
    forecast: "3.9%",
    actual: "",
    impact: "High",
  },
  {
    date: "Jun 11",
    countryFlag: "🇺🇸",
    indicator: "Core CPI MoM",
    previous: "0.3%",
    forecast: "0.3%",
    actual: "",
    impact: "High",
  },
  {
    date: "Jun 11",
    countryFlag: "🇺🇸",
    indicator: "CPI YoY",
    previous: "3.4%",
    forecast: "3.3%",
    actual: "",
    impact: "High",
  },
  {
    date: "Jun 12",
    countryFlag: "🇺🇸",
    indicator: "PPI MoM",
    previous: "0.2%",
    forecast: "0.2%",
    actual: "",
    impact: "Medium",
  },
  {
    date: "Jun 12",
    countryFlag: "🇺🇸",
    indicator: "FOMC Rate Decision",
    previous: "5.50%",
    forecast: "5.50%",
    actual: "",
    impact: "High",
  },
  {
    date: "Jun 14",
    countryFlag: "🇺🇸",
    indicator: "Michigan Consumer Sentiment",
    previous: "67.4",
    forecast: "68.0",
    actual: "",
    impact: "Medium",
  },
  {
    date: "Jun 19",
    countryFlag: "🇬🇧",
    indicator: "BOE Rate Decision",
    previous: "5.25%",
    forecast: "5.25%",
    actual: "",
    impact: "High",
  },
  {
    date: "Jun 26",
    countryFlag: "🇺🇸",
    indicator: "GDP QoQ (Final)",
    previous: "1.6%",
    forecast: "1.5%",
    actual: "",
    impact: "High",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center gap-2"
    >
      <Icon className="h-5 w-5 text-primary" />
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}

function ImpactBadge({ impact }: { impact: "High" | "Medium" | "Low" }) {
  if (impact === "High")
    return (
      <Badge className="bg-bearish/10 text-bearish border-bearish/30 text-[10px] px-1.5">
        High
      </Badge>
    );
  if (impact === "Medium")
    return (
      <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/30 text-[10px] px-1.5">
        Med
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground text-[10px] px-1.5"
    >
      Low
    </Badge>
  );
}

function SentimentChip({
  sentiment,
}: {
  sentiment: "dovish" | "hawkish" | "neutral";
}) {
  if (sentiment === "dovish")
    return (
      <Badge className="bg-bullish/10 text-bullish border-bullish/30 text-xs">
        Dovish
      </Badge>
    );
  if (sentiment === "hawkish")
    return (
      <Badge className="bg-bearish/10 text-bearish border-bearish/30 text-xs">
        Hawkish
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground text-xs">
      Neutral
    </Badge>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Macro() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground">Macro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global markets, central bank policy, yield curve, and economic
            calendar
          </p>
        </motion.div>

        {/* ── Macro Regime ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                      Macro Regime
                    </p>
                    <p className="text-xl font-bold text-primary">Risk-On</p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/30 ml-1">
                    Active
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground max-w-xl">
                  Equity indices near all-time highs, credit spreads tight, VIX
                  below 16, and USD weakening. Labor market resilient; Fed on
                  hold. Momentum favors growth and cyclical assets.
                </div>
                <div className="sm:ml-auto shrink-0">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Key signals
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] text-bullish border-bullish/30"
                    >
                      VIX &lt; 16
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-bullish border-bullish/30"
                    >
                      HYG spread tight
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-bullish border-bullish/30"
                    >
                      USD weak
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-bullish border-bullish/30"
                    >
                      SPY ATH
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Global Markets ───────────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            icon={Globe}
            title="Global Markets"
            subtitle="Major indices — delayed 15 min"
            delay={0.1}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">
                          Index
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Value
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Change
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Change %
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          YTD %
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {INDICES.map((idx) => (
                        <TableRow
                          key={idx.name}
                          className="border-border hover:bg-accent/50 transition-colors"
                        >
                          <TableCell className="font-medium text-sm text-foreground">
                            {idx.name}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {idx.value}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-sm ${idx.positive ? "text-bullish" : "text-bearish"}`}
                          >
                            {idx.change}
                          </TableCell>
                          <TableCell
                            className={`text-right text-sm font-semibold ${idx.positive ? "text-bullish" : "text-bearish"}`}
                          >
                            <span className="flex items-center justify-end gap-1">
                              {idx.positive ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {idx.changePct}
                            </span>
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-xs ${idx.ytdPct.startsWith("+") ? "text-bullish" : "text-bearish"}`}
                          >
                            {idx.ytdPct}
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

        {/* ── US Treasury Yield Curve ──────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            icon={BarChart2}
            title="US Treasury Yield Curve"
            subtitle="As of market close"
            delay={0.2}
          />
          {CURVE_INVERTED && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.4 }}
            >
              <div className="flex items-center gap-2 rounded-lg border border-bearish/30 bg-bearish/5 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 text-bearish shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="text-bearish font-semibold">
                    Curve Inverted:
                  </span>{" "}
                  The 2-Year yield (4.88%) exceeds the 10-Year yield (4.41%) — a
                  historically reliable recession warning signal.
                </p>
              </div>
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">
                          Maturity
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Yield
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Change (bps)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {YIELD_CURVE.map((row) => (
                        <TableRow
                          key={row.maturity}
                          className="border-border hover:bg-accent/50 transition-colors"
                        >
                          <TableCell className="text-sm text-foreground font-medium">
                            {row.maturity}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                            {row.yield}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-sm ${row.rateUp ? "text-bearish" : "text-bullish"}`}
                          >
                            {row.change}
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

        {/* ── Central Banks ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            icon={Landmark}
            title="Central Banks"
            subtitle="Current policy stances and upcoming decisions"
            delay={0.3}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CENTRAL_BANKS.map((bank) => (
                <Card key={bank.name} className="bg-card border-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{bank.flag}</span>
                        <span className="font-semibold text-sm text-foreground">
                          {bank.name}
                        </span>
                      </div>
                      <SentimentChip sentiment={bank.sentiment} />
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {bank.currentRate}
                    </p>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Last change</span>
                        <span className="text-foreground text-right">
                          {bank.lastChange}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Next decision</span>
                        <span className="text-foreground">
                          {bank.nextDecision}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-0.5">
                        <span>Expected</span>
                        <Badge
                          className={
                            bank.expectedAction.includes("Cut")
                              ? "bg-bullish/10 text-bullish border-bullish/30 text-[10px]"
                              : bank.expectedAction.includes("Hike")
                                ? "bg-bearish/10 text-bearish border-bearish/30 text-[10px]"
                                : "bg-accent text-muted-foreground text-[10px]"
                          }
                        >
                          {bank.expectedAction}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Fed Calendar ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            icon={Calendar}
            title="Fed Calendar"
            subtitle="Upcoming Federal Reserve events"
            delay={0.4}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
          >
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">
                          Date
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Event
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Consensus
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Mkt Probability
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Impact
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {FED_CALENDAR.map((ev) => (
                        <TableRow
                          key={ev.date + ev.event}
                          className="border-border hover:bg-accent/50 transition-colors"
                        >
                          <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {ev.date}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-foreground whitespace-nowrap">
                            {ev.event}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {ev.consensus}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${ev.probability}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-foreground w-8 text-right">
                                {ev.probability}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ImpactBadge impact={ev.impact} />
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

        {/* ── Economic Calendar ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            icon={Info}
            title="Economic Calendar"
            subtitle="Key data releases — Jun 2025"
            delay={0.5}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
          >
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">
                          Date
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Country
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Indicator
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Previous
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Forecast
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground text-right">
                          Actual
                        </TableHead>
                        <TableHead className="text-xs text-muted-foreground">
                          Impact
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ECON_CALENDAR.map((ev, i) => (
                        <TableRow
                          key={i}
                          className={`border-border hover:bg-accent/50 transition-colors ${ev.impact === "High" ? "bg-bearish/[0.02]" : ""}`}
                        >
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {ev.date}
                          </TableCell>
                          <TableCell className="text-base leading-none">
                            {ev.countryFlag}
                          </TableCell>
                          <TableCell
                            className={`text-sm font-medium ${ev.impact === "High" ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {ev.indicator}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {ev.previous}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {ev.forecast}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {ev.actual ? (
                              <span
                                className={
                                  ev.actualBetter
                                    ? "text-bullish"
                                    : "text-bearish"
                                }
                              >
                                {ev.actual}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <ImpactBadge impact={ev.impact} />
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
      </div>
    </DashboardLayout>
  );
}
