import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronDown, ChevronUp, Scissors } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPositions, sandboxTransactions } from "@/data/sandboxData";

// ─── Demo-mode loss positions (augments sandboxPositions) ───────────────────

const demoLossPositions = [
  {
    id: "demo-loss-1",
    ticker: "TSLA",
    company_name: "Tesla, Inc.",
    pnl_dollars: -480,
    pnl_percent: -2.6,
    entry_date: "2024-02-15",
    value: 17540,
    status: "open",
  },
  {
    id: "demo-loss-2",
    ticker: "AMZN",
    company_name: "Amazon.com, Inc.",
    pnl_dollars: -1200,
    pnl_percent: -8.4,
    entry_date: "2025-11-10",
    value: 13100,
    status: "open",
  },
  {
    id: "demo-loss-3",
    ticker: "SOFI",
    company_name: "SoFi Technologies",
    pnl_dollars: -340,
    pnl_percent: -15.2,
    entry_date: "2026-01-20",
    value: 1890,
    status: "open",
  },
];

const TAX_RATE_SHORT = 0.37;
const TAX_RATE_LONG = 0.2;
const NET_INVESTMENT_TAX = 0.038; // NIIT
const COMBINED_LTCG_RATE = TAX_RATE_LONG + NET_INVESTMENT_TAX; // 23.8%

// ─── Disclaimer Banner ───────────────────────────────────────────────────────

function DisclaimerBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-xs font-semibold text-amber-400">
          Educational Tool Only — Not Tax Advice
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-amber-500/70" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-amber-500/70" />
        )}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-amber-500/20 pt-3 text-xs text-amber-200/70 leading-relaxed">
          <p>
            <strong className="text-amber-300">Tax Analysis Only.</strong> This
            tool provides educational tax analysis only. Consult a licensed CPA
            or tax professional before executing any tax strategy. Tax laws are
            complex and vary by individual situation, jurisdiction, and year.
          </p>
          <p>
            <strong className="text-amber-300">Wash Sale Rule.</strong>{" "}
            Harvesting a loss and repurchasing the same or substantially
            identical security within 30 days before or after the sale triggers
            the IRS wash sale rule, disallowing the loss. Always consult a
            professional before acting.
          </p>
          <p>
            <strong className="text-amber-300">Estimates Are Illustrative.</strong>{" "}
            Tax savings figures shown are rough estimates based on simplified
            federal rates (20% LTCG + 3.8% NIIT, or 37% STCG). Actual tax
            impact depends on your filing status, AMT exposure, state taxes, and
            other factors.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <Card className="border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-mono text-xl font-bold ${color ?? "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TaxHarvesting() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const [harvestInput, setHarvestInput] = useState("");
  const [bracketRate, setBracketRate] = useState("0.37");

  const today = new Date();

  // ── Positions query ──────────────────────────────────────────────────────
  const { data: positions = [], isLoading: positionsLoading } = useQuery({
    queryKey: ["positions", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return demoLossPositions;
      const { data } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "open");
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  // ── Transactions query ───────────────────────────────────────────────────
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxTransactions;
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("executed_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  const isLoading = positionsLoading || txLoading;

  // ── Derived: tax year summary ────────────────────────────────────────────
  const realizedGains = transactions.reduce(
    (acc, t) => acc + Math.max(0, t.pnl_realized ?? 0),
    0
  );
  const realizedLosses = transactions.reduce(
    (acc, t) => acc + Math.min(0, t.pnl_realized ?? 0),
    0
  );
  const netPnl = realizedGains + realizedLosses;
  const estTaxLiability = netPnl > 0 ? netPnl * COMBINED_LTCG_RATE : 0;

  // Harvesting opportunities: open positions with negative pnl
  const lossPositions = positions
    .filter((p) => (p.pnl_dollars ?? 0) < 0)
    .sort((a, b) => (a.pnl_dollars ?? 0) - (b.pnl_dollars ?? 0));

  const totalUnrealizedLoss = lossPositions.reduce(
    (acc, p) => acc + (p.pnl_dollars ?? 0),
    0
  );

  // Potential savings if all losses harvested (using applicable rate)
  const taxSavedIfHarvested = lossPositions.reduce((acc, p) => {
    const days = differenceInDays(today, parseISO(p.entry_date));
    const rate = days >= 365 ? TAX_RATE_LONG : TAX_RATE_SHORT;
    return acc + Math.abs(p.pnl_dollars ?? 0) * rate;
  }, 0);

  // Already harvested: closed transactions with negative pnl_realized
  const harvestedTransactions = transactions.filter(
    (t) => (t.pnl_realized ?? 0) < 0
  );
  const totalHarvested = harvestedTransactions.reduce(
    (acc, t) => acc + (t.pnl_realized ?? 0),
    0
  );

  // ── Calculator ───────────────────────────────────────────────────────────
  const additionalHarvestAmount = parseFloat(harvestInput) || 0;
  const additionalTaxSaving = additionalHarvestAmount * parseFloat(bracketRate);

  // ── Helper: days held label ──────────────────────────────────────────────
  function getDaysHeld(entryDate: string) {
    return differenceInDays(today, parseISO(entryDate));
  }

  function getTaxCategory(daysHeld: number) {
    return daysHeld >= 365 ? "LONG-TERM" : "SHORT-TERM";
  }

  function getApplicableRate(daysHeld: number) {
    return daysHeld >= 365 ? TAX_RATE_LONG : TAX_RATE_SHORT;
  }

  // Wash sale flag: position opened within the last 30 days
  function isWashSaleRisk(entryDate: string) {
    return differenceInDays(today, parseISO(entryDate)) <= 30;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Scissors className="h-6 w-6 text-primary" />
          <h2 className="font-display text-2xl font-bold text-foreground">
            Tax Loss Harvesting
          </h2>
        </div>

        {/* Disclaimer */}
        <DisclaimerBanner />

        {/* Tax Year Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <StatCard
            label="Realized Gains"
            value={`$${realizedGains.toLocaleString()}`}
            color="text-bullish"
          />
          <StatCard
            label="Realized Losses"
            value={`$${Math.abs(realizedLosses).toLocaleString()}`}
            color="text-bearish"
          />
          <StatCard
            label="Net P&L"
            value={`${netPnl >= 0 ? "+" : "-"}$${Math.abs(netPnl).toLocaleString()}`}
            color={netPnl >= 0 ? "text-bullish" : "text-bearish"}
          />
          <StatCard
            label="Est. Tax Liability"
            value={`$${estTaxLiability.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub="23.8% blended LTCG+NIIT (est.)"
            color="text-foreground"
          />
          <StatCard
            label="Tax Saved If Harvested"
            value={`$${taxSavedIfHarvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub="Potential savings from open losses"
            color="text-primary"
          />
        </motion.div>

        {/* Harvesting Opportunities */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <Card className="border-border bg-card">
            <div className="p-6">
              <h3 className="mb-1 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Harvesting Opportunities
              </h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Open positions currently sitting at an unrealized loss.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Ticker</TableHead>
                      <TableHead className="text-right text-muted-foreground">Unrealized Loss</TableHead>
                      <TableHead className="text-right text-muted-foreground">Loss %</TableHead>
                      <TableHead className="text-right text-muted-foreground">Days Held</TableHead>
                      <TableHead className="text-muted-foreground">Tax Category</TableHead>
                      <TableHead className="text-right text-muted-foreground">Est. Tax Saving</TableHead>
                      <TableHead className="text-muted-foreground">Wash Sale?</TableHead>
                      <TableHead className="text-muted-foreground">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i} className="border-border">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : lossPositions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No open positions with unrealized losses — great news!
                        </TableCell>
                      </TableRow>
                    ) : (
                      lossPositions.map((p) => {
                        const daysHeld = getDaysHeld(p.entry_date);
                        const category = getTaxCategory(daysHeld);
                        const rate = getApplicableRate(daysHeld);
                        const estSaving = Math.abs(p.pnl_dollars ?? 0) * rate;
                        const washRisk = isWashSaleRisk(p.entry_date);

                        return (
                          <TableRow
                            key={p.id}
                            className="border-border hover:bg-accent/30 transition-fast"
                          >
                            <TableCell className="font-mono font-bold text-foreground">
                              {p.ticker}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-bearish font-semibold">
                              -${Math.abs(p.pnl_dollars ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-bearish">
                              {(p.pnl_percent ?? 0).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-muted-foreground">
                              {daysHeld}d
                            </TableCell>
                            <TableCell>
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                                  category === "SHORT-TERM"
                                    ? "bg-orange-500/15 text-orange-400"
                                    : "bg-primary/15 text-primary"
                                }`}
                              >
                                {category}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-bullish font-semibold">
                              +${estSaving.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-center">
                              {washRisk ? (
                                <span title="Opened within 30 days — wash sale risk">
                                  ⚠️
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-bearish/40 px-3 text-[10px] font-bold uppercase tracking-wider text-bearish hover:bg-bearish/10"
                                onClick={() =>
                                  toast.warning(
                                    "Consult your advisor before executing",
                                    {
                                      description: `Review ${p.ticker} harvest with a licensed CPA to confirm timing and wash sale rules.`,
                                    }
                                  )
                                }
                              >
                                Harvest
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Already Harvested This Year */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
        >
          <Card className="border-border bg-card">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Already Harvested This Year
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Closed positions that realized a loss
                  </p>
                </div>
                {harvestedTransactions.length > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Harvested
                    </p>
                    <p className="font-mono text-lg font-bold text-bearish">
                      -${Math.abs(totalHarvested).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Ticker</TableHead>
                      <TableHead className="text-right text-muted-foreground">Loss Realized</TableHead>
                      <TableHead className="text-muted-foreground">Date Closed</TableHead>
                      <TableHead className="text-right text-muted-foreground">Running Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <TableRow key={i} className="border-border">
                          {Array.from({ length: 4 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : harvestedTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-16 text-center text-muted-foreground"
                        >
                          No harvested losses recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      (() => {
                        let runningTotal = 0;
                        return harvestedTransactions.map((t) => {
                          runningTotal += t.pnl_realized ?? 0;
                          return (
                            <TableRow
                              key={t.id}
                              className="border-border hover:bg-accent/30 transition-fast"
                            >
                              <TableCell className="font-mono font-bold text-foreground">
                                {t.ticker}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-bearish font-semibold">
                                -${Math.abs(t.pnl_realized ?? 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {format(new Date(t.executed_at!), "yyyy-MM-dd")}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-bearish">
                                -${Math.abs(runningTotal).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Harvest Impact Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.24 }}
        >
          <Card className="border-border bg-card">
            <div className="p-6">
              <h3 className="mb-1 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Harvest Impact Calculator
              </h3>
              <p className="mb-6 text-xs text-muted-foreground">
                Estimate the tax benefit of harvesting an additional loss amount.
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {/* Input: additional harvest amount */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Additional Harvest Amount ($)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g. 5000"
                    value={harvestInput}
                    onChange={(e) => setHarvestInput(e.target.value)}
                    className="border-border bg-background font-mono"
                  />
                </div>

                {/* Input: marginal tax bracket */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Marginal Rate
                  </Label>
                  <Select value={bracketRate} onValueChange={setBracketRate}>
                    <SelectTrigger className="border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.22">22%</SelectItem>
                      <SelectItem value="0.24">24%</SelectItem>
                      <SelectItem value="0.32">32%</SelectItem>
                      <SelectItem value="0.37">37%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Output: estimated additional tax saving */}
                <div className="flex flex-col justify-end">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Estimated Additional Tax Saving
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-primary">
                    {additionalHarvestAmount > 0
                      ? `$${additionalTaxSaving.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : "—"}
                  </p>
                  {additionalHarvestAmount > 0 && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      ${additionalHarvestAmount.toLocaleString()} × {(parseFloat(bracketRate) * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
