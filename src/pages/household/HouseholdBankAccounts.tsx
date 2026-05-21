import { useState } from "react";
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
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
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
import {
  useCreateBankAccountMutation,
  useUpdateBankAccountMutation,
  useDeleteBankAccountMutation,
} from "@/hooks/useHouseholdBudgetData";
import { toast } from "sonner";

const HouseholdBankAccounts = () => {
  const {
    budget,
    householdId,
    isLoading,
    error,
    addBankAccountLocal,
    updateBankAccountLocal,
    deleteBankAccountLocal,
  } = useHouseholdBudget();
  const { demoMode } = useDemoMode();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createAccount = useCreateBankAccountMutation(householdId);
  const updateAccount = useUpdateBankAccountMutation(householdId);
  const deleteAccount = useDeleteBankAccountMutation(householdId);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    ok: number;
    fail: number;
  }>({
    ok: 0,
    fail: 0,
  });

  // Add form state
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [currentBalance, setCurrentBalance] = useState("");
  const [calculatedBalance, setCalculatedBalance] = useState("");
  const [lastReconciled, setLastReconciled] = useState("");
  const [notes, setNotes] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cur = parseFloat(currentBalance || "0") || 0;
    const calc = parseFloat(calculatedBalance || "0") || 0;
    if (!name) {
      toast.error("Enter account name");
      return;
    }
    if (demoMode || !householdId) {
      addBankAccountLocal({
        name,
        type: type as any,
        currentBalance: cur,
        calculatedBalance: calc,
        lastReconciled: lastReconciled || "",
        isActive: true,
        notes: notes || undefined,
      });
      toast.success("Account added (demo)");
      setShowAddForm(false);
      setName("");
      setCurrentBalance("");
      setCalculatedBalance("");
      setLastReconciled("");
      setNotes("");
      return;
    }
    createAccount.mutate(
      {
        name,
        type,
        currentBalance: cur,
        calculatedBalance: calc,
        lastReconciled: lastReconciled || null,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast.success("Account added");
          setShowAddForm(false);
          setName("");
          setCurrentBalance("");
          setCalculatedBalance("");
          setLastReconciled("");
          setNotes("");
        },
        onError: () => toast.error("Failed to add account"),
      },
    );
  };

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("checking");
  const [editCurrent, setEditCurrent] = useState("");
  const [editCalculated, setEditCalculated] = useState("");
  const [editLastRecon, setEditLastRecon] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const openEdit = (id: string) => {
    const a = budget.bankAccounts.find((x) => x.id === id);
    if (!a) return;
    setEditingId(id);
    setEditName(a.name);
    setEditType(a.type);
    setEditCurrent(String(a.currentBalance));
    setEditCalculated(String(a.calculatedBalance));
    setEditLastRecon(a.lastReconciled || "");
    setEditNotes(a.notes || "");
    setEditOpen(true);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (demoMode || !householdId) {
      updateBankAccountLocal(editingId, {
        name: editName,
        type: editType as any,
        currentBalance: parseFloat(editCurrent || "0") || 0,
        calculatedBalance: parseFloat(editCalculated || "0") || 0,
        lastReconciled: editLastRecon || "",
        notes: editNotes || undefined,
      });
      toast.success("Account updated (demo)");
      setEditOpen(false);
      return;
    }
    updateAccount.mutate(
      {
        id: editingId,
        updates: {
          name: editName,
          type: editType,
          currentBalance: parseFloat(editCurrent || "0") || 0,
          calculatedBalance: parseFloat(editCalculated || "0") || 0,
          lastReconciled: editLastRecon || null,
          notes: editNotes || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Account updated");
          setEditOpen(false);
        },
        onError: () => toast.error("Failed to update account"),
      },
    );
  };

  const handleDelete = (id: string) => {
    const a = budget.bankAccounts.find((x) => x.id === id);
    if (!a) return;
    if (window.confirm(`Delete account "${a.name}"?`)) {
      if (demoMode || !householdId) {
        deleteBankAccountLocal(id);
        toast.success("Account deleted (demo)");
      } else {
        deleteAccount.mutate(id, {
          onSuccess: () => toast.success("Account deleted"),
          onError: () => toast.error("Failed to delete account"),
        });
      }
    }
  };

  const getReconciliationStatus = (
    account: (typeof budget.bankAccounts)[0],
  ) => {
    const difference = account.currentBalance - account.calculatedBalance;
    const percentDiff = Math.abs((difference / account.currentBalance) * 100);
    if (Math.abs(difference) < 0.01) return "perfect";
    if (percentDiff < 1) return "good";
    if (percentDiff < 5) return "warning";
    return "error";
  };

  const accountsWithStatus = budget.bankAccounts.map((account) => ({
    ...account,
    status: getReconciliationStatus(account),
    difference: account.currentBalance - account.calculatedBalance,
  }));

  const totalCurrentBalance = budget.bankAccounts
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const totalCalculatedBalance = budget.bankAccounts
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.calculatedBalance, 0);

  const totalDifference = totalCurrentBalance - totalCalculatedBalance;

  const accountsNeedingReconciliation = accountsWithStatus.filter(
    (a) => a.status === "warning" || a.status === "error",
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground font-mono">
          Loading accounts…
        </div>
      </DashboardLayout>
    );
  }
  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="border-2 border-destructive p-4 bg-card max-w-lg">
            <p className="font-bold mb-1">Failed to load accounts</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {demoMode && <DemoBanner />}
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900">
              Bank Accounts
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
              Track and reconcile your account balances
            </p>
          </div>
          <div className="flex gap-2">
            <CsvImportDialog
              trigger={
                <Button className="gap-2 w-full sm:w-auto" variant="outline">
                  <Upload className="h-4 w-4" />
                  Import CSV
                </Button>
              }
              title="Import Bank Accounts"
              template={{
                filename: "bank_accounts_template.csv",
                headers: [
                  "name",
                  "type",
                  "current_balance",
                  "calculated_balance",
                  "last_reconciled",
                ],
                sampleRows: [
                  ["Checking", "checking", "1200", "1200", "2025-01-10"],
                ],
              }}
              fields={[
                { key: "name", label: "Name" },
                { key: "type", label: "Type", optional: true },
                {
                  key: "current_balance",
                  label: "Current Balance",
                  type: "number",
                },
                {
                  key: "calculated_balance",
                  label: "Calculated Balance",
                  type: "number",
                  optional: true,
                },
                {
                  key: "last_reconciled",
                  label: "Last Reconciled",
                  type: "date",
                  optional: true,
                },
              ]}
              synonyms={{
                name: ["name", "account"],
                type: ["type", "accounttype"],
                current_balance: ["currentbalance", "current"],
                calculated_balance: ["calculatedbalance", "calculated"],
                last_reconciled: ["lastreconciled", "reconciled", "date"],
              }}
              storageKey="import:bank_accounts"
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
                    const type = (r.type || "checking").toString();
                    const current = Number(r.current_balance || 0) || 0;
                    const calculated = Number(r.calculated_balance || 0) || 0;
                    const last = (r.last_reconciled || "").toString() || "";
                    if (demoMode || !householdId) {
                      addBankAccountLocal({
                        name,
                        type: type as any,
                        currentBalance: current,
                        calculatedBalance: calculated,
                        lastReconciled: last,
                        isActive: true,
                      });
                    } else {
                      await createAccount.mutateAsync({
                        name,
                        type,
                        currentBalance: current,
                        calculatedBalance: calculated,
                        lastReconciled: last || null,
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
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-bold">New Account</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Name
                      </Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Checking"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Type
                      </Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["checking", "savings", "credit_card", "other"].map(
                            (t) => (
                              <SelectItem key={t} value={t}>
                                {t.replace("_", " ")}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Current Balance
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={currentBalance}
                          onChange={(e) => setCurrentBalance(e.target.value)}
                          className="pl-7 font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Calculated Balance
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={calculatedBalance}
                          onChange={(e) => setCalculatedBalance(e.target.value)}
                          className="pl-7 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Last Reconciled
                    </Label>
                    <Input
                      type="date"
                      value={lastReconciled}
                      onChange={(e) => setLastReconciled(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Notes</Label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes about this account..."
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Total Actual Balance
              </CardDescription>
              <CardTitle className="text-lg md:text-3xl text-green-600">
                ${totalCurrentBalance.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs md:text-sm text-gray-600">
                From bank statements
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Total Calculated Balance
              </CardDescription>
              <CardTitle className="text-lg md:text-3xl text-blue-600">
                ${totalCalculatedBalance.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs md:text-sm text-gray-600">
                From app tracking
              </p>
            </CardContent>
          </Card>

          <Card
            className={
              totalDifference !== 0 ? "border-yellow-500" : "border-green-500"
            }
          >
            <CardHeader className="pb-2">
              <CardDescription className="text-xs md:text-sm">
                Difference
              </CardDescription>
              <CardTitle
                className={`text-lg md:text-3xl ${
                  totalDifference === 0
                    ? "text-green-600"
                    : totalDifference > 0
                      ? "text-blue-600"
                      : "text-red-600"
                }`}
              >
                {totalDifference >= 0 ? "+" : ""}${totalDifference.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs md:text-sm text-gray-600">
                {Math.abs(totalDifference) < 0.01
                  ? "✓ Perfectly balanced"
                  : accountsNeedingReconciliation.length > 0
                    ? `⚠ ${accountsNeedingReconciliation.length} accounts need attention`
                    : "Minor variance"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Needing Reconciliation Alert */}
        {accountsNeedingReconciliation.length > 0 && (
          <Card className="border-yellow-500 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-5 w-5" />
                Accounts Need Reconciliation
              </CardTitle>
              <CardDescription>
                {accountsNeedingReconciliation.length} account(s) have
                significant differences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {accountsNeedingReconciliation.map((account) => (
                  <div
                    key={account.id}
                    className="flex justify-between items-center p-3 bg-white rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{account.name}</p>
                      <p className="text-sm text-gray-600">
                        Difference: ${Math.abs(account.difference).toFixed(2)}
                        {account.difference > 0 ? " more" : " less"} than
                        expected
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Reconcile Now
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Accounts List */}
        <Card>
          <CardHeader>
            <CardTitle>All Accounts</CardTitle>
            <CardDescription>
              View and manage your bank accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {budget.bankAccounts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No accounts added yet</p>
                <Button onClick={() => setShowAddForm(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {accountsWithStatus.map((account) => {
                  const statusConfig = {
                    perfect: {
                      color: "green",
                      icon: CheckCircle,
                      text: "Balanced",
                    },
                    good: {
                      color: "blue",
                      icon: CheckCircle,
                      text: "Minor variance",
                    },
                    warning: {
                      color: "yellow",
                      icon: AlertTriangle,
                      text: "Needs review",
                    },
                    error: {
                      color: "red",
                      icon: AlertTriangle,
                      text: "Urgent",
                    },
                  };

                  const config = statusConfig[account.status];
                  const StatusIcon = config.icon;

                  return (
                    <div
                      key={account.id}
                      className={`border rounded-lg p-4 ${
                        account.status === "perfect"
                          ? "border-green-300 bg-green-50"
                          : account.status === "good"
                            ? "border-blue-300 bg-blue-50"
                            : account.status === "warning"
                              ? "border-yellow-300 bg-yellow-50"
                              : "border-red-300 bg-red-50"
                      } ${!account.isActive ? "opacity-50" : ""}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">
                              {account.name}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium bg-${config.color}-200 text-${config.color}-800 flex items-center gap-1`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {config.text}
                            </span>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800 capitalize">
                              {account.type.replace("_", " ")}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                            <div>
                              <p className="text-gray-600 text-sm">
                                Actual Balance
                              </p>
                              <p className="font-semibold text-lg">
                                ${account.currentBalance.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-sm">
                                Calculated Balance
                              </p>
                              <p className="font-semibold text-lg">
                                ${account.calculatedBalance.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-sm">
                                Difference
                              </p>
                              <p
                                className={`font-semibold text-lg flex items-center gap-1 ${
                                  account.difference === 0
                                    ? "text-green-600"
                                    : account.difference > 0
                                      ? "text-blue-600"
                                      : "text-red-600"
                                }`}
                              >
                                {account.difference > 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : account.difference < 0 ? (
                                  <TrendingDown className="h-4 w-4" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                                {account.difference >= 0 ? "+" : ""}$
                                {account.difference.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-sm">
                                Last Reconciled
                              </p>
                              <p className="font-semibold text-sm">
                                {account.lastReconciled
                                  ? new Date(
                                      account.lastReconciled,
                                    ).toLocaleDateString()
                                  : "Never"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 text-sm">Status</p>
                              <p className="font-semibold text-sm capitalize">
                                {account.isActive ? "Active" : "Inactive"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(account.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(account.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-bold">Edit Account</DialogTitle>
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
                  <Label className="font-mono text-xs uppercase">Type</Label>
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger className="font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["checking", "savings", "credit_card", "other"].map(
                        (t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace("_", " ")}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Current Balance
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={editCurrent}
                      onChange={(e) => setEditCurrent(e.target.value)}
                      className="pl-7 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Calculated Balance
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={editCalculated}
                      onChange={(e) => setEditCalculated(e.target.value)}
                      className="pl-7 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">
                  Last Reconciled
                </Label>
                <Input
                  type="date"
                  value={editLastRecon}
                  onChange={(e) => setEditLastRecon(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Notes</Label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about this account..."
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Reconciliation Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
              <li>
                Reconcile accounts at least weekly to catch discrepancies early
              </li>
              <li>Check for pending transactions that haven't cleared yet</li>
              <li>
                Look for recurring subscriptions or bills you may have forgotten
                to log
              </li>
              <li>Verify all expense categories are accurately recorded</li>
              <li>Contact your bank if you notice unauthorized transactions</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default HouseholdBankAccounts;
