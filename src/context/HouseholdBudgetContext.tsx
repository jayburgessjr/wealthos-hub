import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  format as dfFormat,
  isSameMonth,
  parseISO,
  addMonths,
  addWeeks,
  addYears,
  isBefore,
} from "date-fns";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Budget,
  Category,
  Expense,
  Goal,
  BudgetStatus,
  Bill,
  IncomeSource,
  IncomeEntry,
  BankAccount,
  CreditScoreEntry,
  Subscription,
  Task,
  CareerProfile,
} from "@/integrations/supabase/household-types";
import type { QuarterlySummary } from "@/integrations/supabase/household-types";
import { useAuth } from "@/components/AuthProvider";
import { getHouseholdIdForUser } from "@/integrations/supabase/household-queries";
import {
  useBudgetQuery,
  useCreateExpenseMutation,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useCreateGoalMutation,
  useUpdateGoalMutation,
  useDeleteGoalMutation,
} from "@/hooks/useHouseholdBudgetData";
import {
  useSubscriptionsQuery,
  useCreateSubscriptionMutation,
  useUpdateSubscriptionMutation,
  useDeleteSubscriptionMutation,
} from "@/hooks/useHouseholdBudgetData";
import { useUpdateBillMutation } from "@/hooks/useHouseholdBudgetData";
import {
  useQuarterlySummariesQuery,
  useUpsertQuarterlySummaryMutation,
} from "@/hooks/useHouseholdBudgetData";
import { useHouseholdRealtimeSync } from "@/hooks/useHouseholdRealtimeSync";
import { toast } from "sonner";

function getInitialMonthFromUrl(search: string): string | null {
  try {
    const params = new URLSearchParams(search);
    const m = params.get("month");
    if (m && /^\d{4}-\d{2}$/.test(m)) return m;
  } catch {}
  return null;
}

const todayMonth = dfFormat(new Date(), "yyyy-MM");

// Empty initial state - real data comes from Supabase
const emptyBudget: Budget = {
  id: "",
  month: todayMonth,
  income: 0,
  incomeSources: [],
  incomeEntries: [],
  categories: [],
  expenses: [],
  goals: [],
  subscriptions: [],
  bills: [],
  bankAccounts: [],
  creditScores: [],
  tasks: [],
  careerProfiles: [],
  weeklySummaries: [],
  monthlySummaries: [],
  quarterlySummaries: [],
  expectedMonthlyIncome: 0,
  subscriptionBudget: 0,
  billsBudget: 0,
  expensesBudget: 0,
};

