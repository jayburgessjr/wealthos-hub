import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Plus,
  RefreshCw,
  Pencil,
  CheckCircle2,
  Circle,
  Filter,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/household-format";
import {
  useSubscriptionsQuery,
  budgetKeys,
} from "@/hooks/useHouseholdBudgetData";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

type FrequencyFilter = "all" | "monthly" | "annual";
type StatusFilter = "all" | "confirmed" | "unconfirmed";

export default function HouseholdSubscriptions() {
  const {
    budget,
    isLoading,
    householdId,
    addSubscription,
    updateSubscription,
    deleteSubscription,
  } = useHouseholdBudget() as any;
  const [dialogOpen, setDialogOpen] = useState(false);
  const qc = useQueryClient();
  const subsQuery = useSubscriptionsQuery(householdId);

  // Filters
  const [frequencyFilter, setFrequencyFilter] =
    useState<FrequencyFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [nextDate, setNextDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "annual">("monthly");
  const [isAutoPay, setIsAutoPay] = useState(false);

  const categoryOptions = useMemo(
    () =>
      budget.categories.map((c: any) => ({
        id: c.id,
        label: `${c.icon ?? ""} ${c.name}`,
      })),
    [budget.categories],
  );
  const accountOptions = useMemo(
    () => budget.bankAccounts.map((a: any) => ({ id: a.id, label: a.name })),
    [budget.bankAccounts],
  );

  const reset = () => {
    setName("");
    setAmount("");
    setNextDate(new Date().toISOString().slice(0, 10));
    setCategoryId("");
    setNotes("");
    setPaymentAccountId("");
    setFrequency("monthly");
    setIsAutoPay(false);
  };

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    return budget.subscriptions.filter((s: any) => {
      if (
        frequencyFilter !== "all" &&
        (s.frequency || "monthly") !== frequencyFilter
      )
        return false;
      if (statusFilter === "confirmed" && !s.confirmed) return false;
      if (statusFilter === "unconfirmed" && s.confirmed) return false;
      return true;
    });
  }, [budget.subscriptions, frequencyFilter, statusFilter]);

  const upcoming = [...filteredSubscriptions].sort(
    (a: any, b: any) =>
      new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime(),
  );

  // Calculate totals
  const monthlyTotal = budget.subscriptions
    .filter((s: any) => (s.frequency || "monthly") === "monthly")
    .reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
  const annualTotal = budget.subscriptions
    .filter((s: any) => s.frequency === "annual")
    .reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
  const annualMonthlyEquiv = annualTotal / 12;

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editConfirmed, setEditConfirmed] = useState(true);
  const [editNotes, setEditNotes] = useState("");
  const [editPaymentAccountId, setEditPaymentAccountId] = useState("");
  const [editFrequency, setEditFrequency] = useState<"monthly" | "annual">(
    "monthly",
  );
  const [editIsAutoPay, setEditIsAutoPay] = useState(false);

  const openEdit = (id: string) => {
    const s = budget.subscriptions.find((x: any) => x.id === id);
    if (!s) return;
    setEditingId(id);
    setEditName(s.name);
    setEditAmount(String(s.amount));
    setEditDate(s.nextDate);
    setEditCategoryId(s.categoryId || "");
    setEditConfirmed(!!s.confirmed);
    setEditNotes((s as any).notes || "");
    setEditPaymentAccountId((s as any).paymentAccountId || "");
    setEditFrequency(s.frequency === "annual" ? "annual" : "monthly");
    setEditIsAutoPay(!!(s as any).isAutoPay);
    setEditOpen(true);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const amt = parseFloat(editAmount);
    if (!editName || isNaN(amt)) {
      toast.error("Please provide a valid name and amount.");
      return;
    }
    updateSubscription(editingId, {
      name: editName,
      amount: amt,
      nextDate: editDate,
      categoryId: editCategoryId || "",
      confirmed: editConfirmed,
      notes: editNotes || undefined,
      paymentAccountId: editPaymentAccountId || undefined,
      frequency: editFrequency,
      isAutoPay: editIsAutoPay,
    });
    setEditOpen(false);
  };

  return (
    <DashboardLayout>
      <div
        className="space-y-6"
        role="region"
        aria-labelledby="subscriptions-title"
      >
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Money Out
              </span>
            </div>
            <h1
              id="subscriptions-title"
              className="font-display text-[28px] font-extrabold leading-none tracking-tight"
            >
              Subscriptions &{" "}
              <span className="text-emerald-500">Recurring</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track recurring subscriptions and upcoming charges.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono shadow-sm">
                <Plus className="w-4 h-4 mr-2" /> ADD SUBSCRIPTION
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-bold">
                  New Subscription
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const amt = parseFloat(amount);
                  if (!name || isNaN(amt)) {
                    toast.error("Please provide a valid name and amount.");
                    return;
                  }
                  addSubscription({
                    name,
                    amount: amt,
                    categoryId: categoryId || "",
                    nextDate,
                    confirmed: true,
                    notes: notes || undefined,
                    paymentAccountId: paymentAccountId || undefined,
                    frequency,
                    isAutoPay,
                  } as any);
                  reset();
                  setDialogOpen(false);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Netflix"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Amount
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                        $
                      </span>
                      <Input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-7 font-mono"
                        type="number"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Next Charge
                    </Label>
                    <Input
                      type="date"
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Frequency
                    </Label>
                    <Select
                      value={frequency}
                      onValueChange={(v) =>
                        setFrequency(v as "monthly" | "annual")
                      }
                    >
                      <SelectTrigger className="font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Category
                    </Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="font-mono">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Payment Account
                    </Label>
                    <Select
                      value={paymentAccountId}
                      onValueChange={setPaymentAccountId}
                    >
                      <SelectTrigger className="font-mono">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountOptions.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Notes</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="sub-autopay"
                    type="checkbox"
                    checked={isAutoPay}
                    onChange={(e) => setIsAutoPay(e.target.checked)}
                  />
                  <Label
                    htmlFor="sub-autopay"
                    className="font-mono text-xs uppercase flex items-center gap-1"
                  >
                    <Zap className="h-3 w-3" /> Auto-Pay
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="font-mono">
                    Create
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="font-mono"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {householdId &&
          subsQuery.data &&
          subsQuery.data.available === false && (
            <Alert className="border-2 border-border">
              <AlertTitle className="font-mono">Local-only mode</AlertTitle>
              <AlertDescription className="text-sm">
                Subscriptions persistence isn't enabled yet. Your data is
                currently stored locally only.
              </AlertDescription>
            </Alert>
          )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          {isLoading ? (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-2">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-3 w-24 mb-2" />
                    <Skeleton className="h-6 w-28" />
                  </CardHeader>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card className="border-2">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">
                    Monthly Total
                  </CardDescription>
                  <CardTitle className="text-xl md:text-2xl font-mono">
                    {formatCurrency(monthlyTotal, { minimumFractionDigits: 2 })}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-2">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">
                    Annual Total
                  </CardDescription>
                  <CardTitle className="text-xl md:text-2xl font-mono">
                    {formatCurrency(annualTotal, { minimumFractionDigits: 2 })}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    ≈{" "}
                    {formatCurrency(annualMonthlyEquiv, {
                      minimumFractionDigits: 2,
                    })}
                    /mo
                  </p>
                </CardHeader>
              </Card>
              <Card className="border-2">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">
                    Active Subscriptions
                  </CardDescription>
                  <CardTitle className="text-xl md:text-2xl font-mono">
                    {budget.subscriptions.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-2">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">
                    Next Charge
                  </CardDescription>
                  <CardTitle className="text-xl md:text-2xl font-mono">
                    {upcoming[0]
                      ? new Date(upcoming[0].nextDate).toLocaleDateString()
                      : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center p-4 border-2 border-border bg-card">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-mono uppercase text-muted-foreground">
              Filters:
            </span>
          </div>
          <Select
            value={frequencyFilter}
            onValueChange={(v) => setFrequencyFilter(v as FrequencyFilter)}
          >
            <SelectTrigger className="w-[140px] font-mono">
              <SelectValue placeholder="Frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[140px] font-mono">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="unconfirmed">Unconfirmed</SelectItem>
            </SelectContent>
          </Select>
          {(frequencyFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs"
              onClick={() => {
                setFrequencyFilter("all");
                setStatusFilter("all");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <CardTitle className="text-lg">
                  {frequencyFilter === "all"
                    ? "All Subscriptions"
                    : frequencyFilter === "monthly"
                      ? "Monthly Subscriptions"
                      : "Annual Subscriptions"}
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => {
                  if (householdId) {
                    qc.invalidateQueries({
                      queryKey: budgetKeys.subscriptions(householdId),
                    });
                    toast.success("Synced");
                  }
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync
              </Button>
            </div>
            <CardDescription>
              Showing {filteredSubscriptions.length} of{" "}
              {budget.subscriptions.length} subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 border-2 border-border bg-card"
                  >
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-7 w-24" />
                  </div>
                ))}
              </div>
            ) : filteredSubscriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {budget.subscriptions.length === 0
                  ? "No subscriptions yet"
                  : "No subscriptions match the current filters"}
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 border-2 border-border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        aria-label="Edit subscription"
                        className="p-1 border-2 border-border hover:bg-secondary"
                        onClick={() => openEdit(s.id)}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {s.confirmed ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground" />
                          )}
                          {s.name}
                          <Badge
                            variant={
                              (s.frequency || "monthly") === "annual"
                                ? "outline"
                                : "secondary"
                            }
                            className="text-xs font-mono"
                          >
                            {(s.frequency || "monthly") === "annual"
                              ? "Annual"
                              : "Monthly"}
                          </Badge>
                          {s.isAutoPay && (
                            <Badge
                              variant="outline"
                              className="text-xs font-mono gap-1"
                            >
                              <Zap className="h-3 w-3" /> Auto-Pay
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.nextDate).toLocaleDateString()} •{" "}
                          {formatCurrency(Number(s.amount), {
                            minimumFractionDigits: 2,
                          })}
                          {s.frequency === "annual" && (
                            <span className="ml-1">
                              (≈{" "}
                              {formatCurrency(Number(s.amount) / 12, {
                                minimumFractionDigits: 2,
                              })}
                              /mo)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs"
                        onClick={() => {
                          const months = s.frequency === "annual" ? 12 : 1;
                          updateSubscription(s.id, {
                            nextDate: new Date(
                              new Date(s.nextDate).setMonth(
                                new Date(s.nextDate).getMonth() + months,
                              ),
                            )
                              .toISOString()
                              .slice(0, 10),
                          });
                        }}
                      >
                        Skip
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs"
                        onClick={() =>
                          updateSubscription(s.id, { confirmed: !s.confirmed })
                        }
                      >
                        {s.confirmed ? "Unconfirm" : "Confirm"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="font-mono text-xs"
                        onClick={() => deleteSubscription(s.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-bold">Edit Subscription</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                      $
                    </span>
                    <Input
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="pl-7 font-mono"
                      type="number"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Next Charge
                  </Label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Frequency
                  </Label>
                  <Select
                    value={editFrequency}
                    onValueChange={(v) =>
                      setEditFrequency(v as "monthly" | "annual")
                    }
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Category
                  </Label>
                  <Select
                    value={editCategoryId}
                    onValueChange={setEditCategoryId}
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Payment Account
                  </Label>
                  <Select
                    value={editPaymentAccountId}
                    onValueChange={setEditPaymentAccountId}
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Notes</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="sub-confirmed"
                    type="checkbox"
                    checked={editConfirmed}
                    onChange={(e) => setEditConfirmed(e.target.checked)}
                  />
                  <Label
                    htmlFor="sub-confirmed"
                    className="font-mono text-xs uppercase"
                  >
                    Confirmed
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="edit-sub-autopay"
                    type="checkbox"
                    checked={editIsAutoPay}
                    onChange={(e) => setEditIsAutoPay(e.target.checked)}
                  />
                  <Label
                    htmlFor="edit-sub-autopay"
                    className="font-mono text-xs uppercase flex items-center gap-1"
                  >
                    <Zap className="h-3 w-3" /> Auto-Pay
                  </Label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="font-mono">
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="font-mono"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
