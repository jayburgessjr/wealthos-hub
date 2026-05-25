import { useState } from "react";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TabNav from "@/components/layout/TabNav";
import { ExpenseForm } from "@/components/household/budget/ExpenseForm";
import { CsvImportDialog } from "@/components/household/import/CsvImportDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  RefreshCw,
  CreditCard,
  Calendar,
  Repeat,
} from "lucide-react";
import { format } from "date-fns";
import { monthToLabel } from "@/lib/household-format";
import {
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useCreateBillMutation,
  useCreateSubscriptionMutation,
} from "@/hooks/useHouseholdBudgetData";
import { useDemoMode as useHouseholdDemoMode } from "@/hooks/useHouseholdDemoMode";
import { toast } from "sonner";

type ExpenseType =
  | "one-time"
  | "bill"
  | "bill-one-time"
  | "subscription"
  | "subscription-annual"
  | "annual";
type LinkMode = "none" | "existing" | "new";

export default function HouseholdBudget() {
  const {
    budget,
    getCategoryById,
    addCategory,
    addExpense,
    householdId,
    updateExpenseLocal,
    deleteExpenseLocal,
    addBillLocal,
    addSubscriptionLocal,
  } = useHouseholdBudget();
  const { demoMode } = useHouseholdDemoMode();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [autoCreateCats, setAutoCreateCats] = useState(true);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Edit expense type state
  const [editExpenseType, setEditExpenseType] =
    useState<ExpenseType>("one-time");
  const [editLinkMode, setEditLinkMode] = useState<LinkMode>("none");
  const [editSelectedBillId, setEditSelectedBillId] = useState<string>("");
  const [editSelectedSubId, setEditSelectedSubId] = useState<string>("");
  const [editNewBillName, setEditNewBillName] = useState("");
  const [editNewBillDueDate, setEditNewBillDueDate] = useState("");
  const [editBillOneTime, setEditBillOneTime] = useState(false);
  const [editNewSubName, setEditNewSubName] = useState("");
  const [editNewSubNextDate, setEditNewSubNextDate] = useState("");

  const updateExpense = useUpdateExpenseMutation();
  const deleteExpense = useDeleteExpenseMutation();
  const createBillMutation = useCreateBillMutation(householdId);
  const createSubscriptionMutation = useCreateSubscriptionMutation(householdId);

  const filteredExpenses =
    categoryFilter === "all"
      ? budget.expenses
      : budget.expenses.filter((e) => e.categoryId === categoryFilter);

  // Helper to get expense type badge info
  const getExpenseTypeBadge = (expense: (typeof budget.expenses)[0]) => {
    if (expense.linkedBillId) {
      return {
        label: "Bill",
        icon: <Repeat className="h-3 w-3" />,
        variant: "secondary" as const,
      };
    }
    if (expense.linkedSubscriptionId) {
      const sub = budget.subscriptions.find(
        (s) => s.id === expense.linkedSubscriptionId,
      );
      if (sub?.frequency === "annual") {
        return {
          label: "Annual Sub",
          icon: <Calendar className="h-3 w-3" />,
          variant: "outline" as const,
        };
      }
      return {
        label: "Subscription",
        icon: <RefreshCw className="h-3 w-3" />,
        variant: "default" as const,
      };
    }
    return null;
  };

  // Group expenses by date
  const groupedExpenses = filteredExpenses
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .reduce(
      (groups, expense) => {
        const date = expense.date;
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(expense);
        return groups;
      },
      {} as Record<string, typeof filteredExpenses>,
    );

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const openEdit = (id: string) => {
    const exp = budget.expenses.find((e) => e.id === id);
    if (!exp) return;
    setEditingId(id);
    setEditAmount(String(exp.amount));
    setEditCategoryId(exp.categoryId);
    setEditDate(exp.date);
    setEditDescription(exp.description || "");
    // Determine expense type from linked IDs
    if (exp.linkedBillId) {
      const bill = budget.bills.find((b) => b.id === exp.linkedBillId);
      setEditExpenseType(
        bill && bill.isRecurring === false ? "bill-one-time" : "bill",
      );
      setEditLinkMode("existing");
      setEditSelectedBillId(exp.linkedBillId);
      setEditBillOneTime(bill ? bill.isRecurring === false : false);
    } else if (exp.linkedSubscriptionId) {
      setEditExpenseType("subscription");
      setEditLinkMode("existing");
      setEditSelectedSubId(exp.linkedSubscriptionId);
    } else {
      setEditExpenseType("one-time");
      setEditLinkMode("none");
      setEditSelectedBillId("");
      setEditSelectedSubId("");
      setEditBillOneTime(false);
    }
    setEditNewBillName("");
    setEditNewBillDueDate(exp.date);
    setEditNewSubName("");
    setEditNewSubNextDate(exp.date);
    setEditOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || !editCategoryId) {
      toast.error("Please provide valid amount and category");
      return;
    }

    let linkedBillId: string | undefined | null = null;
    let linkedSubscriptionId: string | undefined | null = null;

    try {
      // Handle bill creation/linking
      if (editExpenseType === "bill" || editExpenseType === "bill-one-time") {
        const oneTime = editExpenseType === "bill-one-time" || editBillOneTime;
        if (editLinkMode === "existing" && editSelectedBillId) {
          linkedBillId = editSelectedBillId;
        } else if (editLinkMode === "new" && editNewBillName) {
          if (demoMode || !householdId) {
            addBillLocal({
              name: editNewBillName,
              amount: amt,
              dueDate: editNewBillDueDate || editDate,
              categoryId: editCategoryId,
              isAutoPay: false,
              paymentStatus: "unpaid",
              amountPaid: 0,
              totalBalance: amt,
              paymentAccountId: "",
              isRecurring: !oneTime,
              frequency: !oneTime ? "monthly" : undefined,
              isActive: true,
            });
            toast.success(`Bill "${editNewBillName}" created`);
          } else {
            const newBill = await createBillMutation.mutateAsync({
              name: editNewBillName,
              amount: amt,
              dueDate: editNewBillDueDate || editDate,
              categoryId: editCategoryId,
              isAutoPay: false,
              isRecurring: !oneTime,
              frequency: !oneTime ? "monthly" : undefined,
              paymentStatus: "unpaid",
              amountPaid: 0,
              totalBalance: amt,
            });
            linkedBillId = newBill.id;
            toast.success(`Bill "${editNewBillName}" created and linked`);
          }
        }
      }

      // Handle subscription creation/linking
      if (
        editExpenseType === "subscription" ||
        editExpenseType === "subscription-annual"
      ) {
        if (editLinkMode === "existing" && editSelectedSubId) {
          linkedSubscriptionId = editSelectedSubId;
        } else if (editLinkMode === "new" && editNewSubName) {
          if (demoMode || !householdId) {
            addSubscriptionLocal({
              name: editNewSubName,
              amount: amt,
              categoryId: editCategoryId,
              nextDate: editNewSubNextDate || editDate,
              confirmed: true,
              frequency:
                editExpenseType === "subscription-annual"
                  ? "annual"
                  : "monthly",
            });
            toast.success(`Subscription "${editNewSubName}" created`);
          } else {
            const newSub = await createSubscriptionMutation.mutateAsync({
              name: editNewSubName,
              amount: amt,
              nextDate: editNewSubNextDate || editDate,
              categoryId: editCategoryId,
              confirmed: true,
              frequency:
                editExpenseType === "subscription-annual"
                  ? "annual"
                  : "monthly",
            });
            linkedSubscriptionId = newSub.id;
            toast.success(
              `Subscription "${editNewSubName}" created and linked`,
            );
          }
        }
      }

      if (demoMode || !householdId) {
        updateExpenseLocal(editingId, {
          amount: amt,
          categoryId: editCategoryId,
          date: editDate,
          description: editDescription || undefined,
          linkedBillId: linkedBillId ?? undefined,
          linkedSubscriptionId: linkedSubscriptionId ?? undefined,
        });
        toast.success("Expense updated (demo)");
        setEditOpen(false);
        return;
      }

      updateExpense.mutate(
        {
          id: editingId,
          updates: {
            amount: amt,
            categoryId: editCategoryId,
            date: editDate,
            description: editDescription || undefined,
            linkedBillId,
            linkedSubscriptionId,
          },
        },
        {
          onSuccess: () => {
            toast.success("Expense updated");
            setEditOpen(false);
          },
          onError: () => toast.error("Failed to update expense"),
        },
      );
    } catch (error) {
      console.error("Failed to update expense:", error);
      toast.error("Failed to update expense");
    }
  };

  const handleDelete = (id: string) => {
    const exp = budget.expenses.find((e) => e.id === id);
    if (!exp) return;
    if (!confirm(`Delete this expense?`)) return;
    if (demoMode || !householdId) {
      deleteExpenseLocal(id);
      toast.success("Expense deleted (demo)");
    } else {
      deleteExpense.mutate(id, {
        onSuccess: () => toast.success("Expense deleted"),
        onError: () => toast.error("Failed to delete expense"),
      });
    }
  };

  return (
    <DashboardLayout>
      <TabNav group="household-money-out" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Money Out
              </span>
            </div>
            <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
              Budget & <span className="text-emerald-500">Expenses</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {budget.expenses.length} transactions for{" "}
              {monthToLabel(budget.month)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CsvImportDialog
              trigger={
                <Button variant="outline" className="font-mono shadow-sm">
                  <Upload className="w-4 h-4 mr-2" />
                  IMPORT CSV
                </Button>
              }
              title="Import Expenses from CSV"
              template={{
                filename: "expenses_template.csv",
                headers: ["date", "amount", "category", "description"],
                sampleRows: [
                  ["2025-01-15", "45.67", "Groceries", "Weekly shop"],
                ],
              }}
              fields={[
                { key: "date", label: "Date", type: "date" },
                { key: "amount", label: "Amount", type: "number" },
                { key: "category", label: "Category", optional: true },
                { key: "description", label: "Description", optional: true },
              ]}
              synonyms={{
                date: ["date", "transactiondate", "posted"],
                amount: ["amount", "total", "price"],
                category: ["category", "categoryname", "type"],
                description: ["description", "memo", "note", "details"],
              }}
              presets={[
                {
                  name: "Chase",
                  aliases: {
                    date: ["transactiondate"],
                    amount: ["amount"],
                    category: ["category"],
                    description: ["description"],
                  },
                },
                {
                  name: "Amex",
                  aliases: {
                    date: ["date"],
                    amount: ["amount"],
                    category: ["category"],
                    description: ["memo"],
                  },
                },
                {
                  name: "Capital One",
                  aliases: {
                    date: ["transactiondate", "date"],
                    amount: ["amount"],
                    category: ["category", "transactioncategory"],
                    description: ["description", "merchant", "details"],
                  },
                },
                {
                  name: "Wells Fargo",
                  aliases: {
                    date: ["date", "posteddate"],
                    amount: ["amount"],
                    category: ["category"],
                    description: ["description", "memo"],
                  },
                },
                {
                  name: "Bank of America",
                  aliases: {
                    date: ["posteddate", "date"],
                    amount: ["amount"],
                    category: ["category"],
                    description: ["description", "payee"],
                  },
                },
                {
                  name: "Apple Card",
                  aliases: {
                    date: ["transactiondate", "date"],
                    amount: ["amount", "amountusd", "amount(usd)"],
                    category: ["category"],
                    description: ["description", "merchant"],
                  },
                },
              ]}
              storageKey="import:expenses"
              onImport={async (rowsMapped) => {
                let ok = 0,
                  fail = 0;
                const errors: { row: number; reason: string }[] = [];
                const monthsWithData = new Set<string>();
                for (let i = 0; i < rowsMapped.length; i++) {
                  try {
                    const r = rowsMapped[i];
                    const date = String(r.date || "").slice(0, 10);
                    const amount = Number(r.amount);
                    const categoryName = (r.category || "").toString().trim();
                    const description =
                      (r.description || "").toString().trim() || undefined;
                    if (!date || isNaN(amount)) {
                      fail++;
                      errors.push({
                        row: i + 1,
                        reason: "Invalid date or amount",
                      });
                      continue;
                    }
                    let categoryId = "";
                    if (categoryName) {
                      const existing = budget.categories.find(
                        (c) =>
                          c.name.toLowerCase() === categoryName.toLowerCase(),
                      );
                      if (existing) categoryId = existing.id;
                      else if (autoCreateCats) {
                        addCategory({
                          name: categoryName,
                          type: "variable",
                          monthlyLimit: 0,
                          icon: "📦",
                        });
                        const newly = budget.categories.find(
                          (c) =>
                            c.name.toLowerCase() === categoryName.toLowerCase(),
                        );
                        categoryId = newly?.id || categoryId;
                      }
                    }
                    if (!categoryId && budget.categories[0])
                      categoryId = budget.categories[0].id;
                    if (!categoryId) {
                      fail++;
                      errors.push({ row: i + 1, reason: "Unknown category" });
                      continue;
                    }
                    addExpense({ amount, categoryId, date, description });
                    const monthKey = date.slice(0, 7); // YYYY-MM
                    if (monthKey) monthsWithData.add(monthKey);
                    ok++;
                  } catch {
                    fail++;
                  }
                }
                // Show notification about which months have data
                if (ok > 0 && monthsWithData.size > 0) {
                  const monthsList = Array.from(monthsWithData).sort();
                  const monthNames = monthsList.map((m) => {
                    const [year, month] = m.split("-");
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    });
                  });
                  if (monthsList.length === 1) {
                    toast.info(
                      `Imported ${ok} expenses for ${monthNames[0]}. Use the month switcher to view them.`,
                    );
                  } else {
                    toast.info(
                      `Imported ${ok} expenses across ${monthsList.length} months: ${monthNames.join(", ")}. Use the month switcher to navigate.`,
                    );
                  }
                }
                return { ok, fail, errors };
              }}
              extraControls={
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoCreateCats}
                    onChange={(e) => setAutoCreateCats(e.target.checked)}
                  />
                  Auto-create categories
                </label>
              }
            />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="font-mono shadow-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  ADD EXPENSE
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-bold">Add Expense</DialogTitle>
                </DialogHeader>
                <ExpenseForm onSuccess={() => setDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-border/20 pb-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase text-muted-foreground">
                Category
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] font-mono">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-mono">
                    All categories
                  </SelectItem>
                  {budget.categories.map((cat) => (
                    <SelectItem
                      key={cat.id}
                      value={cat.id}
                      className="font-mono"
                    >
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono uppercase text-muted-foreground">
              Total shown
            </p>
            <p className="text-2xl font-bold font-mono">
              ${totalFiltered.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Expenses list */}
        <div className="space-y-6">
          {Object.entries(groupedExpenses).map(([date, expenses]) => {
            const dateTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-1 pb-2 border-b border-border/30">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
                    {format(new Date(date), "EEEE, MMMM d")}
                  </h3>
                  <span className="text-[12px] font-mono text-muted-foreground/60">
                    ${dateTotal.toFixed(2)}
                  </span>
                </div>
                <div>
                  {expenses.map((expense) => {
                    const category = getCategoryById(expense.categoryId);
                    const typeBadge = getExpenseTypeBadge(expense);
                    return (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between px-2 py-3.5 border-b border-border/10 hover:bg-foreground/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg w-6 text-center">
                            {category?.icon || "📦"}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium">
                                {expense.description ||
                                  category?.name ||
                                  "Expense"}
                              </p>
                              {typeBadge && (
                                <Badge
                                  variant={typeBadge.variant}
                                  className="text-xs font-mono flex items-center gap-1"
                                >
                                  {typeBadge.icon}
                                  {typeBadge.label}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                              <span>{category?.name}</span>
                              {expense.userName && (
                                <>
                                  <span>·</span>
                                  <span>{expense.userName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-[13px] font-medium mr-2">
                            ${expense.amount.toFixed(2)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground/40 hover:text-foreground"
                            onClick={() => openEdit(expense.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground/40 hover:text-destructive"
                            onClick={() => handleDelete(expense.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {filteredExpenses.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border">
            <p className="text-muted-foreground mb-4">
              No expenses recorded yet.
            </p>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="font-mono"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add your first expense
            </Button>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold">Edit Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="pl-7 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Date</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase">Category</Label>
              <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {budget.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase">Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>

            {/* Expense Type Selection */}
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase">
                Expense Type
              </Label>
              <Select
                value={editExpenseType}
                onValueChange={(v) => {
                  const t = v as ExpenseType;
                  setEditExpenseType(t);
                  if (t === "bill-one-time") {
                    setEditBillOneTime(true);
                    setEditLinkMode("new");
                  } else {
                    setEditLinkMode("none");
                  }
                }}
              >
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time" className="font-mono">
                    One-time expense
                  </SelectItem>
                  <SelectItem value="bill" className="font-mono">
                    Bill
                  </SelectItem>
                  <SelectItem value="bill-one-time" className="font-mono">
                    One-time bill
                  </SelectItem>
                  <SelectItem value="subscription" className="font-mono">
                    Subscription (monthly)
                  </SelectItem>
                  <SelectItem value="subscription-annual" className="font-mono">
                    Subscription (annual)
                  </SelectItem>
                  <SelectItem value="annual" className="font-mono">
                    Annual expense
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(editExpenseType === "bill" ||
              editExpenseType === "bill-one-time") && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                <Label className="font-mono text-xs uppercase">
                  {editExpenseType === "bill-one-time"
                    ? "Link to One-time Bill"
                    : "Link to Bill"}
                </Label>
                <Select
                  value={editLinkMode}
                  onValueChange={(v) => setEditLinkMode(v as LinkMode)}
                >
                  <SelectTrigger className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="font-mono">
                      Don't link
                    </SelectItem>
                    <SelectItem value="existing" className="font-mono">
                      Link to existing bill
                    </SelectItem>
                    <SelectItem value="new" className="font-mono">
                      Create new bill
                    </SelectItem>
                  </SelectContent>
                </Select>
                {editLinkMode === "existing" && (
                  <Select
                    value={editSelectedBillId}
                    onValueChange={setEditSelectedBillId}
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue placeholder="Select bill..." />
                    </SelectTrigger>
                    <SelectContent>
                      {budget.bills
                        .filter((b) => b.isActive !== false)
                        .map((bill) => {
                          const label = `${bill.name} ($${bill.amount})${bill.isRecurring ? "" : " • one-time"}`;
                          return (
                            <SelectItem
                              key={bill.id}
                              value={bill.id}
                              className="font-mono"
                            >
                              {label}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                )}
                {editLinkMode === "new" && (
                  <div className="space-y-2">
                    <Input
                      placeholder={
                        editExpenseType === "bill-one-time" || editBillOneTime
                          ? "One-time bill (e.g., Medical)"
                          : "Bill name"
                      }
                      value={editNewBillName}
                      onChange={(e) => setEditNewBillName(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={editNewBillDueDate}
                      onChange={(e) => setEditNewBillDueDate(e.target.value)}
                    />
                    <div className="flex items-center justify-between border border-border p-2">
                      <div>
                        <p className="text-sm font-medium">One-time bill</p>
                        <p className="text-xs text-muted-foreground">
                          Do not recur next month
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={
                          editExpenseType === "bill-one-time"
                            ? true
                            : editBillOneTime
                        }
                        onChange={(e) => setEditBillOneTime(e.target.checked)}
                        disabled={editExpenseType === "bill-one-time"}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {(editExpenseType === "subscription" ||
              editExpenseType === "subscription-annual") && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                <Label className="font-mono text-xs uppercase">
                  Link to Subscription
                </Label>
                <Select
                  value={editLinkMode}
                  onValueChange={(v) => setEditLinkMode(v as LinkMode)}
                >
                  <SelectTrigger className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="font-mono">
                      Don't link
                    </SelectItem>
                    <SelectItem value="existing" className="font-mono">
                      Link to existing
                    </SelectItem>
                    <SelectItem value="new" className="font-mono">
                      Create new
                    </SelectItem>
                  </SelectContent>
                </Select>
                {editLinkMode === "existing" && (
                  <Select
                    value={editSelectedSubId}
                    onValueChange={setEditSelectedSubId}
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {budget.subscriptions.map((sub) => (
                        <SelectItem
                          key={sub.id}
                          value={sub.id}
                          className="font-mono"
                        >
                          {sub.name} (${sub.amount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {editLinkMode === "new" && (
                  <div className="space-y-2">
                    <Input
                      placeholder={
                        editExpenseType === "subscription-annual"
                          ? "Annual subscription name"
                          : "Subscription name"
                      }
                      value={editNewSubName}
                      onChange={(e) => setEditNewSubName(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={editNewSubNextDate}
                      onChange={(e) => setEditNewSubNextDate(e.target.value)}
                    />
                    {editExpenseType === "subscription-annual" && (
                      <p className="text-xs text-muted-foreground">
                        This subscription will be marked as annual billing.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

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
    </DashboardLayout>
  );
}
