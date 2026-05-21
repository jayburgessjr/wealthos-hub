import DashboardLayout from "@/components/layout/DashboardLayout";
import { DemoBanner } from "@/components/household/layout/DemoBanner";
import { useDemoMode } from "@/hooks/useHouseholdDemoMode";
import { InviteMemberForm } from "@/components/household/household/InviteMemberForm";
import { EmailPreferencesCard } from "@/components/household/settings/EmailPreferencesCard";
import { CustomizationCard } from "@/components/household/settings/CustomizationCard";
import { DashboardSettingsCard } from "@/components/household/settings/DashboardSettingsCard";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useAuth } from "@/components/AuthProvider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useEffect, useState, useMemo } from "react";
import {
  fetchInvitationsForHousehold,
  listUserHouseholds,
  switchActiveHousehold,
  fetchHouseholdMembers,
  updateMemberRole,
  removeMemberFromHousehold,
  fetchHousehold,
} from "@/integrations/supabase/household-queries";
import { useUpdateHouseholdMutation } from "@/hooks/useHouseholdBudgetData";
import { toast } from "sonner";
import {
  Search,
  FileText,
  DollarSign,
  Receipt,
  CreditCard,
  Wallet,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/household-format";
import { aiRequest } from "@/services/householdAiService";

type NoteSource = "bill" | "expense" | "income" | "subscription" | "account";

interface NoteItem {
  id: string;
  source: NoteSource;
  sourceLabel: string;
  name: string;
  notes: string;
  amount?: number;
  date?: string;
  icon: React.ReactNode;
}

export default function HouseholdSettings() {
  const { user } = useAuth();
  const { householdId, budget } = useHouseholdBudget();
  const { demoMode } = useDemoMode();
  const [invites, setInvites] = useState<any[]>([]);
  const [households, setHouseholds] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [members, setMembers] = useState<
    { id: string; email: string; name: string; role: string }[]
  >([]);

  // Household edit state
  const [householdName, setHouseholdName] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [expectedMonthlyIncome, setExpectedMonthlyIncome] = useState("");
  const [subscriptionBudget, setSubscriptionBudget] = useState("");
  const [billsBudget, setBillsBudget] = useState("");
  const [expensesBudget, setExpensesBudget] = useState("");
  const [editing, setEditing] = useState(false);

  // Notes state
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<NoteSource | "all">("all");
  const [aiSuggestions, setAiSuggestions] = useState<string>("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const updateHousehold = useUpdateHouseholdMutation(householdId, budget.month);

  useEffect(() => {
    if (!householdId) return;
    fetchInvites();
    loadHouseholdDetails();
  }, [householdId]);

  useEffect(() => {
    if (!user) return;
    listUserHouseholds(user.id)
      .then(setHouseholds)
      .catch(() => {});
  }, [user]);

  async function loadHouseholdDetails() {
    if (!householdId) return;
    try {
      const data = await fetchHousehold(householdId);
      if (data) {
        setHouseholdName(data.name);
        setMonthlyIncome(String(data.monthly_income));
        setExpectedMonthlyIncome(String(data.expected_monthly_income ?? 0));
        setSubscriptionBudget(String(data.subscription_budget ?? 0));
        setBillsBudget(String(data.bills_budget ?? 0));
        setExpensesBudget(String(data.expenses_budget ?? 0));
      }
    } catch {}
  }

  async function fetchInvites() {
    if (!householdId) return;
    try {
      const rows = await fetchInvitationsForHousehold(householdId);
      setInvites(rows);
    } catch {}
  }

  useEffect(() => {
    if (!householdId) return;
    fetchMembers();
  }, [householdId]);

  async function fetchMembers() {
    if (!householdId) return;
    try {
      const rows = await fetchHouseholdMembers(householdId);
      setMembers(rows);
    } catch {}
  }

  async function onSwitch(hid: string) {
    if (!user) return;
    try {
      await switchActiveHousehold(user.id, hid);
      toast.success("Switched household");
      window.location.reload();
    } catch {
      toast.error("Failed to switch household");
    }
  }

  async function handleSaveHousehold(e: React.FormEvent) {
    e.preventDefault();
    if (demoMode || !householdId) {
      toast.success("Household updated (demo)");
      setEditing(false);
      return;
    }
    const income = parseFloat(monthlyIncome);
    if (isNaN(income)) {
      toast.error("Please enter a valid income");
      return;
    }
    updateHousehold.mutate(
      {
        name: householdName,
        monthlyIncome: income,
        expectedMonthlyIncome: parseFloat(expectedMonthlyIncome) || 0,
        subscriptionBudget: parseFloat(subscriptionBudget) || 0,
        billsBudget: parseFloat(billsBudget) || 0,
        expensesBudget: parseFloat(expensesBudget) || 0,
      },
      {
        onSuccess: () => {
          toast.success("Household updated");
          setEditing(false);
        },
        onError: () => toast.error("Failed to update household"),
      },
    );
  }

  // Notes logic
  const allNotes = useMemo(() => {
    const notes: NoteItem[] = [];

    budget.bills.forEach((bill) => {
      if (bill.notes) {
        notes.push({
          id: `bill-${bill.id}`,
          source: "bill",
          sourceLabel: "Bill",
          name: bill.name,
          notes: bill.notes,
          amount: bill.amount,
          date: bill.dueDate,
          icon: <Receipt className="h-4 w-4" />,
        });
      }
    });

    budget.expenses.forEach((expense) => {
      if (expense.description) {
        const category = budget.categories.find(
          (c) => c.id === expense.categoryId,
        );
        notes.push({
          id: `expense-${expense.id}`,
          source: "expense",
          sourceLabel: "Expense",
          name: expense.description || category?.name || "Expense",
          notes: expense.description,
          amount: expense.amount,
          date: expense.date,
          icon: <DollarSign className="h-4 w-4" />,
        });
      }
    });

    budget.subscriptions.forEach((sub) => {
      if ((sub as any).notes) {
        notes.push({
          id: `sub-${sub.id}`,
          source: "subscription",
          sourceLabel: "Subscription",
          name: sub.name,
          notes: (sub as any).notes,
          amount: sub.amount,
          date: sub.nextDate,
          icon: <RefreshCw className="h-4 w-4" />,
        });
      }
    });

    budget.bankAccounts.forEach((account) => {
      if ((account as any).notes) {
        notes.push({
          id: `account-${account.id}`,
          source: "account",
          sourceLabel: "Account",
          name: account.name,
          notes: (account as any).notes,
          amount: account.currentBalance,
          icon: <Wallet className="h-4 w-4" />,
        });
      }
    });

    return notes;
  }, [budget]);

  const filteredNotes = useMemo(() => {
    return allNotes.filter((note) => {
      const matchesSource =
        sourceFilter === "all" || note.source === sourceFilter;
      const matchesSearch =
        searchQuery === "" ||
        note.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.notes.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSource && matchesSearch;
    });
  }, [allNotes, sourceFilter, searchQuery]);

  const handleGetAISuggestions = async () => {
    setIsLoadingAI(true);
    try {
      const notesContext = allNotes.map((n) => ({
        source: n.sourceLabel,
        name: n.name,
        notes: n.notes,
        amount: n.amount,
      }));

      const billsData = budget.bills.map((b) => ({
        name: b.name,
        amount: b.amount,
        dueDate: b.dueDate,
        status: b.paymentStatus,
        isAutoPay: b.isAutoPay,
      }));

      const result = await aiRequest("note_suggestions", {
        existingNotes: notesContext,
        bills: billsData,
        totalBills: budget.bills.length,
        totalExpenses: budget.expenses.length,
        totalSubscriptions: budget.subscriptions.length,
      });
      setAiSuggestions(result);
    } catch (error) {
      console.error("AI suggestion error:", error);
      toast.error("Failed to get AI suggestions");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const sourceColors: Record<NoteSource, string> = {
    bill: "bg-amber-100 text-amber-800 border-amber-200",
    expense: "bg-blue-100 text-blue-800 border-blue-200",
    income: "bg-green-100 text-green-800 border-green-200",
    subscription: "bg-purple-100 text-purple-800 border-purple-200",
    account: "bg-slate-100 text-slate-800 border-slate-200",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {demoMode && <DemoBanner />}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Household Settings</h1>
          <p className="text-muted-foreground font-mono text-xs md:text-sm mt-1">
            Manage your household and invite members
          </p>
        </div>

        {/* Household Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Household Details</CardTitle>
            <CardDescription>
              Update your household name and monthly income
            </CardDescription>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={handleSaveHousehold} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Household Name
                    </Label>
                    <Input
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      placeholder="My Household"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Monthly Income
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                        className="pl-7 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-mono text-sm font-semibold mb-3">
                    Budget Thresholds (for KPI colors)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Expected Monthly Income
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={expectedMonthlyIncome}
                          onChange={(e) =>
                            setExpectedMonthlyIncome(e.target.value)
                          }
                          className="pl-7 font-mono"
                          placeholder="0"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Green if income exceeds this, red if under
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Subscription Budget
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={subscriptionBudget}
                          onChange={(e) =>
                            setSubscriptionBudget(e.target.value)
                          }
                          className="pl-7 font-mono"
                          placeholder="0"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Green if under, red if over
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Bills Budget
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={billsBudget}
                          onChange={(e) => setBillsBudget(e.target.value)}
                          className="pl-7 font-mono"
                          placeholder="0"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Green if under, red if over
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Expenses Budget
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={expensesBudget}
                          onChange={(e) => setExpensesBudget(e.target.value)}
                          className="pl-7 font-mono"
                          placeholder="0"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Green if under, red if over
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="font-mono"
                    disabled={updateHousehold.isPending}
                  >
                    {updateHousehold.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="font-mono"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-mono uppercase text-muted-foreground">
                      Household Name
                    </p>
                    <p className="font-medium">{householdName || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase text-muted-foreground">
                      Monthly Income
                    </p>
                    <p className="font-mono font-bold">
                      ${Number(monthlyIncome || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-mono text-sm font-semibold mb-3">
                    Budget Thresholds
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs font-mono uppercase text-muted-foreground">
                        Expected Income
                      </p>
                      <p className="font-mono font-bold">
                        ${Number(expectedMonthlyIncome || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-mono uppercase text-muted-foreground">
                        Subscriptions
                      </p>
                      <p className="font-mono font-bold">
                        ${Number(subscriptionBudget || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-mono uppercase text-muted-foreground">
                        Bills
                      </p>
                      <p className="font-mono font-bold">
                        ${Number(billsBudget || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-mono uppercase text-muted-foreground">
                        Expenses
                      </p>
                      <p className="font-mono font-bold">
                        ${Number(expensesBudget || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="font-mono"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customization Card */}
        <CustomizationCard />

        {/* Dashboard Settings Card */}
        <DashboardSettingsCard />

        {/* Email Preferences Card */}
        <EmailPreferencesCard
          userId={user?.id}
          userEmail={user?.email}
          householdId={householdId}
          demoMode={demoMode}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Invite Member</CardTitle>
              <CardDescription>Generate an invitation link</CardDescription>
            </CardHeader>
            <CardContent>
              <InviteMemberForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invitations</CardTitle>
              <CardDescription>Pending and recent invites</CardDescription>
            </CardHeader>
            <CardContent>
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No invitations yet
                </p>
              ) : (
                <div className="space-y-2">
                  {invites.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between border p-3"
                    >
                      <div>
                        <p className="font-medium">{i.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.status} • {new Date(i.created_at).toLocaleString()}
                        </p>
                      </div>
                      {i.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(
                                `${window.location.origin}/invite/${i.token}`,
                              )
                              .then(() => toast.success("Link copied"))
                          }
                        >
                          Copy Link
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Households</CardTitle>
            <CardDescription>Switch active household</CardDescription>
          </CardHeader>
          <CardContent>
            {households.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Only one household
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {households.map((h) => (
                  <Button
                    key={h.id}
                    variant={h.id === householdId ? "default" : "outline"}
                    size="sm"
                    onClick={() => onSwitch(h.id)}
                  >
                    {h.name} ({h.role})
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage roles and remove members</CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No members in this household
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between border p-3"
                  >
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={m.role === "owner" ? "default" : "outline"}
                        size="sm"
                        onClick={async () => {
                          if (!householdId) return;
                          await updateMemberRole(m.id, householdId, "owner");
                          toast.success("Role updated");
                          fetchMembers();
                        }}
                      >
                        Owner
                      </Button>
                      <Button
                        variant={m.role === "member" ? "default" : "outline"}
                        size="sm"
                        onClick={async () => {
                          if (!householdId) return;
                          await updateMemberRole(m.id, householdId, "member");
                          toast.success("Role updated");
                          fetchMembers();
                        }}
                      >
                        Member
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (!householdId) return;
                          if (!confirm(`Remove ${m.name}?`)) return;
                          await removeMemberFromHousehold(m.id, householdId);
                          toast.success("Member removed");
                          fetchMembers();
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Section */}
        <div className="border-t-4 border-border pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Notes & Insights
              </h2>
              <p className="text-muted-foreground font-mono text-xs md:text-sm mt-1">
                All notes from bills, expenses, subscriptions, and accounts
              </p>
            </div>
            <Button
              onClick={handleGetAISuggestions}
              disabled={isLoadingAI}
              className="font-mono"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isLoadingAI ? "Analyzing..." : "AI Suggestions"}
            </Button>
          </div>

          {aiSuggestions && (
            <Card className="border-2 border-primary/20 bg-primary/5 mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Powered Insights
                </CardTitle>
                <CardDescription>
                  Based on your financial notes and patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                  {aiSuggestions}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 font-mono"
              />
            </div>
            <Select
              value={sourceFilter}
              onValueChange={(v) => setSourceFilter(v as NoteSource | "all")}
            >
              <SelectTrigger className="w-[180px] font-mono">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="bill">Bills</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="subscription">Subscriptions</SelectItem>
                <SelectItem value="account">Accounts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">
                  Total Notes
                </CardDescription>
                <CardTitle className="text-xl font-mono">
                  {allNotes.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">
                  Bill Notes
                </CardDescription>
                <CardTitle className="text-xl font-mono">
                  {allNotes.filter((n) => n.source === "bill").length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">
                  Expense Notes
                </CardDescription>
                <CardTitle className="text-xl font-mono">
                  {allNotes.filter((n) => n.source === "expense").length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">
                  Other Notes
                </CardDescription>
                <CardTitle className="text-xl font-mono">
                  {
                    allNotes.filter(
                      (n) =>
                        n.source === "subscription" || n.source === "account",
                    ).length
                  }
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>All Notes ({filteredNotes.length})</CardTitle>
              <CardDescription>
                {searchQuery || sourceFilter !== "all"
                  ? `Filtered from ${allNotes.length} total notes`
                  : "Notes across all your financial records"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredNotes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No notes found</p>
                  <p className="text-sm">
                    {allNotes.length === 0
                      ? "Add notes to your bills, expenses, subscriptions, or accounts to see them here"
                      : "Try adjusting your search or filter"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      className="border-2 border-border p-4 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 bg-muted rounded-md">
                            {note.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium">{note.name}</h3>
                              <Badge
                                variant="outline"
                                className={sourceColors[note.source]}
                              >
                                {note.sourceLabel}
                              </Badge>
                            </div>
                            <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">
                              {note.notes}
                            </p>
                            {(note.amount !== undefined || note.date) && (
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono">
                                {note.amount !== undefined && (
                                  <span>{formatCurrency(note.amount)}</span>
                                )}
                                {note.date && (
                                  <span>
                                    {new Date(note.date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
