import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  DollarSign,
  CreditCard,
  Upload,
  Filter,
  RefreshCw,
  Archive,
  Landmark,
  Percent,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { DemoBanner } from "@/components/household/layout/DemoBanner";
import { useDemoMode } from "@/hooks/useHouseholdDemoMode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateBillMutation,
  useUpdateBillMutation,
  useDeleteBillMutation,
  useCreateCategoryMutation,
  useBillsQuery,
  useDebtsQuery,
  budgetKeys,
} from "@/hooks/useHouseholdBudgetData";
import { CsvImportDialog } from "@/components/household/import/CsvImportDialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AdvancedDebtDetails,
  type AdvancedDebtValues,
  calculateDebtMetrics,
} from "@/components/household/bills/AdvancedDebtDetails";

type StatusFilter = "all" | "unpaid" | "partial" | "paid";
type FrequencyFilter =
  | "all"
  | "monthly"
  | "weekly"
  | "yearly"
  | "biweekly"
  | "one-time";
type ActiveFilter = "all" | "active" | "inactive";

export function BillPayments() {
  const {
    budget,
    householdId,
    addBillLocal,
    updateBillLocal,
    deleteBillLocal,
    addCategory,
    addExpense,
    repairBillExpenses,
  } = useHouseholdBudget();
  const { demoMode } = useDemoMode();
  const qc = useQueryClient();

  const billsQuery = useBillsQuery(householdId);
  const debtsQuery = useDebtsQuery(householdId);
  const debts = debtsQuery.data?.debts ?? [];

  const billToDebtMap = useMemo(() => {
    const map = new Map<
      string,
      { name: string; currentBalance: number; totalBalance: number }
    >();
    debts.forEach((debt) => {
      if (debt.payment_bill_id) {
        map.set(debt.payment_bill_id, {
          name: debt.name,
          currentBalance: debt.current_balance,
          totalBalance: debt.total_balance,
        });
      }
    });
    return map;
  }, [debts]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [autoCreateCats, setAutoCreateCats] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [frequencyFilter, setFrequencyFilter] =
    useState<FrequencyFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");

  const createBill = useCreateBillMutation(householdId);
  const updateBill = useUpdateBillMutation(householdId);
  const deleteBill = useDeleteBillMutation(householdId);
  const createCategory = useCreateCategoryMutation(householdId, budget.month);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [totalBalance, setTotalBalance] = useState("");
  const [dueDate, setDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [categoryId, setCategoryId] = useState("");
  const [isAutoPay, setIsAutoPay] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [frequency, setFrequency] = useState<
    "monthly" | "weekly" | "yearly" | "biweekly"
  >("monthly");
  const [isRecurring, setIsRecurring] = useState(true);
  const [advancedDebt, setAdvancedDebt] = useState<AdvancedDebtValues>({});

  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editTotalBalance, setEditTotalBalance] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editIsAutoPay, setEditIsAutoPay] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editPaymentAccountId, setEditPaymentAccountId] = useState("");
  const [editFrequency, setEditFrequency] = useState<
    "monthly" | "weekly" | "yearly" | "biweekly"
  >("monthly");
  const [editIsRecurring, setEditIsRecurring] = useState(true);
  const [editAdvancedDebt, setEditAdvancedDebt] = useState<AdvancedDebtValues>(
    {},
  );

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payBillId, setPayBillId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const filteredBills = useMemo(() => {
    return budget.bills.filter((bill) => {
      if (statusFilter !== "all" && bill.paymentStatus !== statusFilter)
        return false;
      if (frequencyFilter !== "all") {
        if (frequencyFilter === "one-time" && bill.isRecurring) return false;
        if (
          frequencyFilter !== "one-time" &&
          (!bill.isRecurring || bill.frequency !== frequencyFilter)
        )
          return false;
      }
      if (activeFilter === "active" && bill.isActive === false) return false;
      if (activeFilter === "inactive" && bill.isActive !== false) return false;
      return true;
    });
  }, [budget.bills, statusFilter, frequencyFilter, activeFilter]);

  const totalMonthlyBills = budget.bills
    .filter(
      (bill) =>
        bill.dueDate.startsWith(budget.month) && bill.isActive !== false,
    )
    .reduce((sum, bill) => sum + bill.amount, 0);

  const upcomingBills = budget.bills.filter((bill) => {
    const billDueDate = new Date(bill.dueDate);
    const today = new Date();
    const daysUntil = Math.ceil(
      (billDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return (
      daysUntil >= 0 &&
      daysUntil <= 7 &&
      bill.paymentStatus !== "paid" &&
      bill.isActive !== false
    );
  });

  const overdueBills = budget.bills.filter((bill) => {
    const billDueDate = new Date(bill.dueDate);
    const today = new Date();
    return (
      billDueDate < today &&
      bill.paymentStatus !== "paid" &&
      bill.isActive !== false
    );
  });

  const categoryOptions = useMemo(
    () =>
      budget.categories.map((c) => ({
        id: c.id,
        label: `${c.icon ?? ""} ${c.name}`,
      })),
    [budget.categories],
  );
  const accountOptions = useMemo(
    () => budget.bankAccounts.map((a) => ({ id: a.id, label: a.name })),
    [budget.bankAccounts],
  );

  const resetAddForm = () => {
    setName("");
    setAmount("");
    setTotalBalance("");
    setDueDate(new Date().toISOString().slice(0, 10));
    setCategoryId("");
    setIsAutoPay(false);
    setNotes("");
    setPaymentAccountId("");
    setFrequency("monthly");
    setIsRecurring(true);
    setAdvancedDebt({});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name || isNaN(amt)) {
      toast.error("Please provide a valid name and amount.");
      return;
    }
    if (!categoryId && householdId && !demoMode) {
      toast.error("Please select a category for this bill.");
      return;
    }

    const advancedFields = {
      creditLimit: advancedDebt.creditLimit
        ? parseFloat(advancedDebt.creditLimit)
        : undefined,
      apr: advancedDebt.apr ? parseFloat(advancedDebt.apr) / 100 : undefined,
      monthlyFees: advancedDebt.monthlyFees
        ? parseFloat(advancedDebt.monthlyFees)
        : undefined,
      yearlyFees: advancedDebt.yearlyFees
        ? parseFloat(advancedDebt.yearlyFees)
        : undefined,
      lateFees: advancedDebt.lateFees
        ? parseFloat(advancedDebt.lateFees)
        : undefined,
      idealPayment: advancedDebt.idealPayment
        ? parseFloat(advancedDebt.idealPayment)
        : undefined,
    };

    const parsedTotalBalance = totalBalance ? parseFloat(totalBalance) : amt;

    if (demoMode || !householdId) {
      addBillLocal({
        name,
        amount: amt,
        dueDate,
        categoryId: categoryId || "",
        isAutoPay,
        paymentStatus: "unpaid",
        amountPaid: 0,
        totalBalance: parsedTotalBalance,
        notes: notes || undefined,
        paymentAccountId: paymentAccountId || "",
        isRecurring,
        frequency: isRecurring ? frequency : undefined,
        isActive: true,
        ...advancedFields,
      });
      toast.success("Bill added (demo)");
      resetAddForm();
      setShowAddForm(false);
      return;
    }
    createBill.mutate(
      {
        name,
        amount: amt,
        dueDate,
        categoryId: categoryId || null,
        isAutoPay,
        notes: notes || undefined,
        paymentStatus: "unpaid",
        amountPaid: 0,
        totalBalance: parsedTotalBalance,
        paymentAccountId: paymentAccountId || null,
        isRecurring,
        frequency: isRecurring ? frequency : undefined,
        ...advancedFields,
      },
      {
        onSuccess: () => {
          toast.success("Bill added");
          resetAddForm();
          setShowAddForm(false);
        },
        onError: (e) => {
          console.error(e);
          toast.error("Failed to add bill");
        },
      },
    );
  };

  const openEdit = (id: string) => {
    const b = budget.bills.find((x) => x.id === id);
    if (!b) return;
    setEditingId(id);
    setEditName(b.name);
    setEditAmount(String(b.amount));
    setEditTotalBalance(b.totalBalance ? String(b.totalBalance) : "");
    setEditDueDate(b.dueDate);
    setEditCategoryId(b.categoryId || "");
    setEditIsAutoPay(!!b.isAutoPay);
    setEditNotes(b.notes || "");
    setEditPaymentAccountId(b.paymentAccountId || "");
    setEditFrequency((b.frequency as any) || "monthly");
    setEditIsRecurring(b.isRecurring !== false);
    setEditAdvancedDebt({
      creditLimit: b.creditLimit != null ? String(b.creditLimit) : "",
      apr: b.apr != null ? String(b.apr * 100) : "",
      monthlyFees: b.monthlyFees != null ? String(b.monthlyFees) : "",
      yearlyFees: b.yearlyFees != null ? String(b.yearlyFees) : "",
      lateFees: b.lateFees != null ? String(b.lateFees) : "",
      idealPayment: b.idealPayment != null ? String(b.idealPayment) : "",
    });
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

    const advancedFields = {
      creditLimit: editAdvancedDebt.creditLimit
        ? parseFloat(editAdvancedDebt.creditLimit)
        : null,
      apr: editAdvancedDebt.apr ? parseFloat(editAdvancedDebt.apr) / 100 : null,
      monthlyFees: editAdvancedDebt.monthlyFees
        ? parseFloat(editAdvancedDebt.monthlyFees)
        : null,
      yearlyFees: editAdvancedDebt.yearlyFees
        ? parseFloat(editAdvancedDebt.yearlyFees)
        : null,
      lateFees: editAdvancedDebt.lateFees
        ? parseFloat(editAdvancedDebt.lateFees)
        : null,
      idealPayment: editAdvancedDebt.idealPayment
        ? parseFloat(editAdvancedDebt.idealPayment)
        : null,
    };

    const parsedEditTotalBalance = editTotalBalance
      ? parseFloat(editTotalBalance)
      : amt;

    if (demoMode || !householdId) {
      updateBillLocal(editingId, {
        name: editName,
        amount: amt,
        totalBalance: parsedEditTotalBalance,
        dueDate: editDueDate,
        categoryId: editCategoryId || "",
        isAutoPay: editIsAutoPay,
        notes: editNotes || undefined,
        paymentAccountId: editPaymentAccountId || "",
        isRecurring: editIsRecurring,
        frequency: editIsRecurring ? editFrequency : undefined,
        ...advancedFields,
      });
      toast.success("Bill updated (demo)");
      setEditOpen(false);
      return;
    }
    updateBill.mutate(
      {
        id: editingId,
        updates: {
          name: editName,
          amount: amt,
          totalBalance: parsedEditTotalBalance,
          dueDate: editDueDate,
          categoryId: editCategoryId || null,
          isAutoPay: editIsAutoPay,
          notes: editNotes || undefined,
          paymentAccountId: editPaymentAccountId || null,
          isRecurring: editIsRecurring,
          frequency: editIsRecurring ? editFrequency : undefined,
          ...advancedFields,
        },
      },
      {
        onSuccess: () => {
          toast.success("Bill updated");
          setEditOpen(false);
        },
        onError: (e) => {
          console.error(e);
          toast.error("Failed to update bill");
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    const b = budget.bills.find((x) => x.id === id);
    if (!b) return;
    if (window.confirm(`Delete bill "${b.name}"?`)) {
      if (demoMode || !householdId) {
        deleteBillLocal(id);
        toast.success("Bill deleted (demo)");
      } else {
        deleteBill.mutate(id, {
          onSuccess: () => toast.success("Bill deleted"),
          onError: (e) => {
            console.error(e);
            toast.error("Failed to delete bill");
          },
        });
      }
    }
  };

  const runImportRows = async (mappedRows: Record<string, any>[]) => {
    let ok = 0,
      fail = 0;
    for (const r of mappedRows) {
      try {
        const billName = String(r.name || "").trim();
        const billAmount = Number(r.amount);
        const billDueDate = String(r.due_date || "").slice(0, 10);
        const categoryName = (r.category || "").toString().trim();
        const billNotes = (r.notes || "").toString().trim() || undefined;
        if (!billName || !billDueDate || isNaN(billAmount)) {
          fail++;
          continue;
        }
        let catId: string | null = null;
        if (categoryName) {
          const existing = budget.categories.find(
            (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
          );
          if (existing) catId = existing.id;
          else if (autoCreateCats) {
            try {
              if (!householdId || demoMode) {
                addCategory({
                  name: categoryName,
                  type: "variable",
                  monthlyLimit: 0,
                  icon: "📦",
                });
                const newly = budget.categories.find(
                  (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
                );
                catId = newly?.id || null;
              } else {
                const row = await createCategory.mutateAsync({
                  name: categoryName,
                  type: "variable",
                  monthlyLimit: 0,
                  icon: "📦",
                });
                catId = row.id;
              }
            } catch {}
          }
        }
        if (demoMode || !householdId) {
          addBillLocal({
            name: billName,
            amount: billAmount,
            dueDate: billDueDate,
            categoryId: catId || "",
            isAutoPay: false,
            paymentStatus: "unpaid",
            amountPaid: 0,
            totalBalance: billAmount,
            notes: billNotes,
            paymentAccountId: "",
            isRecurring: true,
            frequency: "monthly",
            isActive: true,
          });
        } else {
          await createBill.mutateAsync({
            name: billName,
            amount: billAmount,
            dueDate: billDueDate,
            categoryId: catId || null,
            isAutoPay: false,
            notes: billNotes,
            isRecurring: true,
            frequency: "monthly",
            paymentStatus: "unpaid",
            amountPaid: 0,
            totalBalance: billAmount,
          });
        }
        ok++;
      } catch {
        fail++;
      }
    }
    return { ok, fail };
  };

  const handleSync = () => {
    if (householdId) {
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.bills(householdId) });
      toast.success("Synced");
    }
  };

  const handleArchivePaidOneTime = () => {
    const candidates = budget.bills.filter(
      (b) =>
        b.isRecurring === false &&
        b.paymentStatus === "paid" &&
        b.isActive !== false,
    );
    if (candidates.length === 0) {
      toast.info("No paid one-time bills to archive");
      return;
    }
    if (demoMode || !householdId) {
      candidates.forEach((b) => updateBillLocal(b.id, { isActive: false }));
      toast.success(
        `Archived ${candidates.length} one-time bill${candidates.length === 1 ? "" : "s"} (demo)`,
      );
    } else {
      candidates.forEach((b) =>
        updateBill.mutate({ id: b.id, updates: { isActive: false } }),
      );
      toast.success(
        `Archiving ${candidates.length} one-time bill${candidates.length === 1 ? "" : "s"}`,
      );
    }
  };

  const openPaymentDialog = (bill: any) => {
    setPayBillId(bill.id);
    const remaining = bill.amount - (bill.amountPaid || 0);
    setPayAmount(remaining > 0 ? String(remaining) : String(bill.amount));
    setPayNote("");
    setPayDialogOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBillId) return;
    const bill = budget.bills.find((b) => b.id === payBillId);
    if (!bill) return;

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!bill.categoryId) {
      toast.error("Assign this bill to a category before recording a payment.");
      return;
    }

    if (demoMode || !householdId) {
      const newPaid = (bill.amountPaid || 0) + amt;
      const status = newPaid >= bill.amount ? "paid" : "partial";
      updateBillLocal(bill.id, { paymentStatus: status, amountPaid: newPaid });
      toast.success("Payment recorded (demo)");
    } else {
      addExpense({
        amount: amt,
        categoryId: bill.categoryId,
        date: new Date().toISOString().slice(0, 10),
        description: payNote || `Bill payment: ${bill.name}`,
        linkedBillId: bill.id,
      });
      toast.success("Payment recorded");
    }
    setPayDialogOpen(false);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {demoMode && <DemoBanner />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Bills & Payments
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Track and manage recurring and one-time bills
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSync}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </Button>
          <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
            <Button className="gap-2" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4" />
              Add Bill
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-bold">New Bill</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Internet"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Monthly Payment
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-7 font-mono"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Total Balance (Optional)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalBalance}
                      onChange={(e) => setTotalBalance(e.target.value)}
                      className="pl-7 font-mono"
                      placeholder="Current amount owed"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Due Date
                    </Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Frequency
                    </Label>
                    <Select
                      value={isRecurring ? frequency : "one-time"}
                      onValueChange={(v) => {
                        if (v === "one-time") {
                          setIsRecurring(false);
                        } else {
                          setIsRecurring(true);
                          setFrequency(v as any);
                        }
                      }}
                    >
                      <SelectTrigger className="font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="one-time">One-time</SelectItem>
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
                        {categoryOptions.map((c) => (
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
                        {accountOptions.map((a) => (
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
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes (promo APR expiry, payment plans, etc.)"
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="border-t pt-4">
                  <AdvancedDebtDetails
                    values={advancedDebt}
                    onChange={setAdvancedDebt}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="font-mono">
                    Create
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="font-mono"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {budget.bills.length === 0 && (
        <div className="border-2 border-border p-4 bg-secondary flex items-center justify-between">
          <p className="text-sm">
            No bills yet. Add your first bill or import from CSV.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="font-mono text-xs"
            >
              ADD BILL
            </Button>
            <CsvImportDialog
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Import CSV
                </Button>
              }
              title="Import Bills from CSV"
              template={{
                filename: "bills_template.csv",
                headers: ["name", "amount", "due_date", "category", "notes"],
                sampleRows: [
                  ["Rent", "1500", "2025-01-01", "Housing", "January rent"],
                ],
              }}
              fields={[
                { key: "name", label: "Name" },
                { key: "amount", label: "Amount", type: "number" },
                { key: "due_date", label: "Due Date", type: "date" },
                { key: "category", label: "Category", optional: true },
                { key: "notes", label: "Notes", optional: true },
              ]}
              synonyms={{
                name: ["name", "bill", "title"],
                amount: ["amount", "total", "price"],
                due_date: ["duedate", "due", "date"],
                category: ["category", "categoryname"],
                notes: ["notes", "note", "memo"],
              }}
              storageKey="import:bills"
              onImport={async (rows) => {
                const errors: { row: number; reason: string }[] = [];
                const validRows = rows.filter((r, i) => {
                  if (!r.name || isNaN(Number(r.amount)) || !r.due_date) {
                    errors.push({
                      row: i + 1,
                      reason: "Missing required fields",
                    });
                    return false;
                  }
                  return true;
                });
                const res = await runImportRows(validRows);
                return { ok: res.ok, fail: res.fail + errors.length, errors };
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
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs md:text-sm">
              Bills Due This Month
            </CardDescription>
            <CardTitle className="text-lg md:text-2xl font-mono">
              ${totalMonthlyBills.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className={`border-2 ${overdueBills.length > 0 ? "border-destructive" : ""}`}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs md:text-sm">
              Overdue Bills
            </CardDescription>
            <CardTitle className="text-lg md:text-2xl font-mono text-destructive">
              {overdueBills.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs md:text-sm text-muted-foreground">
              $
              {overdueBills
                .reduce((sum, bill) => sum + (bill.amount - bill.amountPaid), 0)
                .toFixed(2)}{" "}
              owed
            </p>
          </CardContent>
        </Card>

        <Card
          className={`border-2 ${upcomingBills.length > 0 ? "border-yellow-500" : ""}`}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs md:text-sm">
              Due This Week
            </CardDescription>
            <CardTitle className="text-lg md:text-2xl font-mono">
              {upcomingBills.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs md:text-sm text-muted-foreground">
              $
              {upcomingBills
                .reduce((sum, bill) => sum + (bill.amount - bill.amountPaid), 0)
                .toFixed(2)}{" "}
              due
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs md:text-sm">
              Total Bills
            </CardDescription>
            <CardTitle className="text-lg md:text-2xl font-mono">
              {budget.bills.filter((b) => b.isActive !== false).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between p-4 border-2 border-border bg-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-mono uppercase text-muted-foreground">
              Filters:
            </span>
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[130px] font-mono">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={frequencyFilter}
            onValueChange={(v) => setFrequencyFilter(v as FrequencyFilter)}
          >
            <SelectTrigger className="w-[130px] font-mono">
              <SelectValue placeholder="Frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frequencies</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="one-time">One-time</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={activeFilter}
            onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
          >
            <SelectTrigger className="w-[130px] font-mono">
              <SelectValue placeholder="Active" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bills</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
          {(statusFilter !== "all" ||
            frequencyFilter !== "all" ||
            activeFilter !== "active") && (
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs"
              onClick={() => {
                setStatusFilter("all");
                setFrequencyFilter("all");
                setActiveFilter("active");
              }}
            >
              Clear Filters
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={() => {
              setFrequencyFilter("one-time");
              setActiveFilter("active");
            }}
          >
            One-time Only
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={handleArchivePaidOneTime}
          >
            <Archive className="h-4 w-4 mr-1" /> Archive paid one-time
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="font-mono text-xs opacity-50 hover:opacity-100"
            onClick={() => {
              if (
                window.confirm(
                  "This will create missing expense records for all paid bills. Continue?",
                )
              ) {
                repairBillExpenses();
              }
            }}
          >
            Repair Data
          </Button>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Bills</CardTitle>
              <CardDescription>
                Showing {filteredBills.length} of {budget.bills.length} bills
              </CardDescription>
            </div>
            <CsvImportDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              }
              title="Import Bills from CSV"
              template={{
                filename: "bills_template.csv",
                headers: ["name", "amount", "due_date", "category", "notes"],
                sampleRows: [
                  ["Rent", "1500", "2025-01-01", "Housing", "January rent"],
                ],
              }}
              fields={[
                { key: "name", label: "Name" },
                { key: "amount", label: "Amount", type: "number" },
                { key: "due_date", label: "Due Date", type: "date" },
                { key: "category", label: "Category", optional: true },
                { key: "notes", label: "Notes", optional: true },
              ]}
              synonyms={{
                name: ["name", "bill", "title"],
                amount: ["amount", "total", "price"],
                due_date: ["duedate", "due", "date"],
                category: ["category", "categoryname"],
                notes: ["notes", "note", "memo"],
              }}
              storageKey="import:bills"
              onImport={async (rows) => {
                const errors: { row: number; reason: string }[] = [];
                const validRows = rows.filter((r, i) => {
                  if (!r.name || isNaN(Number(r.amount)) || !r.due_date) {
                    errors.push({
                      row: i + 1,
                      reason: "Missing required fields",
                    });
                    return false;
                  }
                  return true;
                });
                const res = await runImportRows(validRows);
                return { ok: res.ok, fail: res.fail + errors.length, errors };
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
          </div>
        </CardHeader>
        <CardContent>
          {filteredBills.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {budget.bills.length === 0
                  ? "No bills added yet"
                  : "No bills match the current filters"}
              </p>
              {budget.bills.length === 0 && (
                <Button onClick={() => setShowAddForm(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Bill
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBills.map((bill) => {
                const billDueDate = new Date(bill.dueDate);
                const today = new Date();
                const isOverdue =
                  billDueDate < today && bill.paymentStatus !== "paid";
                const isDueSoon =
                  Math.ceil(
                    (billDueDate.getTime() - today.getTime()) /
                      (1000 * 60 * 60 * 24),
                  ) <= 7 && bill.paymentStatus !== "paid";

                return (
                  <div
                    key={bill.id}
                    className={`border-2 rounded-lg p-4 ${
                      bill.isActive === false
                        ? "opacity-60 bg-muted"
                        : isOverdue
                          ? "border-destructive bg-destructive/5"
                          : isDueSoon
                            ? "border-yellow-500 bg-yellow-500/5"
                            : bill.paymentStatus === "paid"
                              ? "border-green-500 bg-green-500/5"
                              : "border-border"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{bill.name}</h3>
                          <Badge
                            variant={
                              bill.paymentStatus === "paid"
                                ? "default"
                                : bill.paymentStatus === "partial"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="text-xs font-mono"
                          >
                            {bill.paymentStatus === "paid"
                              ? "Paid"
                              : bill.paymentStatus === "partial"
                                ? "Partial"
                                : "Unpaid"}
                          </Badge>
                          {bill.isAutoPay && (
                            <Badge
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              Auto-Pay
                            </Badge>
                          )}
                          {bill.isActive === false && (
                            <Badge
                              variant="secondary"
                              className="text-xs font-mono"
                            >
                              Inactive
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="text-xs font-mono"
                          >
                            {bill.isRecurring
                              ? bill.frequency || "Monthly"
                              : "One-time"}
                          </Badge>
                          {billToDebtMap.has(bill.id) && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs font-mono gap-1"
                                  >
                                    <Landmark className="h-3 w-3" />
                                    Debt: {billToDebtMap.get(bill.id)!.name}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-mono text-xs">
                                    Remaining: $
                                    {billToDebtMap
                                      .get(bill.id)!
                                      .currentBalance.toLocaleString()}{" "}
                                    / $
                                    {billToDebtMap
                                      .get(bill.id)!
                                      .totalBalance.toLocaleString()}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Amount</p>
                            <p className="font-semibold font-mono">
                              ${bill.amount.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Due Date</p>
                            <p className="font-semibold font-mono">
                              {billDueDate.toLocaleDateString()}
                              {isOverdue && (
                                <span className="text-destructive ml-1">
                                  (Overdue)
                                </span>
                              )}
                              {isDueSoon && !isOverdue && (
                                <span className="text-yellow-600 ml-1">
                                  (Soon)
                                </span>
                              )}
                            </p>
                          </div>
                          {bill.totalBalance > 0 &&
                            bill.totalBalance !== bill.amount && (
                              <div>
                                <p className="text-muted-foreground">
                                  Total Balance
                                </p>
                                <p className="font-semibold font-mono">
                                  ${bill.totalBalance.toFixed(2)}
                                </p>
                              </div>
                            )}
                          {bill.apr != null && (
                            <div>
                              <p className="text-muted-foreground">APR</p>
                              <p className="font-semibold font-mono">
                                {(bill.apr * 100).toFixed(2)}%
                              </p>
                            </div>
                          )}
                          {bill.idealPayment != null && (
                            <div>
                              <p className="text-muted-foreground">
                                Ideal Payment
                              </p>
                              <p className="font-semibold font-mono">
                                ${bill.idealPayment.toFixed(2)}
                              </p>
                            </div>
                          )}
                          {!(
                            bill.totalBalance > 0 &&
                            bill.totalBalance !== bill.amount
                          ) &&
                            !bill.apr &&
                            !bill.idealPayment && (
                              <>
                                <div>
                                  <p className="text-muted-foreground">Paid</p>
                                  <p className="font-semibold font-mono">
                                    ${(bill.amountPaid || 0).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">
                                    Balance
                                  </p>
                                  <p className="font-semibold font-mono">
                                    $
                                    {(
                                      bill.amount - (bill.amountPaid || 0)
                                    ).toFixed(2)}
                                  </p>
                                </div>
                              </>
                            )}
                        </div>
                        {bill.creditLimit != null &&
                          bill.creditLimit > 0 &&
                          bill.totalBalance > 0 && (
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <Percent className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                Utilization:
                              </span>
                              <span
                                className={`font-mono font-semibold ${
                                  (bill.totalBalance / bill.creditLimit) * 100 >
                                  30
                                    ? "text-destructive"
                                    : "text-green-600"
                                }`}
                              >
                                {(
                                  (bill.totalBalance / bill.creditLimit) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                              <span className="text-muted-foreground">
                                of ${bill.creditLimit.toLocaleString()}
                              </span>
                            </div>
                          )}
                        {(bill.notes ||
                          (bill.categoryId &&
                            budget.categories.find(
                              (c) => c.id === bill.categoryId,
                            ))) && (
                          <div className="mt-2 text-xs text-muted-foreground flex gap-3">
                            {bill.categoryId && (
                              <span className="flex items-center gap-1">
                                <span className="font-mono">Category:</span>{" "}
                                {
                                  budget.categories.find(
                                    (c) => c.id === bill.categoryId,
                                  )?.name
                                }
                              </span>
                            )}
                            {bill.notes && (
                              <span className="flex items-center gap-1">
                                <span className="font-mono">Note:</span>{" "}
                                {bill.notes}
                              </span>
                            )}
                          </div>
                        )}
                        {bill.paymentAccountId &&
                          budget.bankAccounts.find(
                            (a) => a.id === bill.paymentAccountId,
                          ) && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              <span className="font-mono">Pay from:</span>{" "}
                              {
                                budget.bankAccounts.find(
                                  (a) => a.id === bill.paymentAccountId,
                                )?.name
                              }
                            </div>
                          )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {bill.paymentStatus !== "paid" &&
                          bill.isActive !== false && (
                            <Button
                              size="sm"
                              onClick={() => openPaymentDialog(bill)}
                            >
                              Record Payment
                            </Button>
                          )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(bill.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(bill.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Payment</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Total Balance (Optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editTotalBalance}
                  onChange={(e) => setEditTotalBalance(e.target.value)}
                  className="pl-7 font-mono"
                  placeholder="Current amount owed"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={editIsRecurring ? editFrequency : "one-time"}
                  onValueChange={(v) => {
                    if (v === "one-time") {
                      setEditIsRecurring(false);
                    } else {
                      setEditIsRecurring(true);
                      setEditFrequency(v as any);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editCategoryId}
                  onValueChange={setEditCategoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Account</Label>
                <Select
                  value={editPaymentAccountId}
                  onValueChange={setEditPaymentAccountId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Promo APR expiry, payment plans, etc."
              />
            </div>
            <div className="border-t pt-4">
              <AdvancedDebtDetails
                values={editAdvancedDebt}
                onChange={setEditAdvancedDebt}
                defaultOpen={Object.values(editAdvancedDebt).some(
                  (v) => v && v !== "",
                )}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editIsAutoPay}
                onChange={(e) => setEditIsAutoPay(e.target.checked)}
                id="editAutoPay"
              />
              <Label htmlFor="editAutoPay">Auto-Pay enabled</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <CardDescription>
              Record a payment for this bill. This will create an expense.
            </CardDescription>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount Paid</Label>
              <Input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Confirmation number, etc."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPayDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Record Payment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
