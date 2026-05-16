import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign,
  CalendarDays, Percent, Wallet, ChevronDown,
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

type EntryType = "income" | "expense";
type Frequency = "monthly" | "weekly" | "biweekly" | "annual" | "one-time";

interface CashFlowEntry {
  id: string;
  user_id: string;
  name: string;
  category: string;
  type: EntryType;
  amount: number;
  frequency: Frequency;
  month_offset: number;
  notes: string | null;
  created_at: string;
}

type EntryForm = Omit<CashFlowEntry, "id" | "user_id" | "created_at">;

const INCOME_CATEGORIES = ["Salary", "Business", "Rental", "Investment", "Other"];
const EXPENSE_CATEGORIES = [
  "Housing", "Transport", "Food", "Healthcare",
  "Entertainment", "Debt", "Savings", "Other",
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DEFAULT_FORM: EntryForm = {
  name: "",
  category: "",
  type: "income",
  amount: 0,
  frequency: "monthly",
  month_offset: 0,
  notes: "",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert any frequency amount to a monthly equivalent */
function toMonthly(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case "monthly":   return amount;
    case "weekly":    return (amount * 52) / 12;
    case "biweekly":  return (amount * 26) / 12;
    case "annual":    return amount / 12;
    case "one-time":  return 0; // handled separately
    default:          return amount;
  }
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, positive, subtitle,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
  subtitle?: string;
}) {
  const color =
    positive === undefined ? "text-foreground" :
    positive ? "text-primary" : "text-red-500";

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CashFlowPlanner() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashFlowEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<EntryForm>(DEFAULT_FORM);
  const [dripOpen, setDripOpen] = useState(false);

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data: entries = [], isLoading } = useQuery<CashFlowEntry[]>({
    queryKey: ["cash_flow_entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_flow_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CashFlowEntry[];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const upsert = useMutation({
    mutationFn: async (payload: EntryForm & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase
          .from("cash_flow_entries")
          .update({ ...rest })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cash_flow_entries")
          .insert({ ...payload, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
      toast.success(editingEntry ? "Entry updated" : "Entry added");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cash_flow_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
      toast.success("Entry deleted");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Dialog helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditingEntry(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(e: CashFlowEntry) {
    setEditingEntry(e);
    setForm({
      name: e.name,
      category: e.category,
      type: e.type,
      amount: e.amount,
      frequency: e.frequency,
      month_offset: e.month_offset,
      notes: e.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingEntry(null);
    setForm(DEFAULT_FORM);
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.category)    { toast.error("Category is required"); return; }
    if (form.amount <= 0)  { toast.error("Amount must be greater than 0"); return; }
    upsert.mutate(editingEntry ? { ...form, id: editingEntry.id } : form);
  }

  // ── KPI calculations ───────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    let monthlyIncome = 0;
    let monthlyExpense = 0;

    for (const e of entries) {
      const monthly = e.frequency === "one-time" ? e.amount : toMonthly(e.amount, e.frequency);
      if (e.type === "income")   monthlyIncome += monthly;
      else                       monthlyExpense += monthly;
    }

    const net = monthlyIncome - monthlyExpense;
    const annual = net * 12;
    const savingsRate = monthlyIncome > 0 ? ((net / monthlyIncome) * 100) : 0;

    return { monthlyIncome, monthlyExpense, net, annual, savingsRate };
  }, [entries]);

  // ── 12-month projection ────────────────────────────────────────────────────

  const projection = useMemo(() => {
    const now = new Date();

    return Array.from({ length: 12 }, (_, i) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = MONTH_NAMES[monthDate.getMonth()] + " " + monthDate.getFullYear();

      let income = 0;
      let expense = 0;

      for (const e of entries) {
        let amount = 0;
        if (e.frequency === "one-time") {
          if (e.month_offset === i) amount = e.amount;
        } else {
          amount = toMonthly(e.amount, e.frequency);
        }
        if (e.type === "income")  income += amount;
        else                      expense += amount;
      }

      return { label, income, expense, net: income - expense };
    }).reduce<Array<{ label: string; income: number; expense: number; net: number; cumulative: number }>>(
      (acc, row) => {
        const prev = acc[acc.length - 1]?.cumulative ?? 0;
        acc.push({ ...row, cumulative: prev + row.net });
        return acc;
      },
      []
    );
  }, [entries]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

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
            <h1 className="text-2xl font-bold">Cash Flow Planner</h1>
            <p className="text-sm text-muted-foreground">Track income, expenses, and project your financial runway</p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> Add Entry
          </Button>
        </motion.div>

        {/* KPIs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          <KpiCard
            title="Monthly Income"
            value={fmt(kpis.monthlyIncome)}
            icon={TrendingUp}
            positive={true}
          />
          <KpiCard
            title="Monthly Expenses"
            value={fmt(kpis.monthlyExpense)}
            icon={TrendingDown}
            positive={false}
          />
          <KpiCard
            title="Net Cash Flow"
            value={fmt(kpis.net)}
            icon={DollarSign}
            positive={kpis.net >= 0}
            subtitle="Per month"
          />
          <KpiCard
            title="Annual Projection"
            value={fmt(kpis.annual)}
            icon={CalendarDays}
            positive={kpis.annual >= 0}
          />
          <KpiCard
            title="Savings Rate"
            value={`${kpis.savingsRate.toFixed(1)}%`}
            icon={Percent}
            positive={kpis.savingsRate >= 20}
          />
        </motion.div>

        {/* Entries table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Cash Flow Entries
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
              ) : entries.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-3 text-center">
                  <Wallet className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground font-medium">No entries yet</p>
                  <p className="text-sm text-muted-foreground">Add your income sources and expenses to start planning.</p>
                  <Button onClick={openAdd} variant="outline" className="mt-2 gap-2">
                    <Plus className="h-4 w-4" /> Add Your First Entry
                  </Button>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Monthly Equiv.</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{e.category}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                e.type === "income"
                                  ? "border-primary/40 text-primary bg-primary/10"
                                  : "border-red-500/40 text-red-500 bg-red-500/10"
                              }
                            >
                              {e.type === "income" ? "Income" : "Expense"}
                            </Badge>
                          </TableCell>
                          <TableCell>{fmt(e.amount)}</TableCell>
                          <TableCell className="capitalize text-sm text-muted-foreground">{e.frequency}</TableCell>
                          <TableCell className={e.type === "income" ? "text-primary font-medium" : "text-red-500 font-medium"}>
                            {e.frequency === "one-time"
                              ? "—"
                              : fmt(toMonthly(e.amount, e.frequency))}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(e)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => setDeleteId(e.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 12-Month Projection */}
        {entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> 12-Month Cash Flow Projection
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Income</TableHead>
                        <TableHead className="text-right">Expenses</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Cumulative</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projection.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell className="font-medium text-sm">{row.label}</TableCell>
                          <TableCell className="text-right text-primary text-sm">{fmt(row.income)}</TableCell>
                          <TableCell className="text-right text-red-500 text-sm">{fmt(row.expense)}</TableCell>
                          <TableCell className={`text-right font-semibold text-sm ${row.net >= 0 ? "text-primary" : "text-red-500"}`}>
                            {fmt(row.net)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold text-sm ${row.cumulative >= 0 ? "text-primary" : "text-red-500"}`}>
                            {fmt(row.cumulative)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "Add Cash Flow Entry"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type */}
            <div className="grid grid-cols-2 gap-3">
              {(["income", "expense"] as EntryType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t, category: "" }))}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    form.type === t
                      ? t === "income"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-red-500 bg-red-500/10 text-red-500"
                      : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Monthly Salary"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount + Frequency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount || ""}
                  onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as Frequency }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Month offset for one-time */}
            {form.frequency === "one-time" && (
              <div className="space-y-1.5">
                <Label>Month Offset (0 = current month)</Label>
                <Input
                  type="number"
                  min="0"
                  max="11"
                  value={form.month_offset}
                  onChange={(e) => setForm((f) => ({ ...f, month_offset: parseInt(e.target.value) || 0 }))}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                rows={2}
                placeholder="Any additional context…"
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : editingEntry ? "Save Changes" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this cash flow entry. This action cannot be undone.
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
