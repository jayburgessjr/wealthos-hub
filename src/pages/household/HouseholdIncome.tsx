import { useMemo, useState } from "react";
import { RecurrenceFrequency } from "@/integrations/supabase/household-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  DollarSign,
  TrendingUp,
  Calendar,
  Briefcase,
  Upload,
} from "lucide-react";
import { CsvImportDialog } from "@/components/household/import/CsvImportDialog";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { DemoBanner } from "@/components/household/layout/DemoBanner";
import { useDemoMode } from "@/hooks/useHouseholdDemoMode";
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/AuthProvider";
import {
  useCreateIncomeSourceMutation,
  useCreateIncomeEntryMutation,
  useUpdateIncomeSourceMutation,
  useDeleteIncomeSourceMutation,
  useUpdateIncomeEntryMutation,
  useDeleteIncomeEntryMutation,
} from "@/hooks/useHouseholdBudgetData";
import { toast } from "sonner";

const HouseholdIncome = () => {
  const {
    budget,
    householdId,
    isLoading,
    error,
    addIncomeSourceLocal,
    addIncomeEntryLocal,
    updateIncomeSourceLocal,
    updateIncomeEntryLocal,
    deleteIncomeSourceLocal,
    deleteIncomeEntryLocal,
  } = useHouseholdBudget();
  const { demoMode } = useDemoMode();
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const createSource = useCreateIncomeSourceMutation(
    householdId,
    user?.id ?? null,
  );
  const createEntry = useCreateIncomeEntryMutation(
    householdId,
    user?.id ?? null,
    budget.month,
  );
  const updateSource = useUpdateIncomeSourceMutation(householdId);
  const deleteSource = useDeleteIncomeSourceMutation(householdId);
  const updateEntry = useUpdateIncomeEntryMutation(householdId, budget.month);
  const deleteEntry = useDeleteIncomeEntryMutation(householdId, budget.month);

  // Import dialogs
  const [importSourcesOpen, setImportSourcesOpen] = useState(false);
  const [importEntriesOpen, setImportEntriesOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    ok: number;
    fail: number;
  }>({ ok: 0, fail: 0 });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground font-mono">
          Loading income…
        </div>
      </DashboardLayout>
    );
  }
  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="border-2 border-destructive p-4 bg-card max-w-lg">
            <p className="font-bold mb-1">Failed to load income</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  const [viewMode, setViewMode] = useState<"entries" | "sources">("entries");

  const currentMonth = budget.month;

  // Calculate income metrics
  const totalIncomeReceived = budget.incomeEntries
    .filter((entry) => entry.date.startsWith(currentMonth))
    .reduce((sum, entry) => sum + entry.amount, 0);
  const yearStr = new Date().getFullYear().toString();
  const totalYTD = budget.incomeEntries
    .filter((e) => e.date.startsWith(yearStr))
    .reduce((s, e) => s + e.amount, 0);
  const paychecksThisMonth = budget.incomeEntries.filter(
    (e) => e.date.startsWith(currentMonth) && e.type === "salary",
  ).length;

  function monthlyFrom(source: any): number {
    const amt = Number(source.expectedAmount || 0);
    const freq = String(source.frequency || "monthly");
    switch (freq) {
      case "yearly":
        return amt / 12;
      case "monthly":
        return amt;
      case "biweekly":
        return (amt * 26) / 12;
      case "weekly":
        return (amt * 52) / 12;
      case "quarterly":
        return (amt * 4) / 12;
      default:
        return amt;
    }
  }
  const totalExpectedIncome = budget.incomeSources
    .filter((source) => source.isActive)
    .reduce((sum, source) => sum + monthlyFrom(source), 0);

  // Salary-focused metrics
  const monthlySalaryBase = budget.incomeSources
    .filter((s) => s.isActive && s.type === "salary")
    .reduce((sum, s) => sum + monthlyFrom(s), 0);
  const annualSalaryBase = monthlySalaryBase * 12;
  const salaryThisMonthActual = budget.incomeEntries
    .filter((e) => e.date.startsWith(currentMonth) && e.type === "salary")
    .reduce((s, e) => s + e.amount, 0);
  const avgPaycheckThisMonth = (() => {
    const pays = budget.incomeEntries.filter(
      (e) => e.date.startsWith(currentMonth) && e.type === "salary",
    );
    return pays.length
      ? pays.reduce((s, e) => s + e.amount, 0) / pays.length
      : 0;
  })();

  const incomeVariance = totalIncomeReceived - totalExpectedIncome;
  const variancePercentage =
    totalExpectedIncome > 0
      ? ((incomeVariance / totalExpectedIncome) * 100).toFixed(1)
      : "0";

  // Breakdown by type
  const incomeByType = budget.incomeEntries
    .filter((entry) => entry.date.startsWith(currentMonth))
    .reduce(
      (acc, entry) => {
        acc[entry.type] = (acc[entry.type] || 0) + entry.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

  // Breakdown by person
  const incomeByPerson = budget.incomeEntries
    .filter((entry) => entry.date.startsWith(currentMonth))
    .reduce(
      (acc, entry) => {
        acc[entry.userName] = (acc[entry.userName] || 0) + entry.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

  // Recent income entries
  const recentEntries = [...budget.incomeEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  // Get icon for income type
  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      salary: "💼",
      business: "🏢",
      investment: "📈",
      rental: "🏠",
      freelance: "💻",
      loan: "🏦",
      tax_refund: "💰",
      gift: "🎁",
      other: "💵",
    };
    return icons[type] || "💵";
  };

  // Tax calculations
  const totalTaxableIncome = budget.incomeEntries
    .filter(
      (entry) =>
        entry.date.startsWith(currentMonth) && entry.taxStatus === "taxable",
    )
    .reduce((sum, entry) => sum + entry.amount, 0);

  const totalTaxWithheld = budget.incomeEntries
    .filter((entry) => entry.date.startsWith(currentMonth))
    .reduce((sum, entry) => sum + (entry.taxWithheld || 0), 0);

  // Add Source state
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("salary");
  const [sourceExpected, setSourceExpected] = useState("");
  const [sourceFrequency, setSourceFrequency] =
    useState<RecurrenceFrequency>("monthly");
  const [sourceNotes, setSourceNotes] = useState("");

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName) {
      toast.error("Please enter a source name");
      return;
    }
    if (demoMode || !householdId) {
      addIncomeSourceLocal({
        name: sourceName,
        type: sourceType as any,
        expectedAmount: sourceExpected ? parseFloat(sourceExpected) : undefined,
        frequency: sourceFrequency,
        expectedDay: undefined,
        isActive: true,
        userId: user?.id ?? "local",
        userName: user?.email ?? "You",
        taxStatus: "taxable",
        notes: sourceNotes || undefined,
      });
      toast.success("Income source added (demo)");
      setShowAddSource(false);
      setSourceName("");
      setSourceExpected("");
      setSourceNotes("");
      return;
    }
    createSource.mutate(
      {
        name: sourceName,
        type: sourceType,
        expectedAmount: sourceExpected ? parseFloat(sourceExpected) : undefined,
        frequency: sourceFrequency,
        notes: sourceNotes || undefined,
        isActive: true,
      },
      {
        onSuccess: () => {
          toast.success("Income source added");
          setShowAddSource(false);
          setSourceName("");
          setSourceExpected("");
          setSourceNotes("");
        },
        onError: () => toast.error("Failed to add source"),
      },
    );
  };

  // Add Entry state
  const [amount, setAmount] = useState("");
  const [entrySourceId, setEntrySourceId] = useState("");
  const [entrySourceName, setEntrySourceName] = useState("");
  const [entryType, setEntryType] = useState("salary");
  const [entryDate, setEntryDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [entryNotes, setEntryNotes] = useState("");
  const [entryPaymentMethod, setEntryPaymentMethod] =
    useState("direct_deposit");
  const [entryTaxStatus, setEntryTaxStatus] = useState("taxable");
  const [entryGross, setEntryGross] = useState("");
  const [entryNet, setEntryNet] = useState("");
  const [entryBizExpenses, setEntryBizExpenses] = useState("");
  const [entryPaymentAccountId, setEntryPaymentAccountId] = useState("");
  const quickLogPaycheck = () => {
    const firstSalarySource = budget.incomeSources.find(
      (s) => s.type === "salary",
    );
    if (firstSalarySource) setEntrySourceId(firstSalarySource.id);
    setEntrySourceName("");
    setEntryType("salary");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setShowAddForm(true);
  };

  const sourceOptions = useMemo(
    () => budget.incomeSources.map((s) => ({ id: s.id, label: s.name })),
    [budget.incomeSources],
  );
  const accountOptions = useMemo(
    () => budget.bankAccounts.map((a) => ({ id: a.id, label: a.name })),
    [budget.bankAccounts],
  );

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const sourceNameFinal = entrySourceId
      ? budget.incomeSources.find((s) => s.id === entrySourceId)?.name || ""
      : entrySourceName;
    if (!sourceNameFinal) {
      toast.error("Provide a source");
      return;
    }
    if (demoMode || !householdId || !user) {
      addIncomeEntryLocal({
        amount: amt,
        sourceId: entrySourceId || undefined,
        sourceName: sourceNameFinal,
        type: entryType as any,
        date: entryDate,
        notes: entryNotes || undefined,
        paymentMethod: "direct_deposit",
        taxStatus: "taxable",
        userId: user?.id ?? "local",
        userName: user?.email ?? "You",
        isRecurring: false,
        grossAmount: entryGross ? parseFloat(entryGross) : undefined,
        netAmount: entryNet ? parseFloat(entryNet) : undefined,
        businessExpenses: entryBizExpenses
          ? parseFloat(entryBizExpenses)
          : undefined,
      });
      toast.success("Income recorded (demo)");
      setShowAddForm(false);
      setAmount("");
      setEntrySourceId("");
      setEntrySourceName("");
      setEntryNotes("");
      setEntryGross("");
      setEntryNet("");
      setEntryBizExpenses("");
      setEntryPaymentAccountId("");
      return;
    }
    createEntry.mutate(
      {
        amount: amt,
        sourceId: entrySourceId || null,
        sourceName: sourceNameFinal,
        type: entryType,
        date: entryDate,
        notes: entryNotes || undefined,
        paymentMethod: entryPaymentMethod,
        taxStatus: entryTaxStatus,
        grossAmount:
          entryType === "business" && entryGross
            ? parseFloat(entryGross)
            : undefined,
        netAmount:
          entryType === "business" && entryNet
            ? parseFloat(entryNet)
            : undefined,
        businessExpenses:
          entryType === "business" && entryBizExpenses
            ? parseFloat(entryBizExpenses)
            : undefined,
        paymentAccountId: entryPaymentAccountId || null,
      },
      {
        onSuccess: () => {
          toast.success("Income recorded");
          setShowAddForm(false);
          setAmount("");
          setEntrySourceId("");
          setEntrySourceName("");
          setEntryNotes("");
          setEntryGross("");
          setEntryNet("");
          setEntryBizExpenses("");
          setEntryPaymentAccountId("");
        },
        onError: () => toast.error("Failed to add income"),
      },
    );
  };

  // Edit Source dialog state
  const [editSourceOpen, setEditSourceOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editSourceName, setEditSourceName] = useState("");
  const [editSourceType, setEditSourceType] = useState("salary");
  const [editSourceExpected, setEditSourceExpected] = useState("");
  const [editSourceFrequency, setEditSourceFrequency] =
    useState<RecurrenceFrequency>("monthly");

  const handleEditSourceSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSourceId) return;
    if (demoMode || !householdId) {
      updateIncomeSourceLocal(editingSourceId, {
        name: editSourceName,
        type: editSourceType as any,
        expectedAmount: editSourceExpected
          ? parseFloat(editSourceExpected)
          : undefined,
        frequency: editSourceFrequency as any,
      });
      toast.success("Source updated (demo)");
      setEditSourceOpen(false);
    } else {
      updateSource.mutate(
        {
          id: editingSourceId,
          updates: {
            name: editSourceName,
            type: editSourceType,
            expectedAmount: editSourceExpected
              ? parseFloat(editSourceExpected)
              : undefined,
            frequency: editSourceFrequency,
          },
        },
        {
          onSuccess: () => {
            toast.success("Source updated");
            setEditSourceOpen(false);
          },
          onError: () => toast.error("Failed to update source"),
        },
      );
    }
  };

  // Edit Entry dialog state
  const [editEntryOpen, setEditEntryOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryAmount, setEditEntryAmount] = useState("");
  const [editEntryDate, setEditEntryDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [editEntryNotes, setEditEntryNotes] = useState("");

  const handleEditEntrySave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntryId) return;
    const amt = parseFloat(editEntryAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (demoMode || !householdId) {
      updateIncomeEntryLocal(editingEntryId, {
        amount: amt,
        date: editEntryDate,
        notes: editEntryNotes || undefined,
      });
      toast.success("Entry updated (demo)");
      setEditEntryOpen(false);
    } else {
      updateEntry.mutate(
        {
          id: editingEntryId,
          updates: {
            amount: amt,
            date: editEntryDate,
            notes: editEntryNotes || undefined,
          },
        },
        {
          onSuccess: () => {
            toast.success("Entry updated");
            setEditEntryOpen(false);
          },
          onError: () => toast.error("Failed to update entry"),
        },
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {demoMode && <DemoBanner />}
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Money In
              </span>
            </div>
            <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
              Income <span className="text-emerald-500">Tracker</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track all your income sources and payments.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              className="gap-2 w-full sm:w-auto"
              variant="outline"
              onClick={quickLogPaycheck}
            >
              <Briefcase className="h-4 w-4" />
              Log Paycheck
            </Button>
            <CsvImportDialog
              trigger={
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <Upload className="h-4 w-4" />
                  Import Sources
                </Button>
              }
              title="Import Income Sources"
              template={{
                filename: "income_sources_template.csv",
                headers: [
                  "name",
                  "type",
                  "expected_amount",
                  "frequency",
                  "notes",
                ],
                sampleRows: [["Salary", "salary", "6500", "monthly", ""]],
              }}
              fields={[
                { key: "name", label: "Name" },
                { key: "type", label: "Type", optional: true },
                {
                  key: "expected_amount",
                  label: "Expected Amount",
                  optional: true,
                  type: "number",
                },
                { key: "frequency", label: "Frequency", optional: true },
                { key: "notes", label: "Notes", optional: true },
              ]}
              synonyms={{
                name: ["name", "source"],
                type: ["type"],
                expected_amount: ["expectedamount", "expected"],
                frequency: ["frequency", "freq"],
                notes: ["notes", "note"],
              }}
              storageKey="import:income_sources"
              onImport={async (rowsMapped) => {
                setImporting(true);
                let ok = 0,
                  fail = 0;
                const errors: { row: number; reason: string }[] = [];
                for (let i = 0; i < rowsMapped.length; i++) {
                  try {
                    const r = rowsMapped[i];
                    const name = String(r.name || "").trim();
                    if (!name) {
                      fail++;
                      continue;
                    }
                    const type = (r.type || "salary").toString();
                    const expected =
                      r.expected_amount != null
                        ? Number(r.expected_amount)
                        : undefined;
                    const frequency = (r.frequency || "monthly").toString();
                    const notes = (r.notes || "").toString() || undefined;
                    if (demoMode || !householdId || !user) {
                      addIncomeSourceLocal({
                        name,
                        type: type as any,
                        expectedAmount: expected,
                        frequency: frequency as any,
                        expectedDay: undefined,
                        isActive: true,
                        userId: user?.id || "local",
                        userName: user?.email || "You",
                        taxStatus: "taxable",
                        notes,
                      });
                    } else {
                      await createSource.mutateAsync({
                        name,
                        type,
                        expectedAmount: expected,
                        frequency,
                        notes,
                        isActive: true,
                      });
                    }
                    ok++;
                  } catch {
                    fail++;
                    errors.push({ row: i + 1, reason: "Failed to import row" });
                  }
                }
                setImportSummary({ ok, fail });
                setImporting(false);
                return { ok, fail, errors };
              }}
            />
            <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Add Source
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-bold">
                    Add Income Source
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddSource} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Name</Label>
                    <Input
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      placeholder="e.g., Salary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Type
                      </Label>
                      <Select value={sourceType} onValueChange={setSourceType}>
                        <SelectTrigger className="font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "salary",
                            "business",
                            "investment",
                            "freelance",
                            "gift",
                            "other",
                          ].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Expected Amount
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={sourceExpected}
                          onChange={(e) => setSourceExpected(e.target.value)}
                          className="pl-7 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Frequency
                    </Label>
                    <Select
                      value={sourceFrequency}
                      onValueChange={(v) =>
                        setSourceFrequency(v as RecurrenceFrequency)
                      }
                    >
                      <SelectTrigger className="font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["monthly", "biweekly", "weekly", "yearly"].map(
                          (f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Notes</Label>
                    <Input
                      value={sourceNotes}
                      onChange={(e) => setSourceNotes(e.target.value)}
                      placeholder="Optional"
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
                      onClick={() => setShowAddSource(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <CsvImportDialog
              trigger={
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <Upload className="h-4 w-4" />
                  Import Income
                </Button>
              }
              title="Import Income Entries"
              template={{
                filename: "income_entries_template.csv",
                headers: ["date", "amount", "source_name", "type", "notes"],
                sampleRows: [["2025-01-05", "2500", "Salary", "salary", ""]],
              }}
              fields={[
                { key: "date", label: "Date", type: "date" },
                { key: "amount", label: "Amount", type: "number" },
                { key: "source_name", label: "Source Name" },
                { key: "type", label: "Type", optional: true },
                { key: "notes", label: "Notes", optional: true },
              ]}
              synonyms={{
                date: ["date", "received", "transactiondate"],
                amount: ["amount", "total"],
                source_name: ["source", "sourcename", "name", "description"],
                type: ["type"],
                notes: ["notes", "note", "memo"],
              }}
              storageKey="import:income_entries"
              onImport={async (rowsMapped) => {
                setImporting(true);
                let ok = 0,
                  fail = 0;
                const errors: { row: number; reason: string }[] = [];
                for (let i = 0; i < rowsMapped.length; i++) {
                  try {
                    const r = rowsMapped[i];
                    const date = String(r.date || "").slice(0, 10);
                    const amount = Number(r.amount);
                    if (!date || isNaN(amount)) {
                      fail++;
                      errors.push({
                        row: i + 1,
                        reason: "Invalid date or amount",
                      });
                      continue;
                    }
                    const sourceName = (r.source_name || "Income").toString();
                    const type = (r.type || "other").toString();
                    const notes = (r.notes || "").toString() || undefined;
                    if (demoMode || !householdId || !user) {
                      addIncomeEntryLocal({
                        amount,
                        sourceId: null,
                        sourceName,
                        type: type as any,
                        date,
                        notes,
                        paymentMethod: "direct_deposit",
                        taxStatus: "taxable",
                        userId: user?.id || "local",
                        userName: user?.email || "You",
                        isRecurring: false,
                      });
                    } else {
                      await createEntry.mutateAsync({
                        amount,
                        sourceId: null,
                        sourceName,
                        type,
                        date,
                        notes,
                        paymentMethod: "direct_deposit",
                        taxStatus: "taxable",
                      });
                    }
                    ok++;
                  } catch {
                    fail++;
                    errors.push({ row: i + 1, reason: "Failed to import row" });
                  }
                }
                setImportSummary({ ok, fail });
                setImporting(false);
                return { ok, fail, errors };
              }}
            />

            <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Add Income
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-bold">Add Income</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddEntry} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Amount
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="pl-7 font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Date
                      </Label>
                      <Input
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Source
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={entrySourceId}
                        onValueChange={setEntrySourceId}
                      >
                        <SelectTrigger className="font-mono">
                          <SelectValue placeholder="Select existing" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceOptions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={entrySourceName}
                        onChange={(e) => setEntrySourceName(e.target.value)}
                        placeholder="Or enter a new source"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Type</Label>
                    <Select value={entryType} onValueChange={setEntryType}>
                      <SelectTrigger className="font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "salary",
                          "business",
                          "investment",
                          "freelance",
                          "gift",
                          "other",
                        ].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Payment Method
                      </Label>
                      <Select
                        value={entryPaymentMethod}
                        onValueChange={setEntryPaymentMethod}
                      >
                        <SelectTrigger className="font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "direct_deposit",
                            "check",
                            "cash",
                            "transfer",
                            "other",
                          ].map((p) => (
                            <SelectItem key={p} value={p}>
                              {p.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Tax Status
                      </Label>
                      <Select
                        value={entryTaxStatus}
                        onValueChange={setEntryTaxStatus}
                      >
                        <SelectTrigger className="font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["taxable", "non_taxable", "deferred"].map((ts) => (
                            <SelectItem key={ts} value={ts}>
                              {ts.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {entryType === "business" && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="font-mono text-xs uppercase">
                          Gross
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            value={entryGross}
                            onChange={(e) => setEntryGross(e.target.value)}
                            className="pl-7 font-mono"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-mono text-xs uppercase">
                          Net
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            value={entryNet}
                            onChange={(e) => setEntryNet(e.target.value)}
                            className="pl-7 font-mono"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-mono text-xs uppercase">
                          Biz Expenses
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            value={entryBizExpenses}
                            onChange={(e) =>
                              setEntryBizExpenses(e.target.value)
                            }
                            className="pl-7 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Deposit Account
                    </Label>
                    <Select
                      value={entryPaymentAccountId}
                      onValueChange={setEntryPaymentAccountId}
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
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Notes</Label>
                    <Input
                      value={entryNotes}
                      onChange={(e) => setEntryNotes(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="font-mono">
                      Add
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

        {/* Getting started banner */}
        {budget.incomeSources.length === 0 &&
          budget.incomeEntries.length === 0 && (
            <div className="border-2 border-border p-4 bg-secondary flex items-center justify-between">
              <p className="text-sm">
                No income yet. Add a source or record your first income.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddSource(true)}
                  className="font-mono text-xs"
                >
                  ADD SOURCE
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                  className="font-mono text-xs"
                >
                  ADD INCOME
                </Button>
              </div>
            </div>
          )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Total Received (This Month)
              </CardDescription>
              <CardTitle className="text-lg md:text-3xl text-green-600">
                ${totalIncomeReceived.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DollarSign className="h-4 w-4 text-gray-500" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Expected Income
              </CardDescription>
              <CardTitle className="text-lg md:text-3xl text-blue-600">
                ${totalExpectedIncome.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar className="h-4 w-4 text-gray-500" />
            </CardContent>
          </Card>

          <Card
            className={
              incomeVariance >= 0 ? "border-green-500" : "border-red-500"
            }
          >
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Variance
              </CardDescription>
              <CardTitle
                className={`text-lg md:text-3xl ${incomeVariance >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {incomeVariance >= 0 ? "+" : ""}${incomeVariance.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs md:text-sm text-gray-600">
                {incomeVariance >= 0
                  ? `↑ ${variancePercentage}% above`
                  : `↓ ${Math.abs(parseFloat(variancePercentage))}% below`}{" "}
                expected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Active Sources
              </CardDescription>
              <CardTitle className="text-lg md:text-3xl">
                {budget.incomeSources.filter((s) => s.isActive).length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Briefcase className="h-4 w-4 text-gray-500" />
            </CardContent>
          </Card>
        </div>

        {/* Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* By Type */}
          <Card>
            <CardHeader>
              <CardTitle>Income by Type</CardTitle>
              <CardDescription>This month's breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(incomeByType).length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No income recorded this month
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(incomeByType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, amount]) => {
                      const percentage = (
                        (amount / totalIncomeReceived) *
                        100
                      ).toFixed(1);
                      return (
                        <div
                          key={type}
                          className="flex justify-between items-center"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">
                              {getTypeIcon(type)}
                            </span>
                            <span className="font-medium capitalize">
                              {type.replace("_", " ")}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              ${amount.toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {percentage}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Person */}
          <Card>
            <CardHeader>
              <CardTitle>Income by Person</CardTitle>
              <CardDescription>Who earned what this month</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(incomeByPerson).length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No income recorded this month
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(incomeByPerson)
                    .sort(([, a], [, b]) => b - a)
                    .map(([person, amount]) => {
                      const percentage = (
                        (amount / totalIncomeReceived) *
                        100
                      ).toFixed(1);
                      return (
                        <div
                          key={person}
                          className="flex justify-between items-center"
                        >
                          <span className="font-medium">{person}</span>
                          <div className="text-right">
                            <p className="font-semibold">
                              ${amount.toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {percentage}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly & YTD Summary */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:gap-4">
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                This Month (Actual)
              </CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${totalIncomeReceived.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Projected Monthly (Sources)
              </CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${totalExpectedIncome.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Variance
              </CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                {totalIncomeReceived - totalExpectedIncome >= 0 ? "+" : ""}
                {(totalIncomeReceived - totalExpectedIncome).toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Year‑to‑Date
              </CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${totalYTD.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Monthly Salary (Sources)
              </CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${monthlySalaryBase.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Annual Salary (Sources)
              </CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${annualSalaryBase.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Salary Month Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Paychecks This Month
              </CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                {paychecksThisMonth}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Salary Received (This Month)
              </CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${salaryThisMonthActual.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Avg Paycheck (This Month)
              </CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${avgPaycheckThisMonth.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tax Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Summary</CardTitle>
            <CardDescription>
              This month's taxable income and withholdings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <div>
                <p className="text-xs md:text-sm text-gray-600">
                  Taxable Income
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">
                  ${totalTaxableIncome.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-600">Tax Withheld</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">
                  ${totalTaxWithheld.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-600">
                  Effective Tax Rate
                </p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">
                  {totalTaxableIncome > 0
                    ? ((totalTaxWithheld / totalTaxableIncome) * 100).toFixed(1)
                    : "0"}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === "entries" ? "default" : "outline"}
            onClick={() => setViewMode("entries")}
            size="sm"
          >
            Income Entries
          </Button>
          <Button
            variant={viewMode === "sources" ? "default" : "outline"}
            onClick={() => setViewMode("sources")}
            size="sm"
          >
            Income Sources
          </Button>
        </div>

        {/* Income Entries */}
        {viewMode === "entries" && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Income</CardTitle>
              <CardDescription>Latest income entries</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEntries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No income entries yet</p>
                  <Button
                    onClick={() => setShowAddForm(true)}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Income Entry
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl md:text-3xl">
                          {getTypeIcon(entry.type)}
                        </span>
                        <div>
                          <p className="font-semibold">{entry.sourceName}</p>
                          <p className="text-sm text-gray-600">
                            {entry.userName} •{" "}
                            {new Date(entry.date).toLocaleDateString()}
                          </p>
                          {entry.notes && (
                            <p className="text-xs text-gray-500 italic mt-1">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg md:text-2xl font-bold text-green-600">
                          ${entry.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-600 capitalize">
                          {entry.type.replace("_", " ")} • {entry.taxStatus}
                        </p>
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingEntryId(entry.id);
                              setEditEntryAmount(String(entry.amount));
                              setEditEntryDate(entry.date);
                              setEditEntryNotes(entry.notes || "");
                              setEditEntryOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (demoMode || !householdId) {
                                deleteIncomeEntryLocal(entry.id);
                                toast.success("Entry deleted (demo)");
                              } else {
                                deleteEntry.mutate(entry.id, {
                                  onSuccess: () =>
                                    toast.success("Entry deleted"),
                                  onError: () =>
                                    toast.error("Failed to delete"),
                                });
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Income Sources */}
        {viewMode === "sources" && (
          <Card>
            <CardHeader>
              <CardTitle>Income Sources</CardTitle>
              <CardDescription>Expected recurring income</CardDescription>
            </CardHeader>
            <CardContent>
              {budget.incomeSources.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">
                    No income sources set up yet
                  </p>
                  <Button
                    onClick={() => setShowAddForm(true)}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Income Source
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {budget.incomeSources.map((source) => (
                    <div
                      key={source.id}
                      className={`flex justify-between items-center p-4 border rounded-lg ${
                        source.isActive
                          ? "hover:bg-gray-50"
                          : "opacity-50 bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl md:text-3xl">
                          {getTypeIcon(source.type)}
                        </span>
                        <div>
                          <p className="font-semibold">{source.name}</p>
                          <p className="text-sm text-gray-600">
                            {source.userName} •{" "}
                            {source.frequency ? source.frequency : "One-time"}
                          </p>
                          {source.notes && (
                            <p className="text-xs text-gray-500 italic mt-1">
                              {source.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg md:text-2xl font-bold">
                          ${source.expectedAmount?.toFixed(2) || "0.00"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {source.isActive ? "Active" : "Inactive"}
                        </p>
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingSourceId(source.id);
                              setEditSourceName(source.name);
                              setEditSourceType(source.type);
                              setEditSourceExpected(
                                source.expectedAmount
                                  ? String(source.expectedAmount)
                                  : "",
                              );
                              setEditSourceFrequency(
                                (source.frequency ||
                                  "monthly") as RecurrenceFrequency,
                              );
                              setEditSourceOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (demoMode || !householdId) {
                                deleteIncomeSourceLocal(source.id);
                                toast.success("Source deleted (demo)");
                              } else {
                                deleteSource.mutate(source.id, {
                                  onSuccess: () =>
                                    toast.success("Source deleted"),
                                  onError: () =>
                                    toast.error("Failed to delete"),
                                });
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit Source Dialog */}
        <Dialog open={editSourceOpen} onOpenChange={setEditSourceOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-bold">
                Edit Income Source
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSourceSave} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Name</Label>
                <Input
                  value={editSourceName}
                  onChange={(e) => setEditSourceName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Type</Label>
                  <Select
                    value={editSourceType}
                    onValueChange={setEditSourceType}
                  >
                    <SelectTrigger className="font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "salary",
                        "business",
                        "investment",
                        "freelance",
                        "gift",
                        "other",
                      ].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Expected Amount
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={editSourceExpected}
                      onChange={(e) => setEditSourceExpected(e.target.value)}
                      className="pl-7 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Frequency</Label>
                <Select
                  value={editSourceFrequency}
                  onValueChange={(v) =>
                    setEditSourceFrequency(v as RecurrenceFrequency)
                  }
                >
                  <SelectTrigger className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["monthly", "biweekly", "weekly", "yearly"].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="font-mono">
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="font-mono"
                  onClick={() => setEditSourceOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Entry Dialog */}
        <Dialog open={editEntryOpen} onOpenChange={setEditEntryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-bold">Edit Income Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditEntrySave} className="space-y-4">
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
                      value={editEntryAmount}
                      onChange={(e) => setEditEntryAmount(e.target.value)}
                      className="pl-7 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Date</Label>
                  <Input
                    type="date"
                    value={editEntryDate}
                    onChange={(e) => setEditEntryDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Notes</Label>
                <Input
                  value={editEntryNotes}
                  onChange={(e) => setEditEntryNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="font-mono">
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="font-mono"
                  onClick={() => setEditEntryOpen(false)}
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
};

export default HouseholdIncome;
