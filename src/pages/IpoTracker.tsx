import { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calendar,
  Rocket,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ── Types ──────────────────────────────────────────────────────────────────────

type IpoStatus = "Filed" | "Pricing" | "Trading";
type Sector = "Tech" | "Healthcare" | "Finance" | "Consumer" | "Energy";

interface UpcomingIpo {
  company: string;
  ticker: string;
  exchange: string;
  expectedDate: string;
  priceRangeLow: number;
  priceRangeHigh: number;
  sharesOfferedM: number; // millions
  marketCapB: number; // billions
  sector: Sector;
  status: IpoStatus;
}

interface RecentIpo {
  company: string;
  ticker: string;
  ipoPrice: number;
  currentPrice: number;
  date: string;
}

interface LockupExpiry {
  company: string;
  ticker: string;
  expiryDate: string;
  sharesEligibleM: number;
  notes: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

const UPCOMING: UpcomingIpo[] = [
  {
    company: "Stripe",
    ticker: "STRP",
    exchange: "NASDAQ",
    expectedDate: "2026-06-12",
    priceRangeLow: 55,
    priceRangeHigh: 65,
    sharesOfferedM: 120,
    marketCapB: 92,
    sector: "Finance",
    status: "Pricing",
  },
  {
    company: "Klarna",
    ticker: "KLAR",
    exchange: "NYSE",
    expectedDate: "2026-06-18",
    priceRangeLow: 40,
    priceRangeHigh: 48,
    sharesOfferedM: 95,
    marketCapB: 62,
    sector: "Finance",
    status: "Filed",
  },
  {
    company: "Databricks",
    ticker: "DBRK",
    exchange: "NASDAQ",
    expectedDate: "2026-07-09",
    priceRangeLow: 70,
    priceRangeHigh: 82,
    sharesOfferedM: 80,
    marketCapB: 48,
    sector: "Tech",
    status: "Filed",
  },
  {
    company: "Impossible Foods",
    ticker: "IMPO",
    exchange: "NYSE",
    expectedDate: "2026-07-22",
    priceRangeLow: 18,
    priceRangeHigh: 24,
    sharesOfferedM: 60,
    marketCapB: 5.2,
    sector: "Consumer",
    status: "Filed",
  },
  {
    company: "Waymo",
    ticker: "WAYMO",
    exchange: "NASDAQ",
    expectedDate: "2026-08-05",
    priceRangeLow: 90,
    priceRangeHigh: 110,
    sharesOfferedM: 150,
    marketCapB: 140,
    sector: "Tech",
    status: "Filed",
  },
  {
    company: "Cerebras Systems",
    ticker: "CBRS",
    exchange: "NASDAQ",
    expectedDate: "2026-08-14",
    priceRangeLow: 28,
    priceRangeHigh: 36,
    sharesOfferedM: 50,
    marketCapB: 8.9,
    sector: "Tech",
    status: "Filed",
  },
  {
    company: "Shein",
    ticker: "SHEI",
    exchange: "NYSE",
    expectedDate: "2026-09-03",
    priceRangeLow: 22,
    priceRangeHigh: 28,
    sharesOfferedM: 200,
    marketCapB: 55,
    sector: "Consumer",
    status: "Filed",
  },
  {
    company: "Hinge Health",
    ticker: "HNGE",
    exchange: "NYSE",
    expectedDate: "2026-06-30",
    priceRangeLow: 24,
    priceRangeHigh: 30,
    sharesOfferedM: 45,
    marketCapB: 6.2,
    sector: "Healthcare",
    status: "Pricing",
  },
  {
    company: "EQT AB US Holdco",
    ticker: "EQTU",
    exchange: "NYSE",
    expectedDate: "2026-07-15",
    priceRangeLow: 32,
    priceRangeHigh: 40,
    sharesOfferedM: 70,
    marketCapB: 18,
    sector: "Finance",
    status: "Filed",
  },
  {
    company: "NovaBay Energy",
    ticker: "NBAY",
    exchange: "NASDAQ",
    expectedDate: "2026-08-28",
    priceRangeLow: 14,
    priceRangeHigh: 18,
    sharesOfferedM: 35,
    marketCapB: 2.1,
    sector: "Energy",
    status: "Filed",
  },
  {
    company: "HealthTap",
    ticker: "HTAP",
    exchange: "NASDAQ",
    expectedDate: "2026-09-10",
    priceRangeLow: 12,
    priceRangeHigh: 16,
    sharesOfferedM: 28,
    marketCapB: 1.4,
    sector: "Healthcare",
    status: "Filed",
  },
  {
    company: "FlexPort",
    ticker: "FLXP",
    exchange: "NYSE",
    expectedDate: "2026-07-28",
    priceRangeLow: 20,
    priceRangeHigh: 26,
    sharesOfferedM: 55,
    marketCapB: 9.5,
    sector: "Tech",
    status: "Filed",
  },
];

const RECENTLY_PRICED: RecentIpo[] = [
  {
    company: "Reddit",
    ticker: "RDDT",
    ipoPrice: 34,
    currentPrice: 72.4,
    date: "2024-03-21",
  },
  {
    company: "Astera Labs",
    ticker: "ALAB",
    ipoPrice: 36,
    currentPrice: 88.15,
    date: "2024-03-20",
  },
  {
    company: "Rubrik",
    ticker: "RBRK",
    ipoPrice: 32,
    currentPrice: 51.2,
    date: "2024-04-25",
  },
  {
    company: "Viking Holdings",
    ticker: "VIK",
    ipoPrice: 24,
    currentPrice: 38.75,
    date: "2024-05-01",
  },
  {
    company: "Amer Sports",
    ticker: "AS",
    ipoPrice: 13,
    currentPrice: 21.8,
    date: "2024-02-01",
  },
  {
    company: "Waystar",
    ticker: "WAY",
    ipoPrice: 21.5,
    currentPrice: 18.3,
    date: "2024-06-07",
  },
  {
    company: "OneStream",
    ticker: "OS",
    ipoPrice: 20,
    currentPrice: 28.5,
    date: "2024-07-19",
  },
  {
    company: "Tempus AI",
    ticker: "TEM",
    ipoPrice: 37,
    currentPrice: 44.6,
    date: "2024-06-14",
  },
  {
    company: "Cerebral Therapeutics",
    ticker: "CRTX",
    ipoPrice: 16,
    currentPrice: 9.8,
    date: "2024-10-03",
  },
  {
    company: "ServiceTitan",
    ticker: "TTAN",
    ipoPrice: 71,
    currentPrice: 95.3,
    date: "2024-12-12",
  },
];

const LOCKUP_EXPIRATIONS: LockupExpiry[] = [
  {
    company: "Reddit",
    ticker: "RDDT",
    expiryDate: "2024-09-21",
    sharesEligibleM: 148,
    notes: "Early employee & Series A shares unlock. Expect elevated vol.",
  },
  {
    company: "Rubrik",
    ticker: "RBRK",
    expiryDate: "2024-10-25",
    sharesEligibleM: 210,
    notes: "Founder and VC lockup expiry. Watch for secondary block trades.",
  },
  {
    company: "Astera Labs",
    ticker: "ALAB",
    expiryDate: "2024-09-17",
    sharesEligibleM: 95,
    notes: "Insider unlock; float is thin — significant dilution risk.",
  },
  {
    company: "Viking Holdings",
    ticker: "VIK",
    expiryDate: "2024-11-01",
    sharesEligibleM: 180,
    notes: "TPG Capital lockup. Secondary offering likely.",
  },
  {
    company: "OneStream",
    ticker: "OS",
    expiryDate: "2025-01-19",
    sharesEligibleM: 320,
    notes: "KKR and management shares. Largest unlock relative to float.",
  },
  {
    company: "ServiceTitan",
    ticker: "TTAN",
    expiryDate: "2025-06-12",
    sharesEligibleM: 410,
    notes: "180-day standard lockup from Dec 2024 IPO.",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function returnPct(ipo: RecentIpo) {
  return ((ipo.currentPrice - ipo.ipoPrice) / ipo.ipoPrice) * 100;
}

function statusBadgeClass(s: IpoStatus): string {
  if (s === "Trading") return "bg-primary/15 text-primary border-primary/30";
  if (s === "Pricing")
    return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30";
}

function sectorBadgeClass(s: Sector): string {
  const map: Record<Sector, string> = {
    Tech: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    Healthcare: "bg-green-600/15 text-green-400 border-green-600/30",
    Finance: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    Consumer: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    Energy: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  };
  return map[s] ?? "";
}

const SECTORS: Array<"All" | Sector> = [
  "All",
  "Tech",
  "Healthcare",
  "Finance",
  "Consumer",
  "Energy",
];

// ── Shared UI ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className={`text-2xl font-bold ${valueClass ?? "text-foreground"}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function IpoTracker() {
  const [sectorFilter, setSectorFilter] = useState<"All" | Sector>("All");

  const filteredUpcoming =
    sectorFilter === "All"
      ? UPCOMING
      : UPCOMING.filter((i) => i.sector === sectorFilter);

  const upcomingCount = UPCOMING.length;
  const thisWeekCount = UPCOMING.filter((i) => {
    const days = (new Date(i.expectedDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;
  const thisMonthCount = UPCOMING.filter((i) => {
    const days = (new Date(i.expectedDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;
  const avgReturn =
    RECENTLY_PRICED.reduce((s, i) => s + returnPct(i), 0) /
    RECENTLY_PRICED.length;

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
        <div className="space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Rocket size={20} className="text-primary" />
              <h1 className="text-xl font-bold">IPO Tracker</h1>
            </div>
          </motion.div>

          {/* Disclaimer */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
          >
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <AlertCircle
                size={15}
                className="mt-0.5 shrink-0 text-amber-400"
              />
              <p className="text-xs text-amber-400/90 leading-relaxed">
                IPO data is for informational purposes only. Not investment
                advice. Pricing and dates are estimates and subject to change.
                Always consult a licensed financial advisor before investing.
              </p>
            </div>
          </motion.div>

          {/* KPI Row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <KpiCard
              label="Upcoming IPOs"
              value={String(upcomingCount)}
              sub="tracked"
            />
            <KpiCard
              label="This Week"
              value={String(thisWeekCount)}
              sub="expected to price"
            />
            <KpiCard
              label="This Month"
              value={String(thisMonthCount)}
              sub="in pipeline"
            />
            <KpiCard
              label="Recent Avg Return"
              value={fmtPct(avgReturn)}
              valueClass={avgReturn >= 0 ? "text-primary" : "text-bearish"}
              sub="from IPO price"
            />
          </motion.div>

          {/* Upcoming IPOs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.09 }}
          >
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold text-sm">Upcoming IPOs</span>
                {/* Sector Filter */}
                <div className="flex flex-wrap gap-1.5">
                  {SECTORS.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={sectorFilter === s ? "default" : "outline"}
                      className="h-7 px-3 text-xs"
                      onClick={() => setSectorFilter(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left">Company</th>
                      <th className="px-4 py-3 text-left">Ticker</th>
                      <th className="px-4 py-3 text-left">Exchange</th>
                      <th className="px-4 py-3 text-left">Expected Date</th>
                      <th className="px-4 py-3 text-right">Price Range</th>
                      <th className="px-4 py-3 text-right">Shares (M)</th>
                      <th className="px-4 py-3 text-right">Mkt Cap (B)</th>
                      <th className="px-4 py-3 text-left">Sector</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUpcoming.map((ipo) => (
                      <tr
                        key={ipo.company}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium">{ipo.company}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground text-xs">
                          {ipo.ticker}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {ipo.exchange}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {ipo.expectedDate}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${ipo.priceRangeLow}–${ipo.priceRangeHigh}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {ipo.sharesOfferedM}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${ipo.marketCapB.toFixed(1)}B
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={sectorBadgeClass(ipo.sector)}
                          >
                            {ipo.sector}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={statusBadgeClass(ipo.status)}
                          >
                            {ipo.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredUpcoming.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-5 py-10 text-center text-sm text-muted-foreground"
                        >
                          No upcoming IPOs in this sector.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>

          {/* Recently Priced */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <Card className="overflow-hidden">
              <div className="px-5 py-4 font-semibold text-sm">
                Recently Priced
              </div>
              <Separator />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left">Company</th>
                      <th className="px-4 py-3 text-left">Ticker</th>
                      <th className="px-4 py-3 text-right">IPO Price</th>
                      <th className="px-4 py-3 text-right">Current Price</th>
                      <th className="px-4 py-3 text-right">Return</th>
                      <th className="px-4 py-3 text-left">IPO Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENTLY_PRICED.map((ipo) => {
                      const ret = returnPct(ipo);
                      return (
                        <tr
                          key={ipo.ticker}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-5 py-3 font-medium">
                            {ipo.company}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground text-xs">
                            {ipo.ticker}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {fmtUSD(ipo.ipoPrice)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {fmtUSD(ipo.currentPrice)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {ret >= 0 ? (
                                <TrendingUp
                                  size={12}
                                  className="text-primary"
                                />
                              ) : (
                                <TrendingDown
                                  size={12}
                                  className="text-bearish"
                                />
                              )}
                              <span
                                className={
                                  ret >= 0
                                    ? "text-primary font-semibold"
                                    : "text-bearish font-semibold"
                                }
                              >
                                {fmtPct(ret)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {ipo.date}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>

          {/* Lockup Expiration Calendar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4">
                <Calendar size={16} className="text-primary" />
                <span className="font-semibold text-sm">
                  Lockup Expiration Calendar
                </span>
              </div>
              <Separator />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left">Company</th>
                      <th className="px-4 py-3 text-left">Ticker</th>
                      <th className="px-4 py-3 text-left">Lockup Expiry</th>
                      <th className="px-4 py-3 text-right">
                        Shares Eligible (M)
                      </th>
                      <th className="px-4 py-3 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LOCKUP_EXPIRATIONS.map((l) => (
                      <tr
                        key={l.ticker}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium">{l.company}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground text-xs">
                          {l.ticker}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {l.expiryDate}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-bearish">
                            {l.sharesEligibleM}M
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[320px]">
                          {l.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
