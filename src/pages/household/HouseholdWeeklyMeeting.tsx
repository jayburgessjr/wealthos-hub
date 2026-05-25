import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TabNav from "@/components/layout/TabNav";
import { DemoBanner } from "@/components/household/layout/DemoBanner";
import { useDemoMode } from "@/hooks/useHouseholdDemoMode";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Heart,
  DollarSign,
  CreditCard,
  Target,
  TrendingUp,
  Landmark,
  Calendar,
  Sparkles,
  Trophy,
  Plus,
  ListTodo,
} from "lucide-react";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateIncomeEntryMutation,
  useUpdateBillMutation,
  useUpdateBankAccountMutation,
  useCreateCreditScoreMutation,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useUpdateTaskPositionsMutation,
  useCreateWeeklySummaryMutation,
  useUpdateSubscriptionMutation,
} from "@/hooks/useHouseholdBudgetData";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard } from "@/components/household/tasks/KanbanBoard";
import { TaskStatus } from "@/integrations/supabase/household-types";
import { getAssigneeColor } from "@/components/household/tasks/TaskCard";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Step =
  | "welcome"
  | "bills"
  | "income"
  | "expenses"
  | "goals"
  | "credit"
  | "reconciliation"
  | "todos"
  | "summary";

const HouseholdWeeklyMeeting = () => {
  const { budget, householdId, addExpense, updateGoal } = useHouseholdBudget();
  const { demoMode } = useDemoMode();
  const { user } = useAuth();
  const updateBill = useUpdateBillMutation(householdId);
  const updateSubscription = useUpdateSubscriptionMutation(householdId);
  const createIncomeEntry = useCreateIncomeEntryMutation(
    householdId,
    user?.id ?? null,
    budget.month,
  );
  const updateAccount = useUpdateBankAccountMutation(householdId);
  const createScore = useCreateCreditScoreMutation(householdId);
  const createTask = useCreateTaskMutation(householdId, user?.id ?? null);
  const updateTaskPositions = useUpdateTaskPositionsMutation(householdId);
  const { mutate: createWeeklySummary } =
    useCreateWeeklySummaryMutation(householdId);
  const navigate = useNavigate();

  // Storage key for this wizard
  const STORAGE_KEY = "weekly-meeting-progress";

  // Initialize state from localStorage or defaults
  const getInitialStep = (): Step => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.currentStep || "welcome";
      }
    } catch {}
    return "welcome";
  };

  const getInitialSessionData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return (
          parsed.sessionData || {
            billsReviewed: [],
            incomeLogged: [],
            expensesLogged: [],
            subscriptionsPaid: [],
            goalsUpdated: false,
            creditScoresUpdated: false,
            accountsReconciled: false,
            notes: "",
          }
        );
      }
    } catch {}
    return {
      billsReviewed: [] as string[],
      incomeLogged: [] as any[],
      expensesLogged: [] as any[],
      subscriptionsPaid: [] as string[],
      goalsUpdated: false,
      creditScoresUpdated: false,
      accountsReconciled: false,
      notes: "",
    };
  };

  const [currentStep, setCurrentStep] = useState<Step>(getInitialStep);
  const [sessionData, setSessionData] = useState(getInitialSessionData);

  // Optimistic UI: track subscriptions that have been paid this session
  const [paidSubscriptionIds, setPaidSubscriptionIds] = useState<Set<string>>(
    new Set(),
  );

  // Auto-save to localStorage on step or session data change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentStep,
          sessionData,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {}
  }, [currentStep, sessionData]);

  // Clear localStorage on successful completion
  const clearWizardProgress = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Track initial state to calculate session changes
  const initialExpenseIds = useRef<Set<string>>(new Set());
  const initialIncomeIds = useRef<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized && budget.expenses.length > 0) {
      initialExpenseIds.current = new Set(budget.expenses.map((e) => e.id));
      initialIncomeIds.current = new Set(budget.incomeEntries.map((e) => e.id));
      setIsInitialized(true);
    }
  }, [budget.expenses, budget.incomeEntries, isInitialized]);

  // Calculate session metrics
  const newExpenses = budget.expenses.filter(
    (e) => !initialExpenseIds.current.has(e.id),
  );
  const newIncome = budget.incomeEntries.filter(
    (e) => !initialIncomeIds.current.has(e.id),
  );

  // Build a list of household members from tasks and expenses
  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    budget.tasks.forEach((t) => {
      if (t.createdBy && t.createdByName) map.set(t.createdBy, t.createdByName);
      if (t.assignedTo && t.assignedToName)
        map.set(t.assignedTo, t.assignedToName);
    });
    budget.expenses.forEach((e) => {
      if (e.userId && e.userName) map.set(e.userId, e.userName);
    });
    return map;
  }, [budget.tasks, budget.expenses]);
  const householdMembers = useMemo(
    () => Array.from(memberMap.entries()).map(([id, name]) => ({ id, name })),
    [memberMap],
  );

  const steps: { id: Step; label: string; icon: any }[] = [
    { id: "welcome", label: "Welcome", icon: Heart },
    { id: "bills", label: "Bills", icon: CreditCard },
    { id: "income", label: "Income", icon: DollarSign },
    { id: "expenses", label: "Expenses", icon: Calendar },
    { id: "goals", label: "Goals", icon: Target },
    { id: "credit", label: "Credit Scores", icon: TrendingUp },
    { id: "reconciliation", label: "Accounts", icon: Landmark },
    { id: "todos", label: "Todos", icon: CheckCircle },
    { id: "summary", label: "Summary", icon: Sparkles },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  // Get upcoming and overdue bills for the next two weeks (including overdue)
  const upcomingBills = budget.bills.filter((bill) => {
    if (bill.isActive === false) return false;
    if (bill.paymentStatus === "paid") return false;
    const dueDate = new Date(bill.dueDate);
    const today = new Date();
    const daysUntil = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysUntil <= 14;
  });

  // Get upcoming and overdue subscriptions for the next two weeks
  const upcomingSubscriptions = budget.subscriptions.filter((sub) => {
    if (paidSubscriptionIds.has(sub.id)) return false;
    const nextDate = new Date(sub.nextDate);
    const today = new Date();
    const daysUntil = Math.ceil(
      (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysUntil <= 14;
  });

  // Combine bills and subscriptions into a unified list
  type PaymentItem = {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    type: "bill" | "subscription";
    paymentStatus?: string;
    amountPaid?: number;
    paymentAccountId?: string | null;
    notes?: string | null;
    isOverdue: boolean;
    daysUntil: number;
    isAutoPay?: boolean;
  };

  const allPaymentItems: PaymentItem[] = [
    ...upcomingBills.map((bill) => {
      const dueDate = new Date(bill.dueDate);
      const today = new Date();
      const daysUntil = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: bill.id,
        name: bill.name,
        amount: bill.amount,
        dueDate: bill.dueDate,
        type: "bill" as const,
        paymentStatus: bill.paymentStatus,
        amountPaid: bill.amountPaid,
        paymentAccountId: bill.paymentAccountId,
        notes: bill.notes,
        isOverdue: daysUntil < 0,
        daysUntil,
        isAutoPay: bill.isAutoPay,
      };
    }),
    ...upcomingSubscriptions.map((sub) => {
      const nextDate = new Date(sub.nextDate);
      const today = new Date();
      const daysUntil = Math.ceil(
        (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: sub.id,
        name: sub.name,
        amount: sub.amount,
        dueDate: sub.nextDate,
        type: "subscription" as const,
        paymentStatus: undefined,
        amountPaid: 0,
        paymentAccountId: sub.paymentAccountId,
        notes: sub.notes,
        isOverdue: daysUntil < 0,
        daysUntil,
        isAutoPay: sub.isAutoPay,
      };
    }),
  ].sort((a, b) => a.daysUntil - b.daysUntil);

  // Get expected income sources
  const expectedIncome = budget.incomeSources.filter(
    (source) => source.isActive,
  );

  // Get current month stats
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyIncome = budget.incomeEntries
    .filter((e) => e.date.startsWith(currentMonth))
    .reduce((sum, e) => sum + e.amount, 0);
  const monthlyExpenses = budget.categories.reduce(
    (sum, cat) => sum + cat.spent,
    0,
  );

  const renderWelcomeStep = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="text-center space-y-3 md:space-y-4">
        <div className="mx-auto w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
          <Heart className="h-8 w-8 md:h-10 md:w-10 text-white" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold px-4">
          Welcome to Your Weekly Finance Meeting
        </h2>
        <p className="text-sm md:text-lg text-gray-600 px-4">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mind, Body & Soul Financial Health</CardTitle>
          <CardDescription>
            Let's review your financial wellness together
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">This Month's Income</p>
              <p className="text-2xl font-bold text-green-600">
                ${monthlyIncome.toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">This Month's Expenses</p>
              <p className="text-2xl font-bold text-blue-600">
                ${monthlyExpenses.toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Net Savings</p>
              <p
                className={`text-2xl font-bold ${monthlyIncome - monthlyExpenses >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                ${(monthlyIncome - monthlyExpenses).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">What we'll cover today:</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  Review {allPaymentItems.length} bills & subscriptions
                  {allPaymentItems.some((i) => i.isOverdue) && (
                    <span className="text-red-600 font-medium ml-1">
                      ({allPaymentItems.filter((i) => i.isOverdue).length}{" "}
                      overdue)
                    </span>
                  )}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Log income received this week</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Quick expense review</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Check progress on {budget.goals.length} goals</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Update credit scores</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Reconcile bank accounts</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // State for defer confirmation and paid animations
  const [deferConfirm, setDeferConfirm] = useState<string | null>(null);
  const [partialBillId, setPartialBillId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const [paidAnimations, setPaidAnimations] = useState<Set<string>>(new Set());

  const handleDeferBill = (billId: string) => {
    if (demoMode) {
      toast.info("Demo mode: connect a household to save.");
      return;
    }
    const bill = budget.bills.find((b) => b.id === billId);
    if (!bill) return;
    const newDate = new Date(bill.dueDate);
    newDate.setDate(newDate.getDate() + 7);
    updateBill.mutate(
      { id: billId, updates: { dueDate: newDate.toISOString().slice(0, 10) } },
      {
        onSuccess: () => {
          toast.success("Bill deferred by 7 days");
          setDeferConfirm(null);
        },
        onError: () => toast.error("Failed to defer"),
      },
    );
  };

  const handleMarkPaid = (billId: string, bill: any) => {
    if (demoMode) {
      toast.info("Demo mode: connect a household to save.");
      return;
    }
    setPaidAnimations((prev) => new Set(prev).add(billId));
    setTimeout(
      () =>
        setPaidAnimations((prev) => {
          const n = new Set(prev);
          n.delete(billId);
          return n;
        }),
      600,
    );
    updateBill.mutate(
      {
        id: billId,
        updates: { paymentStatus: "paid", amountPaid: bill.amount },
      },
      {
        onSuccess: () => {
          toast.success("Bill marked as paid!");
          setSessionData((prev) => ({
            ...prev,
            billsReviewed: [...prev.billsReviewed, billId],
          }));
        },
        onError: () => toast.error("Failed to update bill"),
      },
    );
  };

  const handlePartialPaid = () => {
    if (!partialBillId) return;
    const amt = parseFloat(partialAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter valid amount");
      return;
    }

    const bill = budget.bills.find((b) => b.id === partialBillId);
    if (!bill) return;

    const newPaid = (bill.amountPaid ?? 0) + amt;
    const target = bill.amount ?? 0;
    const status: any =
      newPaid >= target ? "paid" : newPaid > 0 ? "partial" : "unpaid";

    updateBill.mutate(
      {
        id: partialBillId,
        updates: { paymentStatus: status, amountPaid: newPaid },
      },
      {
        onSuccess: () => {
          toast.success("Partial payment logged");
          setPartialBillId(null);
          setPartialAmount("");
          setSessionData((prev) => ({
            ...prev,
            billsReviewed: [...prev.billsReviewed, partialBillId],
          }));
        },
        onError: () => toast.error("Failed to update bill"),
      },
    );
  };

  const renderBillsStep = () => (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">
          Bills & Subscriptions
        </h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Review overdue and upcoming payments
        </p>
      </div>

      {allPaymentItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-semibold">No payments due!</p>
            <p className="text-gray-600">You're all caught up.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allPaymentItems.some((item) => item.isOverdue) && (
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30 mb-4">
              <p className="text-sm font-semibold text-red-600">
                ⚠️ {allPaymentItems.filter((i) => i.isOverdue).length} overdue
                payment(s) need attention
              </p>
            </div>
          )}

          {allPaymentItems.map((item) => {
            const paymentAccount = budget.bankAccounts.find(
              (a) => a.id === item.paymentAccountId,
            );
            const isBill = item.type === "bill";

            return (
              <Card
                key={`${item.type}-${item.id}`}
                className={`border-2 transition-all duration-300 ${
                  paidAnimations.has(item.id)
                    ? "bg-green-50 scale-[1.02] border-green-500"
                    : item.isOverdue
                      ? "border-red-500/50 bg-red-500/5"
                      : ""
                }`}
              >
                <CardContent className="pt-4 md:pt-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base md:text-lg font-semibold">
                            {item.name}
                          </h3>
                          <Badge
                            variant={isBill ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {isBill ? "Bill" : "Subscription"}
                          </Badge>
                          {item.isAutoPay && (
                            <Badge variant="outline" className="text-xs gap-1">
                              ⚡ Auto-Pay
                            </Badge>
                          )}
                          {item.isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs md:text-sm text-gray-600">
                          {item.isOverdue ? "Was due" : "Due"}:{" "}
                          {new Date(item.dueDate).toLocaleDateString()} • $
                          {item.amount.toFixed(2)}
                          {item.isOverdue && (
                            <span className="text-red-600 font-medium ml-1">
                              ({Math.abs(item.daysUntil)} days overdue)
                            </span>
                          )}
                        </p>
                        {item.notes && (
                          <p className="text-xs md:text-sm text-gray-500 italic mt-1">
                            {item.notes}
                          </p>
                        )}

                        <div className="mt-2 text-sm">
                          {paymentAccount ? (
                            <div className="flex items-center text-muted-foreground">
                              <span className="mr-1">Paying from:</span>
                              <span className="font-medium text-foreground">
                                {paymentAccount.name}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-yellow-600 text-xs font-semibold">
                                Missing Account
                              </span>
                              <Select
                                onValueChange={(val) => {
                                  if (demoMode) {
                                    toast.info(
                                      "Demo mode: connect a household to save.",
                                    );
                                    return;
                                  }
                                  if (isBill) {
                                    updateBill.mutate({
                                      id: item.id,
                                      updates: { paymentAccountId: val },
                                    });
                                  } else {
                                    updateSubscription.mutate({
                                      id: item.id,
                                      updates: { paymentAccountId: val },
                                    });
                                  }
                                  toast.success("Payment account updated");
                                }}
                              >
                                <SelectTrigger className="h-7 w-[180px] text-xs">
                                  <SelectValue placeholder="Select account..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {budget.bankAccounts.map((account) => (
                                    <SelectItem
                                      key={account.id}
                                      value={account.id}
                                    >
                                      {account.name} ($
                                      {account.currentBalance.toFixed(2)})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {isBill ? (
                        <>
                          <Button
                            size="sm"
                            variant={
                              item.paymentStatus === "paid"
                                ? "default"
                                : "outline"
                            }
                            className={`${item.paymentStatus === "paid" ? "bg-green-600 hover:bg-green-700" : ""} ${paidAnimations.has(item.id) ? "animate-scale-in" : ""}`}
                            onClick={() => handleMarkPaid(item.id, item)}
                            disabled={item.paymentStatus === "paid"}
                          >
                            {paidAnimations.has(item.id) ? (
                              <CheckCircle className="h-4 w-4 mr-1 animate-scale-in" />
                            ) : null}
                            {item.paymentStatus === "paid"
                              ? "Paid ✓"
                              : "Mark Paid"}
                          </Button>

                          {deferConfirm === item.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                Defer 7 days?
                              </span>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeferBill(item.id)}
                              >
                                Yes
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeferConfirm(null)}
                              >
                                No
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeferConfirm(item.id)}
                            >
                              Defer
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPartialBillId(item.id);
                              setPartialAmount(
                                String(item.amount - (item.amountPaid ?? 0)),
                              );
                            }}
                          >
                            Partial
                          </Button>
                        </>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {item.isAutoPay && (
                            <Button
                              size="sm"
                              variant="default"
                              className={
                                paidAnimations.has(item.id)
                                  ? "animate-scale-in"
                                  : ""
                              }
                              onClick={() => {
                                if (demoMode) {
                                  toast.info(
                                    "Demo mode: connect a household to save.",
                                  );
                                  return;
                                }
                                const sub = budget.subscriptions.find(
                                  (s) => s.id === item.id,
                                );
                                if (!sub) return;
                                if (!sub.paymentAccountId) {
                                  toast.error(
                                    "Please select a payment account first",
                                  );
                                  return;
                                }
                                const categoryId =
                                  sub.categoryId || budget.categories[0]?.id;
                                if (!categoryId) {
                                  toast.error("No categories found.");
                                  return;
                                }
                                addExpense({
                                  amount: sub.amount,
                                  categoryId,
                                  date: new Date().toISOString().slice(0, 10),
                                  description: `${sub.name} autopay confirmed`,
                                  linkedSubscriptionId: sub.id,
                                  expenseType: "subscription",
                                });
                                const months =
                                  sub.frequency === "annual" ? 12 : 1;
                                const currentNext = new Date(sub.nextDate);
                                currentNext.setMonth(
                                  currentNext.getMonth() + months,
                                );
                                updateSubscription.mutate({
                                  id: sub.id,
                                  updates: {
                                    nextDate: currentNext
                                      .toISOString()
                                      .slice(0, 10),
                                  },
                                });
                                setSessionData((prev) => ({
                                  ...prev,
                                  subscriptionsPaid: [
                                    ...(prev.subscriptionsPaid || []),
                                    sub.id,
                                  ],
                                }));
                                setPaidSubscriptionIds((prev) =>
                                  new Set(prev).add(sub.id),
                                );
                                toast.success("Autopay confirmed!");
                                setPaidAnimations((prev) =>
                                  new Set(prev).add(item.id),
                                );
                                setTimeout(
                                  () =>
                                    setPaidAnimations((prev) => {
                                      const n = new Set(prev);
                                      n.delete(item.id);
                                      return n;
                                    }),
                                  600,
                                );
                              }}
                            >
                              ⚡ Confirm Autopay
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (demoMode) {
                                toast.info(
                                  "Demo mode: connect a household to save.",
                                );
                                return;
                              }
                              const sub = budget.subscriptions.find(
                                (s) => s.id === item.id,
                              );
                              if (!sub) return;
                              if (!sub.paymentAccountId) {
                                toast.error(
                                  "Please select a payment account first",
                                );
                                return;
                              }
                              const categoryId =
                                sub.categoryId || budget.categories[0]?.id;
                              if (!categoryId) {
                                toast.error("No categories found.");
                                return;
                              }
                              addExpense({
                                amount: sub.amount,
                                categoryId,
                                date: new Date().toISOString().slice(0, 10),
                                description: `${sub.name} subscription payment`,
                                linkedSubscriptionId: sub.id,
                                expenseType: "subscription",
                              });
                              const months =
                                sub.frequency === "annual" ? 12 : 1;
                              const currentNext = new Date(sub.nextDate);
                              currentNext.setMonth(
                                currentNext.getMonth() + months,
                              );
                              updateSubscription.mutate({
                                id: sub.id,
                                updates: {
                                  nextDate: currentNext
                                    .toISOString()
                                    .slice(0, 10),
                                },
                              });
                              setSessionData((prev) => ({
                                ...prev,
                                subscriptionsPaid: [
                                  ...(prev.subscriptionsPaid || []),
                                  sub.id,
                                ],
                              }));
                              setPaidSubscriptionIds((prev) =>
                                new Set(prev).add(sub.id),
                              );
                              toast.success("Subscription payment logged!");
                              setPaidAnimations((prev) =>
                                new Set(prev).add(item.id),
                              );
                              setTimeout(
                                () =>
                                  setPaidAnimations((prev) => {
                                    const n = new Set(prev);
                                    n.delete(item.id);
                                    return n;
                                  }),
                                600,
                              );
                            }}
                          >
                            Log Payment
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!partialBillId}
        onOpenChange={(open) => !open && setPartialBillId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Partial Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Amount Paid Today</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handlePartialPaid}>
              Save Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Inline dialog for logging a payment for a source
  const [logOpen, setLogOpen] = useState(false);
  const [logSourceId, setLogSourceId] = useState<string | null>(null);
  const [logAmount, setLogAmount] = useState("");
  const [logDate, setLogDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  // Quick add other income fields
  const [entrySourceName, setEntrySourceName] = useState("");
  const [amount, setAmount] = useState("");

  const renderIncomeStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Income Received</h2>
        <p className="text-gray-600">Log any income received this week</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expected Income Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {expectedIncome.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No expected income sources set up
            </p>
          ) : (
            expectedIncome.map((source) => (
              <div key={source.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{source.name}</h3>
                    <p className="text-sm text-gray-600">
                      {source.userName} • ${source.expectedAmount?.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={demoMode}
                    title={demoMode ? "Demo mode" : undefined}
                    onClick={() => {
                      if (demoMode) {
                        toast.info("Demo mode: connect a household to save.");
                        return;
                      }
                      setLogSourceId(source.id);
                      setLogAmount(
                        source.expectedAmount
                          ? String(source.expectedAmount)
                          : "",
                      );
                      setLogOpen(true);
                    }}
                  >
                    Log Payment
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Other Income</CardTitle>
          <CardDescription>
            Log any additional income received this week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Source/Description</Label>
              <Input
                placeholder="e.g., Freelance project"
                value={entrySourceName}
                onChange={(e) => setEntrySourceName(e.target.value)}
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="w-full"
            disabled={demoMode}
            title={demoMode ? "Demo mode" : undefined}
            onClick={() => {
              if (demoMode) {
                toast.info("Demo mode: connect a household to save.");
                return;
              }
              const amt = parseFloat(amount);
              if (isNaN(amt) || amt <= 0) {
                toast.error("Enter a valid amount");
                return;
              }
              if (!entrySourceName) {
                toast.error("Provide a source");
                return;
              }
              createIncomeEntry.mutate(
                {
                  amount: amt,
                  sourceId: null,
                  sourceName: entrySourceName,
                  type: "other",
                  date: new Date().toISOString().slice(0, 10),
                },
                {
                  onSuccess: () => {
                    toast.success("Income logged");
                    setAmount("");
                    setEntrySourceName("");
                    setSessionData((prev) => ({
                      ...prev,
                      incomeLogged: [
                        ...prev.incomeLogged,
                        { amount: amt, source: entrySourceName },
                      ],
                    }));
                  },
                  onError: () => toast.error("Failed to log income"),
                },
              );
            }}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Log Income
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Quick expense input state
  const [qeAmount, setQeAmount] = useState("");
  const [qeCategory, setQeCategory] = useState("");
  const [qeDesc, setQeDesc] = useState("");

  const renderExpensesStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Weekly Expenses</h2>
        <p className="text-gray-600">Log any expenses from this week</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Expense Entry</CardTitle>
          <CardDescription>Add multiple expenses quickly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={qeAmount}
                onChange={(e) => setQeAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="What was this for?"
                value={qeDesc}
                onChange={(e) => setQeDesc(e.target.value)}
              />
            </div>
            <div>
              <Label>Category</Label>
              <select
                className="w-full p-2 border rounded-md"
                value={qeCategory}
                onChange={(e) => setQeCategory(e.target.value)}
              >
                <option value="">Select category...</option>
                {budget.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const amt = parseFloat(qeAmount);
              if (!qeCategory || isNaN(amt) || amt <= 0) {
                toast.error("Enter amount and category");
                return;
              }
              addExpense({
                amount: amt,
                categoryId: qeCategory,
                date: new Date().toISOString().slice(0, 10),
                description: qeDesc || undefined,
              });
              toast.success("Expense added");
              setSessionData((prev) => ({
                ...prev,
                expensesLogged: [
                  ...prev.expensesLogged,
                  { amount: amt, categoryId: qeCategory, description: qeDesc },
                ],
              }));
              setQeAmount("");
              setQeCategory("");
              setQeDesc("");
            }}
          >
            Add Expense
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Week Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">
                Expenses logged this session:
              </span>
              <span className="font-semibold">
                {sessionData.expensesLogged.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total amount:</span>
              <span className="font-semibold">
                $
                {sessionData.expensesLogged
                  .reduce((sum, e) => sum + (e.amount || 0), 0)
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Goal progress dialog state
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goalNewAmount, setGoalNewAmount] = useState("");

  const renderGoalsStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Goals Progress</h2>
        <p className="text-gray-600">Review your financial goals</p>
      </div>

      {budget.goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold">No goals set yet</p>
            <p className="text-gray-600 mb-4">
              Set some financial goals to track your progress
            </p>
            <Button variant="outline">Create Your First Goal</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {budget.goals.map((goal) => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            const remaining = goal.targetAmount - goal.currentAmount;

            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{goal.name}</CardTitle>
                      <CardDescription>
                        ${goal.currentAmount.toFixed(2)} of $
                        {goal.targetAmount.toFixed(2)}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        {progress.toFixed(0)}%
                      </p>
                      <p className="text-sm text-gray-600">
                        ${remaining.toFixed(2)} to go
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={progress} className="mb-4" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      Monthly contribution: $
                      {goal.monthlyContribution.toFixed(2)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGoalId(goal.id);
                        setGoalNewAmount(String(goal.currentAmount));
                        setGoalOpen(true);
                      }}
                    >
                      Update Progress
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // Credit inline add
  const [creditVal, setCreditVal] = useState("");
  const [creditDate, setCreditDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [creditBureau, setCreditBureau] = useState("");
  const [creditUserId, setCreditUserId] = useState<string>("");

  // Set default user when household members load
  useEffect(() => {
    if (householdMembers.length > 0 && !creditUserId && user) {
      const me = householdMembers.find((m) => m.id === user.id);
      setCreditUserId(me ? me.id : householdMembers[0].id);
    }
  }, [householdMembers, user, creditUserId]);

  const renderCreditStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Credit Scores</h2>
        <p className="text-gray-600">
          Update your credit scores if you've checked them this week
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Credit Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Member</Label>
              <select
                className="w-full p-2 border rounded-md bg-background"
                value={creditUserId}
                onChange={(e) => setCreditUserId(e.target.value)}
              >
                {householdMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Score</Label>
              <Input
                type="number"
                placeholder="700"
                min="300"
                max="850"
                value={creditVal}
                onChange={(e) => setCreditVal(e.target.value)}
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={creditDate}
                onChange={(e) => setCreditDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Bureau</Label>
              <Input
                placeholder="experian/equifax/transunion"
                value={creditBureau}
                onChange={(e) => setCreditBureau(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="w-full"
            disabled={demoMode}
            title={demoMode ? "Demo mode" : undefined}
            onClick={() => {
              if (demoMode) {
                toast.info("Demo mode: connect a household to save.");
                return;
              }
              const val = parseInt(creditVal, 10);
              if (!creditUserId) {
                toast.error("Select a member");
                return;
              }
              if (isNaN(val) || val < 300 || val > 850) {
                toast.error("Enter valid score");
                return;
              }
              createScore.mutate(
                {
                  userId: creditUserId,
                  score: val,
                  date: creditDate,
                  bureau: creditBureau || null,
                },
                {
                  onSuccess: () => {
                    toast.success("Score added");
                    setCreditVal("");
                  },
                  onError: () => toast.error("Failed to add score"),
                },
              );
            }}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Update Score
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const [recon, setRecon] = useState<Record<string, string>>({});
  const renderReconciliationStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Account Reconciliation</h2>
        <p className="text-gray-600">Quick balance check for all accounts</p>
      </div>

      {budget.bankAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Landmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold">No bank accounts added yet</p>
            <Button variant="outline" className="mt-4">
              Add Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {budget.bankAccounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">{account.name}</h3>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded capitalize">
                      {account.type.replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Current Balance (from bank)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={
                          recon[account.id] ?? String(account.currentBalance)
                        }
                        onChange={(e) =>
                          setRecon((prev) => ({
                            ...prev,
                            [account.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>App Calculated</Label>
                      <Input
                        type="number"
                        value={account.calculatedBalance}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={demoMode}
                    title={demoMode ? "Demo mode" : undefined}
                    onClick={() => {
                      if (demoMode) {
                        toast.info("Demo mode: connect a household to save.");
                        return;
                      }
                      const val = parseFloat(
                        recon[account.id] ?? String(account.currentBalance),
                      );
                      if (isNaN(val)) {
                        toast.error("Enter valid amount");
                        return;
                      }
                      updateAccount.mutate(
                        { id: account.id, updates: { currentBalance: val } },
                        {
                          onSuccess: () => toast.success("Reconciled"),
                          onError: () => toast.error("Failed to reconcile"),
                        },
                      );
                    }}
                  >
                    Reconcile
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Todos step state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "low" | "medium" | "high"
  >("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");

  const pendingTasks = budget.tasks.filter((t) => t.status !== "done");

  // Build assignee color map for legend
  const assigneeColorMap = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    budget.tasks.forEach((task) => {
      if (task.assignedTo && !map.has(task.assignedTo)) {
        map.set(task.assignedTo, index++);
      }
    });
    return map;
  }, [budget.tasks]);

  const handleTaskMove = async (
    taskId: string,
    newStatus: TaskStatus,
    newPosition: number,
  ) => {
    if (demoMode) {
      toast.info("Demo mode: connect a household to save.");
      return;
    }
    updateTaskPositions.mutate(
      [{ id: taskId, status: newStatus, position: newPosition }],
      {
        onError: () => toast.error("Failed to move task"),
      },
    );
  };

  const renderTodosStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">
          Review & Add Todos
        </h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Drag tasks between columns and add new action items
        </p>
      </div>

      {/* Assignee Legend */}
      {householdMembers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Assignee Colors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {householdMembers.map((member) => {
                const colorClass = getAssigneeColor(
                  member.id,
                  assigneeColorMap,
                );
                return (
                  <div key={member.id} className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 border-l-4 ${colorClass} bg-muted`}
                    />
                    <span className="text-sm">{member.name}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-l-4 border-l-muted-foreground/30 bg-muted" />
                <span className="text-sm text-muted-foreground">
                  Unassigned
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      <KanbanBoard
        tasks={budget.tasks}
        onTaskMove={handleTaskMove}
        showAssigneeHighlight
      />

      {/* Add New Task */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Todo
          </CardTitle>
          <CardDescription>Add action items from this meeting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <Label>Task Title</Label>
              <Input
                placeholder="e.g., Review insurance quotes"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Assign To</Label>
              <select
                className="w-full p-2 border rounded-md bg-background"
                value={newTaskAssignedTo}
                onChange={(e) => setNewTaskAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {householdMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select
                className="w-full p-2 border rounded-md bg-background"
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as any)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={demoMode || !newTaskTitle.trim()}
                title={demoMode ? "Demo mode" : undefined}
                onClick={() => {
                  if (demoMode) {
                    toast.info("Demo mode: connect a household to save.");
                    return;
                  }
                  if (!newTaskTitle.trim()) {
                    toast.error("Enter a task title");
                    return;
                  }
                  createTask.mutate(
                    {
                      title: newTaskTitle.trim(),
                      priority: newTaskPriority,
                      status: "todo",
                      dueDate: newTaskDueDate || undefined,
                      assignedTo: newTaskAssignedTo || undefined,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Todo added");
                        setNewTaskTitle("");
                        setNewTaskPriority("medium");
                        setNewTaskDueDate("");
                        setNewTaskAssignedTo("");
                      },
                      onError: () => toast.error("Failed to add todo"),
                    },
                  );
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={goToPreviousStep}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button onClick={goToNextStep}>
          Next: Summary
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderSummaryStep = () => {
    const tips = [
      "Great job! Weekly consistency is key to financial freedom.",
      "Reviewing your finances weekly reduces anxiety and surprises.",
      "Celebrate your wins, no matter how small!",
      "You're building a better future with every check-in.",
      "Remember: progress, not perfection!",
      "Financial wellness is a journey, not a destination.",
    ];

    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center">
            <Trophy className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold">Great Job!</h2>
          <p className="text-lg text-gray-600">
            You've completed your weekly finance meeting
          </p>
        </div>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              This Week's Motivation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg italic">{randomTip}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Bills Reviewed
              </span>
              <span className="font-semibold">
                {sessionData.billsReviewed.length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Income Logged
              </span>
              <span className="font-semibold">
                {sessionData.incomeLogged.length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Expenses Logged
              </span>
              <span className="font-semibold">
                {sessionData.expensesLogged.length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Subscriptions Paid
              </span>
              <span className="font-semibold">
                {(sessionData.subscriptionsPaid || []).length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-orange-600" />
                Pending Todos
              </span>
              <span className="font-semibold">
                {budget.tasks.filter((t) => t.status !== "done").length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meeting Notes</CardTitle>
            <CardDescription>
              Any additional notes from this meeting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Things to remember, action items, or observations..."
              rows={4}
              value={sessionData.notes}
              onChange={(e) =>
                setSessionData({ ...sessionData, notes: e.target.value })
              }
            />
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            className="flex-1"
            size="lg"
            onClick={() => {
              if (demoMode) {
                toast.info("Demo mode: connect a household to save.");
                return;
              }
              createWeeklySummary(
                {
                  weekStartDate: new Date().toISOString().slice(0, 10),
                  notes: sessionData.notes,
                  data: {
                    billsReviewed: sessionData.billsReviewed,
                    subscriptionsPaidCount: (
                      sessionData.subscriptionsPaid || []
                    ).length,
                    incomeLoggedCount: sessionData.incomeLogged.length,
                    expensesLoggedCount: sessionData.expensesLogged.length,
                    totals: {
                      income: monthlyIncome,
                      expenses: monthlyExpenses,
                    },
                  },
                },
                {
                  onSuccess: () => {
                    clearWizardProgress();
                    toast.success("Meeting summary saved!");
                    navigate("/");
                  },
                  onError: () => toast.error("Failed to save summary"),
                },
              );
            }}
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Save & Finish
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              const summaryText =
                `Weekly Meeting Summary - ${new Date().toLocaleDateString()}\n\n` +
                `Bills Reviewed: ${sessionData.billsReviewed.length}\n` +
                `Subscriptions Paid: ${(sessionData.subscriptionsPaid || []).length}\n` +
                `Income Logged: ${sessionData.incomeLogged.length}\n` +
                `Expenses Logged: ${sessionData.expensesLogged.length}\n\n` +
                `Notes: ${sessionData.notes}`;
              navigator.clipboard.writeText(summaryText);
              toast.success("Summary copied to clipboard!");
            }}
          >
            Export Summary
          </Button>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "welcome":
        return renderWelcomeStep();
      case "bills":
        return renderBillsStep();
      case "income":
        return renderIncomeStep();
      case "expenses":
        return renderExpensesStep();
      case "goals":
        return renderGoalsStep();
      case "credit":
        return renderCreditStep();
      case "reconciliation":
        return renderReconciliationStep();
      case "todos":
        return renderTodosStep();
      case "summary":
        return renderSummaryStep();
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <TabNav group="household-insights" />
      <div className="space-y-6">
        {demoMode && <DemoBanner />}

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Insights
            </span>
          </div>
          <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
            Weekly <span className="text-emerald-500">Meeting</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mind, body & soul financial health check-in.
          </p>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-center text-xs md:text-sm">
                <span className="font-semibold">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
                <span className="text-gray-600">
                  {Math.round(progress)}% Complete
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex gap-1.5 md:gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;

                  return (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                        isCurrent
                          ? "bg-primary text-primary-foreground font-semibold"
                          : isCompleted
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600 active:bg-gray-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden sm:inline">{step.label}</span>
                      {isCompleted && (
                        <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        {renderCurrentStep()}

        {/* Update goal progress dialog */}
        <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-bold">
                Update Goal Progress
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Current Amount</Label>
              <Input
                type="number"
                value={goalNewAmount}
                onChange={(e) => setGoalNewAmount(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={() => {
                  if (!goalId) return;
                  const val = parseFloat(goalNewAmount || "0") || 0;
                  updateGoal(goalId, { currentAmount: val });
                  toast.success("Goal progress updated");
                  setGoalOpen(false);
                }}
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Log payment dialog for source */}
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-bold">
                Log Income Payment
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={logAmount}
                  onChange={(e) => setLogAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={demoMode}
                title={demoMode ? "Demo mode" : undefined}
                onClick={() => {
                  if (demoMode) {
                    toast.info("Demo mode: connect a household to save.");
                    return;
                  }
                  const amt = parseFloat(logAmount);
                  if (!logSourceId || isNaN(amt) || amt <= 0) {
                    toast.error("Enter valid amount");
                    return;
                  }
                  const sourceName =
                    budget.incomeSources.find((s) => s.id === logSourceId)
                      ?.name || "Income";
                  createIncomeEntry.mutate(
                    {
                      amount: amt,
                      sourceId: logSourceId,
                      sourceName,
                      type: "salary",
                      date: logDate,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Income logged");
                        setLogOpen(false);
                        setSessionData((prev) => ({
                          ...prev,
                          incomeLogged: [
                            ...prev.incomeLogged,
                            { amount: amt, source: sourceName },
                          ],
                        }));
                      },
                      onError: () => toast.error("Failed to log income"),
                    },
                  );
                }}
              >
                Log Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Navigation Buttons */}
        <div className="flex gap-2 md:gap-4 sticky bottom-2 md:bottom-4 bg-background p-3 md:p-4 rounded-lg shadow-lg border">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={currentStepIndex === 0}
            className="flex-1 h-12 md:h-10"
            size="lg"
          >
            <ChevronLeft className="h-5 w-5 md:h-4 md:w-4 md:mr-2" />
            <span className="hidden md:inline">Previous</span>
          </Button>
          <Button
            onClick={goToNextStep}
            className="flex-1 h-12 md:h-10"
            size="lg"
          >
            <span className="hidden md:inline">
              {currentStepIndex === steps.length - 1 ? "Finish" : "Next"}
            </span>
            <ChevronRight className="h-5 w-5 md:h-4 md:w-4 md:ml-2" />
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HouseholdWeeklyMeeting;
