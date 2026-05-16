import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, TrendingUp, DollarSign,
  CalendarDays, BarChart2, RefreshCw, Layers,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ────────────────────────────────────────────────────────────────────

type DivFrequency = "monthly" | "quarterly" | "semi-annual" | "annual";

interface DividendHolding {
  id: string;
  user_id: string;
  ticker: string;
  company_name: string;
  shares: number;
  cost_basis: number;
  current_price: number;
  annual_dividend_per_share: number;
  ex_dividend_date: string | null;
  payment_date: string | null;
  frequency: DivFrequency;
  notes: string | null;
  created_at: string;
}

type HoldingForm = Omit<DividendHolding, "id" | "user_id" | "created_at">;

const DEFAULT_FORM: HoldingForm = {
  ticker: "",
  company_name: "",
  shares: 0,
  cost_basis: 0,
  current_price: 0,
  annual_dividend_per_share: 0,
  ex_dividend_date: "",
  payment_date: "",
  frequency: "quarterly",
  notes: "",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtShort(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Returns which calendar months (0-indexed) a holding pays in, given its payment_date */
function paymentMonths(holding: DividendHolding): number[] {
  if (!holding.payment_date) return [];
  const baseMonth = new Date(holding.payment_date + "T00:00:00").getMonth();

  switch (holding.frequency) {
    case "monthly":
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case "quarterly": {
      const months: number[] = [];
      for (let i = 0; i < 4; i++) months.push((baseMonth + i * 3) % 12);
      return months;
    }
    case "semi-annual":
      return [baseMonth % 12, (baseMonth + 6) % 12];
    case "annual":
      return [baseMonth % 12];
    default:
      return [];
  }
}

/** Per-payment amount for a holding */
function paymentAmount(holding: DividendHolding): number {
  const annual = holding.annual_dividend_per_share * holding.shares;
  switch (holding.frequency) {
    case "monthly":     return annual / 12;
    case "quarterly":   return annual / 4;
    case "semi-annual": return annual / 2;
    case "annual":      return annual;
    default:            return 0;
  }
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, subtitle,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-md bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── DRIP Calculator ───────────────────────────────────────────────────────────

function DripCalculator() {
  const [shares, setShares] = useState(100);
  const [divPerShare, setDivPerShare] = useState(2.5);
  const [freq, setFreq] = useState<DivFrequency>("quarterly");
  const [price, setPrice] = useState(50);
  const [years, setYears] = useState(10);

  const result = useMemo(() => {
    const paymentsPerYear =
      freq === "monthly" ? 12 : freq === "quarterly" ? 4 : freq === "semi-annual" ? 2 : 1;
    const divPerPayment = divPerShare / paymentsPerYear;
    const totalPayments = years * paymentsPerYear;

    let currentShares = shares;
    for (let i = 0; i < totalPayments; i++) {
      const divReceived = currentShares * divPerPayment;
      const newShares = price > 0 ? divReceived / price : 0;
      currentShares += newShares;
    }

    return {
      finalShares: currentShares,
      finalValue: currentShares * price,
      sharesGained: currentShares - shares,
      dividendCapital: (currentShares - shares) * price,
    };
  }, [shares, divPerShare, freq, price, years]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> DRIP Calculator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="space-y-1.5">
            <Label className="text-xs">Shares</Label>
            <Input
              type="number"
              min="1"
              value={shares}
              onChange={(e) => setShares(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Annual Div / Share ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={divPerShare}
              onChange={(e) => setDivPerShare(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frequency</Label>
            <Select value={freq} onValueChange={(v) => setFreq(v as DivFrequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Stock Price ($)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Years</Label>
            <Input
              type="number"
              min="1"
              max="50"
              value={years}
              onChange={(e) => setYears(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Final Shares", value: result.finalShares.toFixed(2) },
            { label: "Final Portfolio Value", value: fmt(result.finalValue) },
            { label: "Shares Gained via DRIP", value: result.sharesGained.toFixed(2) },
            { label: "Dividend Capital Compounded", value: fmt(result.dividendCapital) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-muted p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-lg font-bold text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DividendTracker() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<DividendHolding | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<HoldingForm>(DEFAULT_FORM);

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data: holdings = [], isLoading } = useQuery<DividendHolding[]>({
    queryKey: ["dividend_holdings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dividend_holdings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DividendHolding[];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const upsert = useMutation({
    mutationFn: async (payload: HoldingForm & { id?: string }) => {
      const clean = {
        ...payload,
        ex_dividend_date: payload.ex_dividend_date || null,
        payment_date: payload.payment_date || null,
        notes: payload.notes || null,
      };
      if (payload.id) {
        const { id, ...rest } = clean as typeof clean & { id: string };
        const { error } = await supabase.from("dividend_holdings").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("dividend_holdings")
          .insert({ ...clean, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividend_holdings"] });
      toast.success(editingHolding ? "Holding updated" : "Holding added");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dividend_holdings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividend_holdings"] });
      toast.success("Holding deleted");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Dialog helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditingHolding(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(h: DividendHolding) {
    setEditingHolding(h);
    setForm({
      ticker: h.ticker,
      company_name: h.company_name,
      shares: h.shares,
      cost_basis: h.cost_basis,
      current_price: h.current_price,
      annual_dividend_per_share: h.annual_dividend_per_share,
      ex_dividend_date: h.ex_dividend_date ?? "",
      payment_date: h.payment_date ?? "",
      frequency: h.frequency,
      notes: h.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingHolding(null);
    setForm(DEFAULT_FORM);
  }

  function handleSubmit() {
    if (!form.ticker.trim())       { toast.error("Ticker is required"); return; }
    if (!form.company_name.trim()) { toast.error("Company name is required"); return; }
    if (form.shares <= 0)          { toast.error("Shares must be greater than 0"); return; }
    if (form.current_price <= 0)   { toast.error("Current price must be greater than 0"); return; }
    upsert.mutate(editingHolding ? { ...form, id: editingHolding.id } : form);
  }

  // ── KPI calculations ───────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    let annualIncome = 0;
    let totalValue = 0;

    for (const h of holdings) {
      annualIncome += h.annual_dividend_per_share * h.shares;
      totalValue += h.current_price * h.shares;
    }

    const portfolioYield = totalValue > 0 ? (annualIncome / totalValue) * 100 : 0;

    return {
      annualIncome,
      monthlyAvg: annualIncome / 12,
      portfolioYield,
      totalValue,
    };
  }, [holdings]);

  // ── Calendar grid ──────────────────────────────────────────────────────────

  const calendarData = useMemo(() => {
    const map: Record<number, Array<{ ticker: string; amount: number }>> = {};
    for (let i = 0; i < 12; i++) map[i] = [];

    for (const h of holdings) {
      const months = paymentMonths(h);
      const amount = paymentAmount(h);
      for (const m of months) {
        map[m].push({ ticker: h.ticker, amount });
      }
    }

    return map;
  }, [holdings]);

  const freqColor: Record<DivFrequency, string> = {
    monthly:        "border-primary/40 text-primary bg-primary/10",
    quarterly:      "border-blue-400/40 text-blue-400 bg-blue-400/10",
    "semi-annual":  "border-purple-400/40 text-purple-400 bg-purple-400/10",
    annual:         "border-yellow-400/40 text-yellow-400 bg-yellow-400/10",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold">Dividend Tracker</h1>
            <p className="text-sm text-muted-foreground">Monitor dividend income, yield, and reinvestment growth</p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> Add Holding
          </Button>
        </motion.div>

        {/* KPIs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <KpiCard
            title="Annual Dividend Income"
            value={fmt(kpis.annualIncome)}
            icon={DollarSign}
            subtitle="Across all holdings"
          />
          <KpiCard
            title="Monthly Average"
            value={fmt(kpis.monthlyAvg)}
            icon={CalendarDays}
          />
          <KpiCard
            title="Portfolio Yield"
            value={`${kpis.portfolioYield.toFixed(2)}%`}
            icon={TrendingUp}
          />
          <KpiCard
            title="Holdings Value"
            value={fmtShort(kpis.totalValue)}
            icon={Layers}
            subtitle={`${holdings.length} position${holdings.length !== 1 ? "s" : ""}`}
          />
        </motion.div>

        {/* Holdings table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4" /> Dividend Holdings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
              ) : holdings.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-3 text-center">
                  <BarChart2 className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground font-medium">No holdings yet</p>
                  <p className="text-sm text-muted-foreground">
                    Add your dividend-paying stocks to track income and yield.
                  </p>
                  <Button onClick={openAdd} variant="outline" className="mt-2 gap-2">
                    <Plus className="h-4 w-4" /> Add Your First Holding
                  </Button>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticker</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Ann. Div/Sh</TableHead>
                        <TableHead className="text-right">Yield %</TableHead>
                        <TableHead className="text-right">Annual Income</TableHead>
                        <TableHead>Next Payment</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdings.map((h) => {
                        const yieldPct =
                          h.current_price > 0
                            ? (h.annual_dividend_per_share / h.current_price) * 100
                            : 0;
                        const annualIncome = h.annual_dividend_per_share * h.shares;
                        return (
                          <TableRow key={h.id}>
                            <TableCell className="font-bold text-primary">{h.ticker}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                              {h.company_name}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {h.shares.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-sm">{fmt(h.current_price)}</TableCell>
                            <TableCell className="text-right text-sm">
                              {fmt(h.annual_dividend_per_share)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-primary font-medium">
                              {yieldPct.toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold text-primary">
                              {fmt(annualIncome)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {h.payment_date
                                ? new Date(h.payment_date + "T00:00:00").toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${freqColor[h.frequency]}`}
                              >
                                {h.frequency}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(h)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-500 hover:text-red-600"
                                  onClick={() => setDeleteId(h.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Dividend Income Calendar */}
        {holdings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> Dividend Income Calendar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {MONTH_NAMES.map((month, idx) => {
                    const payments = calendarData[idx] ?? [];
                    const total = payments.reduce((s, p) => s + p.amount, 0);
                    return (
                      <div
                        key={month}
                        className="rounded-lg border border-border bg-muted/30 p-3 min-h-[110px]"
                      >
                        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                          {MONTH_SHORT[idx]}
                        </p>
                        {payments.length === 0 ? (
                          <p className="text-xs text-muted-foreground/50 italic">No payments</p>
                        ) : (
                          <div className="space-y-1">
                            {payments.map((p, i) => (
                              <div key={i} className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-primary">{p.ticker}</span>
                                <span className="text-xs text-muted-foreground">{fmt(p.amount)}</span>
                              </div>
                            ))}
                            <div className="pt-1 mt-1 border-t border-border">
                              <p className="text-xs font-semibold text-foreground text-right">{fmt(total)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* DRIP Calculator — always visible */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DripCalculator />
        </motion.div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingHolding ? "Edit Holding" : "Add Dividend Holding"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Ticker + Company */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ticker</Label>
                <Input
                  placeholder="e.g. SCHD"
                  value={form.ticker}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input
                  placeholder="e.g. Schwab US Dividend Equity ETF"
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                />
              </div>
            </div>

            {/* Shares + Cost Basis */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Shares</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="100"
                  value={form.shares || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shares: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cost Basis ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.cost_basis || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cost_basis: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            {/* Current Price + Annual Div/Share */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Current Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.current_price || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, current_price: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Annual Div / Share ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0.00"
                  value={form.annual_dividend_per_share || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      annual_dividend_per_share: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <Label>Payment Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as DivFrequency }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ex-Dividend Date</Label>
                <Input
                  type="date"
                  value={form.ex_dividend_date ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ex_dividend_date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={form.payment_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                rows={2}
                placeholder="Strategy notes, DRIP enrollment, etc."
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : editingHolding ? "Save Changes" : "Add Holding"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holding</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this dividend holding. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && remove.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