interface BudgetContextType {
  budget: Budget;
  currentMonth: string;
  setMonth: (monthISO: string) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  totalSpent: number;
  variableExpensesTotal: number;
  subscriptionMonthlyTotal: number;
  subscriptionCashflowTotal: number;
  remaining: number;
  budgetStatus: BudgetStatus;
  isLoading: boolean;
  error: string | null;
  householdId: string | null;
  addExpense: (expense: Omit<Expense, "id" | "userId" | "userName">) => void;
  addCategory: (category: Omit<Category, "id" | "spent">) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  addGoal: (goal: Omit<Goal, "id">) => void;
  deleteGoal: (id: string) => void;
  getCategoryById: (id: string) => Category | undefined;
  getExpensesByCategory: (categoryId: string) => Expense[];
  getDailyAverage: () => number;
  getCategoryTrends: () => {
    categoryId: string;
    trend: "up" | "down" | "stable";
  }[];
  // Demo-mode local actions (no household)
  updateExpenseLocal: (id: string, updates: Partial<Expense>) => void;
  deleteExpenseLocal: (id: string) => void;
  addBillLocal: (bill: Omit<Bill, "id">) => void;
  updateBillLocal: (id: string, updates: Partial<Bill>) => void;
  deleteBillLocal: (id: string) => void;
  addIncomeSourceLocal: (source: Omit<IncomeSource, "id">) => void;
  updateIncomeSourceLocal: (id: string, updates: Partial<IncomeSource>) => void;
  deleteIncomeSourceLocal: (id: string) => void;
  addIncomeEntryLocal: (entry: Omit<IncomeEntry, "id">) => void;
  updateIncomeEntryLocal: (id: string, updates: Partial<IncomeEntry>) => void;
  deleteIncomeEntryLocal: (id: string) => void;
  addBankAccountLocal: (account: Omit<BankAccount, "id">) => void;
  updateBankAccountLocal: (id: string, updates: Partial<BankAccount>) => void;
  deleteBankAccountLocal: (id: string) => void;
  addCreditScoreLocal: (entry: Omit<CreditScoreEntry, "id">) => void;
  deleteCreditScoreLocal: (id: string) => void;
  // Subscriptions (local-only for now)
  addSubscriptionLocal: (sub: Omit<Subscription, "id">) => void;
  updateSubscriptionLocal: (id: string, updates: Partial<Subscription>) => void;
  deleteSubscriptionLocal: (id: string) => void;
  // Subscriptions via DB when available
  addSubscription: (sub: Omit<Subscription, "id">) => void;
  updateSubscription: (id: string, updates: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  // Tasks (local-only for demo mode)
  addTaskLocal: (
    task: Omit<
      Task,
      | "id"
      | "createdBy"
      | "createdByName"
      | "householdId"
      | "createdAt"
      | "updatedAt"
      | "position"
    >,
  ) => void;
  updateTaskLocal: (id: string, updates: Partial<Task>) => void;
  deleteTaskLocal: (id: string) => void;
  // Career Profiles (local-only for demo mode)
  addCareerProfileLocal: (
    profile: Omit<
      CareerProfile,
      | "id"
      | "userId"
      | "userName"
      | "householdId"
      | "skills"
      | "achievements"
      | "careerGoals"
      | "createdAt"
      | "updatedAt"
    >,
  ) => void;
  updateCareerProfileLocal: (
    id: string,
    updates: Partial<CareerProfile>,
  ) => void;
  deleteCareerProfileLocal: (id: string) => void;
  // Quarterly summaries
  quarterlySummaries: QuarterlySummary[];
  upsertQuarterlySummary: (input: {
    period: string;
    notes?: string;
    data?: Record<string, unknown>;
  }) => void;
  // Repair utility
  repairBillExpenses: () => Promise<void>;
}

const HouseholdBudgetContext = createContext<BudgetContextType | undefined>(
  undefined,
);

export function HouseholdBudgetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<Budget>(emptyBudget);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => getInitialMonthFromUrl(location.search) || todayMonth,
  );

  // Sync selected month from URL when it changes (e.g., direct navigation)
  useEffect(() => {
    const fromUrl = getInitialMonthFromUrl(location.search);
    if (fromUrl && fromUrl !== selectedMonth) {
      setSelectedMonth(fromUrl);
    }
  }, [location.search]);

  // Load from Supabase when authenticated and a household exists
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (authLoading) return; // wait for auth
      setIsLoading(true);
      setError(null);
      try {
        if (!user) {
          // Not signed in: keep mock budget for landing/redirects
          if (!cancelled) setIsLoading(false);
          return;
        }

        const hid = await getHouseholdIdForUser(user.id);
        setHouseholdId(hid);
        if (!hid) {
          // No household yet; keep mock data until setup flow (Week 3)
          if (!cancelled) setIsLoading(false);
          return;
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load budget");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Query budget via TanStack when householdId exists
  const {
    data: budgetData,
    isLoading: budgetLoading,
    error: budgetError,
  } = useBudgetQuery(householdId, selectedMonth);
  const { data: subsData } = useSubscriptionsQuery(householdId);

  // Enable real-time sync across browser tabs
  useHouseholdRealtimeSync(householdId, selectedMonth);

  // Sync query result into local state used by UI (for features not yet persisted)
  useEffect(() => {
    if (budgetData?.budget) {
      setBudget(budgetData.budget);
    }
  }, [budgetData]);

  // Merge subscriptions from DB if available (fallback to local otherwise)
  useEffect(() => {
    if (subsData && subsData.available) {
      setBudget((prev) => ({ ...prev, subscriptions: subsData.subscriptions }));
    }
  }, [subsData?.available, subsData?.subscriptions]);

  useEffect(() => {
    if (budgetError) setError(budgetError.message);
  }, [budgetError]);

  // Quarterly summaries
  const { data: quarterlySummariesRaw = [] } =
    useQuarterlySummariesQuery(householdId);
  const upsertQuarterlySummaryMutation = useUpsertQuarterlySummaryMutation();

  const quarterlySummaries: QuarterlySummary[] = quarterlySummariesRaw.map(
    (r) => ({
      id: r.id,
      householdId: r.household_id,
      period: r.period,
      notes: r.notes ?? undefined,
      data: (r.data as Record<string, unknown>) ?? {},
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),
  );

  const upsertQuarterlySummary = useCallback(
    (input: {
      period: string;
      notes?: string;
      data?: Record<string, unknown>;
    }) => {
      if (!householdId) return;
      upsertQuarterlySummaryMutation.mutate({ householdId, ...input });
    },
    [householdId, upsertQuarterlySummaryMutation],
  );

  const totalSpent = useMemo(
    () => budget.categories.reduce((sum, cat) => sum + cat.spent, 0),
    [budget.categories],
  );

  // Calculate variable expenses (expenses NOT linked to bills or subscriptions)
  const variableExpensesTotal = useMemo(() => {
    return budget.expenses
      .filter((e) => !e.linkedBillId && !e.linkedSubscriptionId)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [budget.expenses]);

  // Calculate normalized subscription total (amortize yearly to monthly)
  const subscriptionMonthlyTotal = useMemo(() => {
    return budget.subscriptions.reduce((sum, sub) => {
      let monthlyAmount = sub.amount;
      if (sub.frequency === "annual") monthlyAmount = sub.amount / 12;
      return sum + monthlyAmount;
    }, 0);
  }, [budget.subscriptions]);

  // Calculate actual cashflow impact of subscriptions for the selected month
  const subscriptionCashflowTotal = useMemo(() => {
    return budget.subscriptions.reduce((sum, sub) => {
      if (sub.frequency === "monthly") {
        return sum + sub.amount;
      }
      // For annual, only charge if renewal is in this month
      if (sub.nextDate && sub.nextDate.startsWith(selectedMonth)) {
        return sum + sub.amount;
      }
      return sum;
    }, 0);
  }, [budget.subscriptions, selectedMonth]);

  const remaining = useMemo(
    () => (budget.income ?? 0) - totalSpent,
    [budget.income, totalSpent],
  );
  const spentPercentage = useMemo(
    () =>
      (budget.income ?? 0) > 0 ? (totalSpent / (budget.income ?? 0)) * 100 : 0,
    [totalSpent, budget.income],
  );
  const budgetStatus: BudgetStatus =
    spentPercentage >= 90
      ? "danger"
      : spentPercentage >= 75
        ? "warning"
        : "safe";

  const createExpenseMutation = useCreateExpenseMutation(
    householdId,
    user?.id ?? null,
    selectedMonth,
  );
  const createCategoryMutation = useCreateCategoryMutation(
    householdId,
    selectedMonth,
  );
  const updateCategoryMutation = useUpdateCategoryMutation(
    householdId,
    selectedMonth,
  );
  const deleteCategoryMutation = useDeleteCategoryMutation(
    householdId,
    selectedMonth,
  );
  const createGoalMutation = useCreateGoalMutation(householdId, selectedMonth);
  const updateGoalMutation = useUpdateGoalMutation(householdId, selectedMonth);
  const deleteGoalMutation = useDeleteGoalMutation(householdId, selectedMonth);
  const createSubscriptionMutation = useCreateSubscriptionMutation(householdId);
  const updateSubscriptionMutation = useUpdateSubscriptionMutation(householdId);
  const deleteSubscriptionMutation = useDeleteSubscriptionMutation(householdId);
  const { mutate: updateBillMutate } = useUpdateBillMutation(householdId);

  useEffect(() => {
    if (!budget.bills.length) return;

    const targetMonthStart = parseISO(`${selectedMonth}-01`);
    if (Number.isNaN(targetMonthStart.getTime())) return;

    const advanceDueDate = (current: Date, frequency?: Bill["frequency"]) => {
      switch (frequency) {
        case "weekly":
          return addWeeks(current, 1);
        case "biweekly":
          return addWeeks(current, 2);
        case "yearly":
          return addYears(current, 1);
        default:
          return addMonths(current, 1);
      }
    };

    const rolloverUpdates: { id: string; dueDate: string }[] = [];

    budget.bills.forEach((bill) => {
      if (bill.isRecurring === false) return;
      if (bill.isActive === false) return;
      if (bill.paymentStatus !== "paid") return;
      if (!bill.dueDate) return;

      const originalDue = parseISO(bill.dueDate);
      if (Number.isNaN(originalDue.getTime())) return;
      if (!isBefore(originalDue, targetMonthStart)) return;

      let nextDue = originalDue;
      let safety = 0;
      while (isBefore(nextDue, targetMonthStart) && safety < 36) {
        nextDue = advanceDueDate(nextDue, bill.frequency);
        safety += 1;
      }
      if (safety >= 36) return;

      rolloverUpdates.push({
        id: bill.id,
        dueDate: dfFormat(nextDue, "yyyy-MM-dd"),
      });
    });

    if (!rolloverUpdates.length) return;

    const updateMap = new Map(rolloverUpdates.map((item) => [item.id, item]));
    setBudget((prev) => ({
      ...prev,
      bills: prev.bills.map((bill) => {
        const update = updateMap.get(bill.id);
        if (!update) return bill;
        return {
          ...bill,
          dueDate: update.dueDate,
          paymentStatus: "unpaid",
          amountPaid: 0,
        };
      }),
    }));

    if (householdId) {
      rolloverUpdates.forEach(({ id, dueDate }) => {
        updateBillMutate({
          id,
          updates: { dueDate, paymentStatus: "unpaid", amountPaid: 0 },
        });
      });
    }
  }, [budget.bills, selectedMonth, householdId, updateBillMutate]);

  const addExpense = useCallback(
    (expense: Omit<Expense, "id" | "userId" | "userName">) => {
      if (!user || !householdId) {
        // Local fallback if not authenticated/household
        const newExpenseLocal: Expense = {
          ...expense,
          id: Date.now().toString(),
          userId: "local",
          userName: "You",
        };
        setBudget((prev) => ({
          ...prev,
          expenses: [newExpenseLocal, ...prev.expenses],
          categories: prev.categories.map((cat) =>
            cat.id === expense.categoryId
              ? { ...cat, spent: cat.spent + expense.amount }
              : cat,
          ),
        }));
        // If linked to a bill, update local bill paid amounts/status to keep expenses as source of truth
        if (expense.linkedBillId) {
          const bill = budget.bills.find((b) => b.id === expense.linkedBillId);
          if (bill) {
            const newPaid = (bill.amountPaid ?? 0) + expense.amount;
            const target = bill.amount ?? 0;
            const paymentStatus: Bill["paymentStatus"] =
              newPaid >= target ? "paid" : newPaid > 0 ? "partial" : "unpaid";
            const deactivate = !bill.isRecurring && newPaid >= target;
            updateBillLocal(bill.id, {
              amountPaid: newPaid,
              paymentStatus,
              isActive: deactivate ? false : bill.isActive,
            });
          }
        }
        return;
      }

      createExpenseMutation.mutate(
        {
          amount: expense.amount,
          categoryId: expense.categoryId,
          date: expense.date,
          description: expense.description,
          linkedBillId: expense.linkedBillId,
          linkedSubscriptionId: expense.linkedSubscriptionId,
        },
        {
          onSuccess: () => {
            // If this expense is linked to a bill, update the bill's paid tracking/status
            if (expense.linkedBillId) {
              const bill = budget.bills.find(
                (b) => b.id === expense.linkedBillId,
              );
              if (bill) {
                const newPaid = (bill.amountPaid ?? 0) + expense.amount;
                const target = bill.amount ?? 0;
                const paymentStatus: Bill["paymentStatus"] =
                  newPaid >= target
                    ? "paid"
                    : newPaid > 0
                      ? "partial"
                      : "unpaid";
                const deactivate = !bill.isRecurring && newPaid >= target;
                updateBillMutate({
                  id: bill.id,
                  updates: {
                    amountPaid: newPaid,
                    paymentStatus,
                    isActive: deactivate ? false : bill.isActive,
                  },
                });
                // Optimistic local reflection
                setBudget((prev) => ({
                  ...prev,
                  bills: prev.bills.map((b) =>
                    b.id === bill.id
                      ? {
                          ...b,
                          amountPaid: newPaid,
                          paymentStatus,
                          isActive: deactivate ? false : b.isActive,
                        }
                      : b,
                  ),
                }));
              }
            }
          },
          onError: (e) => {
            console.error("Failed to add expense", e);
            toast.error("Failed to add expense. Please try again.");
          },
        },
      );
    },
    [user, householdId, createExpenseMutation],
  );

  const addCategory = useCallback(
    (category: Omit<Category, "id" | "spent">) => {
      if (!householdId) {
        const newCategory: Category = {
          ...category,
          id: Date.now().toString(),
          spent: 0,
        };
        setBudget((prev) => ({
          ...prev,
          categories: [...prev.categories, newCategory],
        }));
        return;
      }
      // optimistic UI add
      const tempId = `tmp_${Date.now()}`;
      const optimistic: Category = { ...category, id: tempId, spent: 0 };
      setBudget((prev) => ({
        ...prev,
        categories: [...prev.categories, optimistic],
      }));
      createCategoryMutation.mutate(
        {
          name: category.name,
          type: category.type,
          monthlyLimit: category.monthlyLimit,
          icon: category.icon,
        },
        {
          onSuccess: (row) => {
            setBudget((prev) => ({
              ...prev,
              categories: prev.categories.map((c) =>
                c.id === tempId ? { ...c, id: row.id } : c,
              ),
            }));
          },
          onError: (e) => {
            // rollback
            setBudget((prev) => ({
              ...prev,
              categories: prev.categories.filter((c) => c.id !== tempId),
            }));
            console.error("Failed to create category", e);
            toast.error("Failed to create category. Please try again.");
          },
        },
      );
    },
    [householdId, createCategoryMutation],
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Category>) => {
      setBudget((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === id ? { ...cat, ...updates } : cat,
        ),
      }));
      if (householdId) {
        updateCategoryMutation.mutate(
          {
            id,
            updates: {
              name: updates.name,
              type: updates.type,
              monthlyLimit: updates.monthlyLimit,
              icon: updates.icon,
            },
          },
          {
            onError: (e) => {
              console.error("Failed to update category", e);
              toast.error("Failed to update category. Please try again.");
            },
          },
        );
      }
    },
    [householdId, updateCategoryMutation],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setBudget((prev) => ({
        ...prev,
        categories: prev.categories.filter((cat) => cat.id !== id),
        expenses: prev.expenses.filter((exp) => exp.categoryId !== id),
      }));
      if (householdId)
        deleteCategoryMutation.mutate(id, {
          onError: (e) => {
            console.error("Failed to delete category", e);
            toast.error("Failed to delete category. Please try again.");
          },
        });
    },
    [householdId, deleteCategoryMutation],
  );

  const updateGoal = useCallback(
    (id: string, updates: Partial<Goal>) => {
      setBudget((prev) => ({
        ...prev,
        goals: prev.goals.map((goal) =>
          goal.id === id ? { ...goal, ...updates } : goal,
        ),
      }));
      if (householdId) {
        updateGoalMutation.mutate(
          {
            id,
            updates: {
              name: updates.name,
              targetAmount: updates.targetAmount,
              currentAmount: updates.currentAmount,
              monthlyContribution: updates.monthlyContribution,
              targetDate: updates.deadline,
              linkedBillId: updates.linkedBillId,
              imagePath: updates.imagePath,
              notes: updates.notes,
            },
          },
          {
            onError: (e) => {
              console.error("Failed to update goal", e);
              toast.error("Failed to update goal. Please try again.");
            },
          },
        );
      }
    },
    [householdId, updateGoalMutation],
  );

  const addGoal = useCallback(
    (goal: Omit<Goal, "id">) => {
      if (!householdId) {
        const newGoal: Goal = { ...goal, id: Date.now().toString() };
        setBudget((prev) => ({ ...prev, goals: [...prev.goals, newGoal] }));
        return;
      }
      const tempId = `tmp_${Date.now()}`;
      const optimistic: Goal = { ...goal, id: tempId };
      setBudget((prev) => ({ ...prev, goals: [...prev.goals, optimistic] }));
      createGoalMutation.mutate(
        {
          name: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          monthlyContribution: goal.monthlyContribution,
          targetDate: goal.deadline ?? undefined,
          linkedBillId: goal.linkedBillId ?? undefined,
          imagePath: goal.imagePath ?? undefined,
          notes: goal.notes ?? undefined,
        },
        {
          onSuccess: (row) => {
            setBudget((prev) => ({
              ...prev,
              goals: prev.goals.map((g) =>
                g.id === tempId ? { ...g, id: row.id } : g,
              ),
            }));
          },
          onError: (e) => {
            setBudget((prev) => ({
              ...prev,
              goals: prev.goals.filter((g) => g.id !== tempId),
            }));
            console.error("Failed to create goal", e);
            toast.error("Failed to create goal. Please try again.");
          },
        },
      );
    },
    [householdId, createGoalMutation],
  );

  const deleteGoal = useCallback(
    (id: string) => {
      setBudget((prev) => ({
        ...prev,
        goals: prev.goals.filter((goal) => goal.id !== id),
      }));
      if (householdId)
        deleteGoalMutation.mutate(id, {
          onError: (e) => {
            console.error("Failed to delete goal", e);
            toast.error("Failed to delete goal. Please try again.");
          },
        });
    },
    [householdId, deleteGoalMutation],
  );

  const getCategoryById = useCallback(
    (id: string) => {
      return budget.categories.find((cat) => cat.id === id);
    },
    [budget.categories],
  );

  const getExpensesByCategory = useCallback(
    (categoryId: string) => {
      return budget.expenses.filter((exp) => exp.categoryId === categoryId);
    },
    [budget.expenses],
  );

  const getDailyAverage = useCallback(() => {
    // Daily avg should consider the selected month; if viewing the current month, use days elapsed so far,
    // otherwise use full days in that month.
    const selected = parseISO(`${selectedMonth}-01`);
    const now = new Date();
    let daysElapsed: number;
    if (isSameMonth(selected, now)) {
      daysElapsed = now.getDate();
    } else {
      // Get days in selected month by going to next month day 0
      const next = new Date(selected);
      next.setMonth(next.getMonth() + 1);
      next.setDate(0);
      daysElapsed = next.getDate();
    }
    return daysElapsed > 0 ? totalSpent / daysElapsed : 0;
  }, [totalSpent, selectedMonth]);

  const setMonth = useCallback(
    (monthISO: string) => {
      if (!/^\d{4}-\d{2}$/.test(monthISO)) return;
      setSelectedMonth(monthISO);
      // Update URL query param without reloading
      const params = new URLSearchParams(location.search);
      params.set("month", monthISO);
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true },
      );
    },
    [location.pathname, location.search, navigate],
  );

  const nextMonth = useCallback(() => {
    const d = parseISO(`${selectedMonth}-01`);
    d.setMonth(d.getMonth() + 1);
    setMonth(dfFormat(d, "yyyy-MM"));
  }, [selectedMonth, setMonth]);

  const prevMonth = useCallback(() => {
    const d = parseISO(`${selectedMonth}-01`);
    d.setMonth(d.getMonth() - 1);
    setMonth(dfFormat(d, "yyyy-MM"));
  }, [selectedMonth, setMonth]);

  const getCategoryTrends = useCallback(() => {
    return budget.categories.map((cat) => ({
      categoryId: cat.id,
      trend:
        cat.spent > cat.monthlyLimit * 0.8
          ? ("up" as const)
          : cat.spent < cat.monthlyLimit * 0.5
            ? ("down" as const)
            : ("stable" as const),
    }));
  }, [budget.categories]);

  // Demo-mode local updaters
  const updateExpenseLocal: BudgetContextType["updateExpenseLocal"] = (
    id,
    updates,
  ) => {
    setBudget((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) =>
        e.id === id ? { ...e, ...updates } : e,
      ),
      categories:
        updates.categoryId || updates.amount !== undefined
          ? prev.categories.map((cat) => {
              const oldExp = prev.expenses.find((e) => e.id === id);
              if (!oldExp) return cat;
              if (
                cat.id === oldExp.categoryId &&
                updates.categoryId &&
                updates.categoryId !== oldExp.categoryId
              ) {
                return { ...cat, spent: cat.spent - oldExp.amount };
              }
              if (cat.id === updates.categoryId) {
                return {
                  ...cat,
                  spent:
                    cat.spent +
                    (updates.amount ?? oldExp.amount) -
                    (cat.id === oldExp.categoryId ? oldExp.amount : 0),
                };
              }
              if (
                cat.id === oldExp.categoryId &&
                updates.amount !== undefined &&
                !updates.categoryId
              ) {
                return {
                  ...cat,
                  spent: cat.spent - oldExp.amount + updates.amount,
                };
              }
              return cat;
            })
          : prev.categories,
    }));
  };
  const deleteExpenseLocal: BudgetContextType["deleteExpenseLocal"] = (id) => {
    setBudget((prev) => {
      const exp = prev.expenses.find((e) => e.id === id);
      return {
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== id),
        categories: exp
          ? prev.categories.map((cat) =>
              cat.id === exp.categoryId
                ? { ...cat, spent: cat.spent - exp.amount }
                : cat,
            )
          : prev.categories,
      };
    });
  };

  const addBillLocal: BudgetContextType["addBillLocal"] = (bill) => {
    const id = `tmp_${Date.now()}`;
    setBudget((prev) => ({ ...prev, bills: [...prev.bills, { ...bill, id }] }));
  };
  const updateBillLocal: BudgetContextType["updateBillLocal"] = (
    id,
    updates,
  ) => {
    setBudget((prev) => ({
      ...prev,
      bills: prev.bills.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  };
  const deleteBillLocal: BudgetContextType["deleteBillLocal"] = (id) => {
    setBudget((prev) => ({
      ...prev,
      bills: prev.bills.filter((b) => b.id !== id),
    }));
  };

  const addIncomeSourceLocal: BudgetContextType["addIncomeSourceLocal"] = (
    source,
  ) => {
    const id = `tmp_${Date.now()}`;
    setBudget((prev) => ({
      ...prev,
      incomeSources: [...prev.incomeSources, { ...source, id }],
    }));
  };
  const updateIncomeSourceLocal: BudgetContextType["updateIncomeSourceLocal"] =
    (id, updates) => {
      setBudget((prev) => ({
        ...prev,
        incomeSources: prev.incomeSources.map((s) =>
          s.id === id ? { ...s, ...updates } : s,
        ),
      }));
    };
  const deleteIncomeSourceLocal: BudgetContextType["deleteIncomeSourceLocal"] =
    (id) => {
      setBudget((prev) => ({
        ...prev,
        incomeSources: prev.incomeSources.filter((s) => s.id !== id),
      }));
    };

  const addIncomeEntryLocal: BudgetContextType["addIncomeEntryLocal"] = (
    entry,
  ) => {
    const id = `tmp_${Date.now()}`;
    setBudget((prev) => ({
      ...prev,
      incomeEntries: [{ ...entry, id }, ...prev.incomeEntries],
    }));
  };
  const updateIncomeEntryLocal: BudgetContextType["updateIncomeEntryLocal"] = (
    id,
    updates,
  ) => {
    setBudget((prev) => ({
      ...prev,
      incomeEntries: prev.incomeEntries.map((e) =>
        e.id === id ? { ...e, ...updates } : e,
      ),
    }));
  };
  const deleteIncomeEntryLocal: BudgetContextType["deleteIncomeEntryLocal"] = (
    id,
  ) => {
    setBudget((prev) => ({
      ...prev,
      incomeEntries: prev.incomeEntries.filter((e) => e.id !== id),
    }));
  };

  const addBankAccountLocal: BudgetContextType["addBankAccountLocal"] = (
    account,
  ) => {
    const id = `tmp_${Date.now()}`;
    setBudget((prev) => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts, { ...account, id }],
    }));
  };
  const updateBankAccountLocal: BudgetContextType["updateBankAccountLocal"] = (
    id,
    updates,
  ) => {
    setBudget((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map((a) =>
        a.id === id ? { ...a, ...updates } : a,
      ),
    }));
  };
  const deleteBankAccountLocal: BudgetContextType["deleteBankAccountLocal"] = (
    id,
  ) => {
    setBudget((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter((a) => a.id !== id),
    }));
  };

  const addCreditScoreLocal: BudgetContextType["addCreditScoreLocal"] = (
    entry,
  ) => {
    const id = `tmp_${Date.now()}`;
    setBudget((prev) => ({
      ...prev,
      creditScores: [{ ...entry, id }, ...prev.creditScores],
    }));
  };
  const deleteCreditScoreLocal: BudgetContextType["deleteCreditScoreLocal"] = (
    id,
  ) => {
    setBudget((prev) => ({
      ...prev,
      creditScores: prev.creditScores.filter((cs) => cs.id !== id),
    }));
  };

  // Subscriptions local CRUD
  const addSubscriptionLocal: BudgetContextType["addSubscriptionLocal"] = (
    sub,
  ) => {
    const id = `tmp_${Date.now()}`;
    setBudget((prev) => ({
      ...prev,
      subscriptions: [...prev.subscriptions, { ...sub, id }],
    }));
  };
  const updateSubscriptionLocal: BudgetContextType["updateSubscriptionLocal"] =
    (id, updates) => {
      setBudget((prev) => ({
        ...prev,
        subscriptions: prev.subscriptions.map((s) =>
          s.id === id ? { ...s, ...updates } : s,
        ),
      }));
    };
  const deleteSubscriptionLocal: BudgetContextType["deleteSubscriptionLocal"] =
    (id) => {
      setBudget((prev) => ({
        ...prev,
        subscriptions: prev.subscriptions.filter((s) => s.id !== id),
      }));
    };

  // Tasks (local-only for demo mode)
  const addTaskLocal: BudgetContextType["addTaskLocal"] = (task) => {
    const id = `tmp_${Date.now()}`;
    const position =
      budget.tasks.filter((t) => t.status === (task.status || "todo")).length *
      1000;
    setBudget((prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        {
          ...task,
          id,
          status: task.status || "todo",
          priority: task.priority || "medium",
          tags: task.tags || [],
          createdBy: user?.id || "local",
          createdByName: user?.email || "You",
          householdId: householdId || "local",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          position,
        },
      ],
    }));
  };

  const updateTaskLocal: BudgetContextType["updateTaskLocal"] = (
    id,
    updates,
  ) => {
    setBudget((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t,
      ),
    }));
  };

  const deleteTaskLocal: BudgetContextType["deleteTaskLocal"] = (id) => {
    setBudget((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  };

  // Career Profiles (local-only for demo mode)
  const addCareerProfileLocal: BudgetContextType["addCareerProfileLocal"] = (
    profile,
  ) => {
    const id = `tmp_${Date.now()}`;
    setBudget((prev) => ({
      ...prev,
      careerProfiles: [
        ...prev.careerProfiles,
        {
          ...profile,
          id,
          userId: user?.id || "local",
          userName: user?.email || "You",
          householdId: householdId || "local",
          skills: [],
          achievements: [],
          careerGoals: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const updateCareerProfileLocal: BudgetContextType["updateCareerProfileLocal"] =
    (id, updates) => {
      setBudget((prev) => ({
        ...prev,
        careerProfiles: prev.careerProfiles.map((p) =>
          p.id === id
            ? { ...p, ...updates, updatedAt: new Date().toISOString() }
            : p,
        ),
      }));
    };

  const deleteCareerProfileLocal: BudgetContextType["deleteCareerProfileLocal"] =
    (id) => {
      setBudget((prev) => ({
        ...prev,
        careerProfiles: prev.careerProfiles.filter((p) => p.id !== id),
      }));
    };

  // Subscriptions DB-aware CRUD with fallback
  const addSubscription = (sub: Omit<Subscription, "id">) => {
    if (householdId && subsData?.available) {
      // Optimistic add
      const tempId = `tmp_${Date.now()}`;
      const optimistic: Subscription = { ...sub, id: tempId };
      setBudget((prev) => ({
        ...prev,
        subscriptions: [...prev.subscriptions, optimistic],
      }));

      createSubscriptionMutation.mutate(
        {
          name: sub.name,
          amount: sub.amount,
          nextDate: sub.nextDate,
          categoryId: sub.categoryId || null,
          confirmed: sub.confirmed,
          notes: (sub as any).notes,
          paymentAccountId: (sub as any).paymentAccountId,
        },
        {
          onSuccess: (row) => {
            setBudget((prev) => ({
              ...prev,
              subscriptions: prev.subscriptions.map((s) =>
                s.id === tempId ? { ...s, id: row.id } : s,
              ),
            }));
            toast.success("Subscription added");
          },
          onError: (e) => {
            // Rollback
            setBudget((prev) => ({
              ...prev,
              subscriptions: prev.subscriptions.filter((s) => s.id !== tempId),
            }));
            console.error("Failed to create subscription", e);
            toast.error("Failed to create subscription. Please try again.");
          },
        },
      );
    } else {
      addSubscriptionLocal(sub);
      toast.success("Subscription added (local)");
    }
  };
  const updateSubscription = (id: string, updates: Partial<Subscription>) => {
    // Optimistic update
    setBudget((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      ),
    }));

    if (householdId && subsData?.available) {
      updateSubscriptionMutation.mutate(
        {
          id,
          updates: {
            name: updates.name,
            amount: updates.amount,
            nextDate: updates.nextDate,
            categoryId: updates.categoryId,
            confirmed: updates.confirmed,
            notes: (updates as any).notes,
            paymentAccountId: (updates as any).paymentAccountId,
          },
        },
        {
          onSuccess: () => toast.success("Subscription updated"),
          onError: (e) => {
            console.error("Failed to update subscription", e);
            toast.error("Failed to update subscription. Please try again.");
          },
        },
      );
    }
  };
  const deleteSubscription = (id: string) => {
    // Optimistic delete
    setBudget((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.filter((s) => s.id !== id),
    }));

    if (householdId && subsData?.available) {
      deleteSubscriptionMutation.mutate(id, {
        onSuccess: () => toast.success("Subscription deleted"),
        onError: (e) => {
          console.error("Failed to delete subscription", e);
          toast.error("Failed to delete subscription. Please try again.");
        },
      });
    }
  };

  const repairBillExpenses = async () => {
    let fixedCount = 0;
    const billsToCheck = budget.bills.filter(
      (b) =>
        (b.paymentStatus === "paid" || b.paymentStatus === "partial") &&
        (b.amountPaid > 0 || b.amount > 0),
    );

    for (const bill of billsToCheck) {
      if (!householdId) continue; // Skip demo for now or handle locally if needed

      const hasExpense = budget.expenses.some(
        (e) => e.linkedBillId === bill.id,
      );
      if (!hasExpense) {
        // Create repair expense
        const repairAmount =
          bill.amountPaid > 0 ? bill.amountPaid : bill.amount;
        const note = `Repair: Backfilled payment for ${bill.name}`;

        try {
          // Use mutation directly to avoid double-bill-status-update logic in addExpense wrapper
          await createExpenseMutation.mutateAsync({
            amount: repairAmount,
            categoryId: bill.categoryId || "",
            date: bill.dueDate, // Use due date as best guess for payment date
            description: note,
            linkedBillId: bill.id,
            linkedSubscriptionId: undefined,
          });
          fixedCount++;
        } catch (e) {
          console.error(`Failed to backfill bill ${bill.name}`, e);
        }
      }
    }

    if (fixedCount > 0) {
      toast.success(`Repaired ${fixedCount} bill payment records`);
    } else {
      toast.info("No missing bill payments found");
    }
  };

  return (
    <HouseholdBudgetContext.Provider
      value={{
        budget,
        currentMonth: selectedMonth,
        setMonth,
        nextMonth,
        prevMonth,
        totalSpent,
        variableExpensesTotal,
        subscriptionMonthlyTotal,
        subscriptionCashflowTotal,
        remaining,
        budgetStatus,
        isLoading: isLoading || budgetLoading,
        error,
        householdId,
        addExpense,
        addCategory,
        updateCategory,
        deleteCategory,
        updateGoal,
        addGoal,
        deleteGoal,
        getCategoryById,
        getExpensesByCategory,
        getDailyAverage,
        getCategoryTrends,
        updateExpenseLocal,
        deleteExpenseLocal,
        addBillLocal,
        updateBillLocal,
        deleteBillLocal,
        addIncomeSourceLocal,
        updateIncomeSourceLocal,
        deleteIncomeSourceLocal,
        addIncomeEntryLocal,
        updateIncomeEntryLocal,
        deleteIncomeEntryLocal,
        addBankAccountLocal,
        updateBankAccountLocal,
        deleteBankAccountLocal,
        addCreditScoreLocal,
        deleteCreditScoreLocal,
        addSubscriptionLocal,
        updateSubscriptionLocal,
        deleteSubscriptionLocal,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        addTaskLocal,
        updateTaskLocal,
        deleteTaskLocal,
        addCareerProfileLocal,
        updateCareerProfileLocal,
        deleteCareerProfileLocal,
        quarterlySummaries,
        upsertQuarterlySummary,
        repairBillExpenses,
      }}
    >
      {children}
    </HouseholdBudgetContext.Provider>
  );
}

export function useHouseholdBudget() {
  const ctx = useContext(HouseholdBudgetContext);
  if (!ctx)
    throw new Error(
      "useHouseholdBudget must be used within HouseholdBudgetProvider",
    );
  return ctx;
}
