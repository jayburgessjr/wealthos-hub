import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBudget,
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  createCategory,
  updateCategoryDb,
  deleteCategoryDb,
  createGoal,
  updateGoalDb,
  deleteGoalDb,
  updateHousehold,
  type CreateExpenseInput,
  type CreateCategoryInput,
  type CreateGoalInput,
  type UpdateHouseholdInput,
} from "@/integrations/supabase/household-queries";
import {
  fetchDebts,
  createDebt,
  updateDebtDb,
  deleteDebtDb,
  type CreateDebtInput,
} from "@/integrations/supabase/household-queries";
import {
  fetchSubscriptions,
  createSubscription,
  updateSubscriptionDb,
  deleteSubscriptionDb,
  type CreateSubscriptionInput,
} from "@/integrations/supabase/household-queries";
import {
  fetchTasks,
  createTask,
  updateTaskDb,
  deleteTaskDb,
  updateTaskPositions,
  type CreateTaskInput,
} from "@/integrations/supabase/household-queries";
import type {
  Subscription,
  Task,
} from "@/integrations/supabase/household-types";
import type { Budget, Expense } from "@/integrations/supabase/household-types";
import {
  fetchBills,
  createBill,
  updateBillDb,
  deleteBillDb,
  type CreateBillInput,
} from "@/integrations/supabase/household-queries";
import {
  fetchIncomeSources,
  fetchIncomeEntries,
  createIncomeSource,
  updateIncomeSourceDb,
  deleteIncomeSourceDb,
  createIncomeEntry,
  updateIncomeEntryDb,
  deleteIncomeEntryDb,
  fetchBankAccounts,
  createBankAccount,
  updateBankAccountDb,
  deleteBankAccountDb,
  fetchCreditScores,
  createCreditScore,
  deleteCreditScoreDb,
  type CreateIncomeSourceInput,
  type CreateIncomeEntryInput,
  type CreateBankAccountInput,
  type CreateCreditScoreInput,
} from "@/integrations/supabase/household-queries";
import {
  fetchQuarterlySummaries,
  upsertQuarterlySummary,
  deleteQuarterlySummary,
  type CreateQuarterlySummaryInput,
} from "@/integrations/supabase/household-queries";

export const budgetKeys = {
  all: ["household-budget"] as const,
  detail: (householdId: string, monthISO: string) =>
    ["household-budget", householdId, monthISO] as const,
  expenses: (householdId: string, monthISO: string) =>
    ["household-expenses", householdId, monthISO] as const,
  bills: (householdId: string) => ["household-bills", householdId] as const,
  categories: (householdId: string) =>
    ["household-categories", householdId] as const,
  goals: (householdId: string) => ["household-goals", householdId] as const,
  incomeSources: (householdId: string) =>
    ["household-income-sources", householdId] as const,
  incomeEntries: (householdId: string, monthISO: string) =>
    ["household-income-entries", householdId, monthISO] as const,
  bankAccounts: (householdId: string) =>
    ["household-bank-accounts", householdId] as const,
  creditScores: (householdId: string) =>
    ["household-credit-scores", householdId] as const,
  subscriptions: (householdId: string) =>
    ["household-subscriptions", householdId] as const,
  debts: (householdId: string) => ["household-debts", householdId] as const,
  tasks: (householdId: string) => ["household-tasks", householdId] as const,
  careerProfiles: (householdId: string) =>
    ["household-career-profiles", householdId] as const,
  skills: (careerProfileId: string) =>
    ["household-skills", careerProfileId] as const,
  achievements: (careerProfileId: string) =>
    ["household-achievements", careerProfileId] as const,
  careerGoals: (careerProfileId: string) =>
    ["household-career-goals", careerProfileId] as const,
  weeklySummaries: (householdId: string) =>
    ["household-weekly-summaries", householdId] as const,
  monthlySummaries: (householdId: string) =>
    ["household-monthly-summaries", householdId] as const,
  quarterlySummaries: (householdId: string) =>
    ["household-quarterly-summaries", householdId] as const,
};

export function useBudgetQuery(householdId: string | null, monthISO: string) {
  return useQuery<{ budget: Budget }, Error>({
    queryKey: householdId
      ? budgetKeys.detail(householdId, monthISO)
      : ["household-budget", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const { budget } = await fetchBudget(householdId, monthISO);
      return { budget };
    },
    enabled: !!householdId,
    refetchOnWindowFocus: true,
  });
}

export function useExpensesQuery(householdId: string | null, monthISO: string) {
  return useQuery<{ expenses: Expense[] }, Error>({
    queryKey: householdId
      ? budgetKeys.expenses(householdId, monthISO)
      : ["household-expenses", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const exps = await fetchExpenses(householdId, monthISO);
      // map to app Expense requires user names; for list views in this hook, just basic fields
      const expenses: Expense[] = exps.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        categoryId: e.category_id,
        date: e.date,
        description: e.description ?? undefined,
        userId: e.user_id,
        userName: "Member",
        linkedBillId: (e as any).linked_bill_id ?? undefined,
        linkedSubscriptionId: (e as any).linked_subscription_id ?? undefined,
        expenseType: (e as any).expense_type ?? "one_off",
        transactionDate: (e as any).transaction_date ?? e.date,
        postedDate: (e as any).posted_date ?? undefined,
      }));
      return { expenses };
    },
    enabled: !!householdId,
    refetchOnWindowFocus: true,
  });
}

export function useCreateExpenseMutation(
  householdId: string | null,
  userId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      if (!householdId || !userId) throw new Error("Missing auth/household");
      return await createExpense(householdId, userId, input);
    },
    onMutate: async (input) => {
      if (!householdId) return;
      await Promise.all([
        qc.cancelQueries({
          queryKey: budgetKeys.detail(householdId, monthISO),
        }),
        qc.cancelQueries({
          queryKey: budgetKeys.expenses(householdId, monthISO),
        }),
      ]);

      const prevBudget = qc.getQueryData<{ budget: Budget }>(
        budgetKeys.detail(householdId, monthISO),
      );
      const prevExpenses = qc.getQueryData<{ expenses: Expense[] }>(
        budgetKeys.expenses(householdId, monthISO),
      );

      const tempId = `tmp_${Date.now()}`;
      const optimisticExpense: Expense = {
        id: tempId,
        amount: input.amount,
        categoryId: input.categoryId,
        date: input.date,
        description: input.description,
        userId: userId ?? "me",
        userName: "You",
        expenseType: input.expenseType ?? "one_off",
        transactionDate: input.transactionDate ?? input.date,
        postedDate: input.postedDate,
      };

      // Update expenses list cache
      if (prevExpenses) {
        qc.setQueryData(budgetKeys.expenses(householdId, monthISO), {
          expenses: [optimisticExpense, ...prevExpenses.expenses],
        });
      }

      // Update budget cache: push expense and increment category spent
      if (prevBudget) {
        const updated: Budget = {
          ...prevBudget.budget,
          expenses: [optimisticExpense, ...prevBudget.budget.expenses],
          categories: prevBudget.budget.categories.map((cat) =>
            cat.id === input.categoryId
              ? { ...cat, spent: cat.spent + input.amount }
              : cat,
          ),
        };
        qc.setQueryData(budgetKeys.detail(householdId, monthISO), {
          budget: updated,
        });
      }

      return { prevBudget, prevExpenses, tempId };
    },
    onError: (_err, input, ctx) => {
      if (!householdId || !ctx) return;
      // rollback caches
      if (ctx.prevExpenses)
        qc.setQueryData(
          budgetKeys.expenses(householdId, monthISO),
          ctx.prevExpenses,
        );
      if (ctx.prevBudget)
        qc.setQueryData(
          budgetKeys.detail(householdId, monthISO),
          ctx.prevBudget,
        );
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.expenses(householdId, monthISO),
      });
      qc.invalidateQueries({
        queryKey: budgetKeys.detail(householdId, monthISO),
      });
    },
  });
}

export function useUpdateExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateExpenseInput> & { categoryId?: string };
    }) => {
      return await updateExpense(id, updates);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useDeleteExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteExpense(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useBillsQuery(householdId: string | null) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.bills(householdId)
      : ["household-bills", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const bills = await fetchBills(householdId);
      return { bills };
    },
    enabled: !!householdId,
  });
}

export function useCreateBillMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBillInput) => {
      if (!householdId) throw new Error("Missing household");
      return await createBill(householdId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.bills(householdId) });
    },
  });
}

export function useUpdateBillMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateBillInput>;
    }) => updateBillDb(id, updates),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.bills(householdId) });
    },
  });
}

export function useDeleteBillMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteBillDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.bills(householdId) });
    },
  });
}

// Income sources
export function useIncomeSourcesQuery(householdId: string | null) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.incomeSources(householdId)
      : ["household-income-sources", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const sources = await fetchIncomeSources(householdId);
      return { sources };
    },
    enabled: !!householdId,
  });
}

export function useCreateIncomeSourceMutation(
  householdId: string | null,
  userId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateIncomeSourceInput) => {
      if (!householdId || !userId) throw new Error("Missing auth/household");
      return await createIncomeSource(householdId, userId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.incomeSources(householdId) });
    },
  });
}

export function useUpdateIncomeSourceMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateIncomeSourceInput>;
    }) => updateIncomeSourceDb(id, updates),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.incomeSources(householdId) });
    },
  });
}

export function useDeleteIncomeSourceMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteIncomeSourceDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.incomeSources(householdId) });
    },
  });
}

// Income entries
export function useIncomeEntriesQuery(
  householdId: string | null,
  monthISO: string,
) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.incomeEntries(householdId, monthISO)
      : ["household-income-entries", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const entries = await fetchIncomeEntries(householdId, monthISO);
      return { entries };
    },
    enabled: !!householdId,
  });
}

export function useCreateIncomeEntryMutation(
  householdId: string | null,
  userId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateIncomeEntryInput) => {
      if (!householdId || !userId) throw new Error("Missing auth/household");
      return await createIncomeEntry(householdId, userId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({
        queryKey: budgetKeys.incomeEntries(householdId, monthISO),
      });
    },
  });
}

export function useUpdateIncomeEntryMutation(
  householdId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateIncomeEntryInput>;
    }) => updateIncomeEntryDb(id, updates),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({
        queryKey: budgetKeys.incomeEntries(householdId, monthISO),
      });
    },
  });
}

export function useDeleteIncomeEntryMutation(
  householdId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteIncomeEntryDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({
        queryKey: budgetKeys.incomeEntries(householdId, monthISO),
      });
    },
  });
}

// Bank accounts
export function useBankAccountsQuery(householdId: string | null) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.bankAccounts(householdId)
      : ["household-bank-accounts", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const accounts = await fetchBankAccounts(householdId);
      return { accounts };
    },
    enabled: !!householdId,
  });
}

export function useCreateBankAccountMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBankAccountInput) => {
      if (!householdId) throw new Error("Missing household");
      return await createBankAccount(householdId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.bankAccounts(householdId) });
    },
  });
}

export function useUpdateBankAccountMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateBankAccountInput>;
    }) => updateBankAccountDb(id, updates),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.bankAccounts(householdId) });
    },
  });
}

export function useDeleteBankAccountMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteBankAccountDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.bankAccounts(householdId) });
    },
  });
}

// Credit scores
export function useCreditScoresQuery(householdId: string | null) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.creditScores(householdId)
      : ["household-credit-scores", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const scores = await fetchCreditScores(householdId);
      return { scores };
    },
    enabled: !!householdId,
  });
}

export function useCreateCreditScoreMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCreditScoreInput) => {
      if (!householdId) throw new Error("Missing household");
      return await createCreditScore(householdId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.creditScores(householdId) });
    },
  });
}

export function useDeleteCreditScoreMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteCreditScoreDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.creditScores(householdId) });
    },
  });
}

// Categories
export function useCreateCategoryMutation(
  householdId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      if (!householdId) throw new Error("Missing household");
      return await createCategory(householdId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.detail(householdId, monthISO),
      });
    },
  });
}

export function useUpdateCategoryMutation(
  householdId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateCategoryInput>;
    }) => updateCategoryDb(id, updates),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.detail(householdId, monthISO),
      });
    },
  });
}

export function useDeleteCategoryMutation(
  householdId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteCategoryDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.detail(householdId, monthISO),
      });
    },
  });
}

// Goals
export function useCreateGoalMutation(
  householdId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGoalInput) => {
      if (!householdId) throw new Error("Missing household");
      return await createGoal(householdId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.detail(householdId, monthISO),
      });
    },
  });
}

export function useUpdateGoalMutation(
  householdId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateGoalInput>;
    }) => updateGoalDb(id, updates),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.detail(householdId, monthISO),
      });
    },
  });
}

export function useDeleteGoalMutation(
  householdId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteGoalDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.detail(householdId, monthISO),
      });
    },
  });
}

// Household
export function useUpdateHouseholdMutation(
  householdId: string | null,
  monthISO: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: UpdateHouseholdInput) => {
      if (!householdId) throw new Error("Missing household");
      return await updateHousehold(householdId, updates);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({
        queryKey: budgetKeys.detail(householdId, monthISO),
      });
    },
  });
}

// Subscriptions
export function useSubscriptionsQuery(householdId: string | null) {
  return useQuery<{ subscriptions: Subscription[]; available: boolean }, Error>(
    {
      queryKey: householdId
        ? budgetKeys.subscriptions(householdId)
        : ["household-subscriptions", "no-household"],
      queryFn: async () => {
        if (!householdId) throw new Error("No household");
        const { items, available } = await fetchSubscriptions(householdId);
        const subscriptions: Subscription[] = items.map((s: any) => ({
          id: s.id,
          name: s.name,
          amount: Number(s.amount ?? 0),
          categoryId: s.category_id ?? "",
          nextDate: s.next_date,
          confirmed: !!s.confirmed,
          notes: s.notes ?? undefined,
          paymentAccountId: s.payment_account_id ?? undefined,
          frequency: s.frequency === "yearly" ? "yearly" : "monthly",
          isAutoPay: !!s.is_auto_pay,
        }));
        return { subscriptions, available };
      },
      enabled: !!householdId,
    },
  );
}

export function useCreateSubscriptionMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      if (!householdId) throw new Error("Missing household");
      return await createSubscription(householdId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.subscriptions(householdId) });
    },
  });
}

export function useUpdateSubscriptionMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateSubscriptionInput>;
    }) => updateSubscriptionDb(id, updates),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.subscriptions(householdId) });
    },
  });
}

export function useDeleteSubscriptionMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteSubscriptionDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.subscriptions(householdId) });
    },
  });
}

// Debts
export function useDebtsQuery(householdId: string | null) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.debts(householdId)
      : ["household-debts", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const debts = await fetchDebts(householdId);
      return { debts };
    },
    enabled: !!householdId,
  });
}

export function useCreateDebtMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDebtInput) => {
      if (!householdId) throw new Error("Missing household");
      return await createDebt(householdId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.debts(householdId) });
    },
  });
}

export function useUpdateDebtMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateDebtInput>;
    }) => updateDebtDb(id, updates),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.debts(householdId) });
    },
  });
}

export function useDeleteDebtMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteDebtDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.debts(householdId) });
    },
  });
}

// ==================== TASKS ====================

export function useTasksQuery(householdId: string | null) {
  return useQuery<{ tasks: Task[] }, Error>({
    queryKey: householdId
      ? budgetKeys.tasks(householdId)
      : ["household-tasks", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const rawTasks = await fetchTasks(householdId);
      // Map DB rows to Task type
      const tasks: Task[] = rawTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description ?? undefined,
        status: t.status as Task["status"],
        priority: t.priority as Task["priority"],
        dueDate: t.due_date ?? undefined,
        assignedTo: t.assigned_to ?? undefined,
        assignedToName: undefined, // Will be filled by profiles if needed
        tags: t.tags ?? [],
        createdBy: t.created_by,
        createdByName: "Member", // Placeholder
        householdId: t.household_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        position: t.position,
      }));
      return { tasks };
    },
    enabled: !!householdId,
    refetchOnWindowFocus: true,
  });
}

export function useCreateTaskMutation(
  householdId: string | null,
  userId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      if (!householdId || !userId) throw new Error("Missing auth/household");
      return await createTask(householdId, userId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.tasks(householdId) });
    },
  });
}

export function useUpdateTaskMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CreateTaskInput>;
    }) => updateTaskDb(id, updates),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.tasks(householdId) });
    },
  });
}

export function useDeleteTaskMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteTaskDb(id),
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.tasks(householdId) });
    },
  });
}

export function useUpdateTaskPositionsMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      updates: { id: string; status: string; position: number }[],
    ) => updateTaskPositions(updates),
    onMutate: async (updates) => {
      if (!householdId) return;
      await qc.cancelQueries({ queryKey: budgetKeys.tasks(householdId) });
      const prev = qc.getQueryData(budgetKeys.tasks(householdId));

      qc.setQueryData(
        budgetKeys.tasks(householdId),
        (old: { tasks: Task[] } | undefined) => {
          if (!old?.tasks) return old;
          const tasksMap = new Map<string, Task>(
            old.tasks.map((t: Task) => [t.id, t]),
          );
          updates.forEach(({ id, status, position }) => {
            const task = tasksMap.get(id);
            if (task) {
              tasksMap.set(id, {
                ...task,
                status: status as Task["status"],
                position,
              });
            }
          });
          return { tasks: Array.from(tasksMap.values()) };
        },
      );

      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev && householdId) {
        qc.setQueryData(budgetKeys.tasks(householdId), ctx.prev);
      }
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: budgetKeys.all });
      qc.invalidateQueries({ queryKey: budgetKeys.tasks(householdId) });
    },
  });
}

// ==================== CAREER PROFILES ====================

export function useCareerProfilesQuery(householdId: string | null) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.careerProfiles(householdId)
      : ["household-career-profiles", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const { fetchCareerProfiles } =
        await import("@/integrations/supabase/household-queries");
      return await fetchCareerProfiles(householdId);
    },
    enabled: !!householdId,
  });
}

export function useCreateCareerProfileMutation(
  householdId: string | null,
  userId: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      if (!householdId || !userId) throw new Error("Missing auth/household");
      const { createCareerProfile } =
        await import("@/integrations/supabase/household-queries");
      return await createCareerProfile(householdId, userId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.careerProfiles(householdId),
      });
    },
  });
}

export function useUpdateCareerProfileMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { updateCareerProfileDb } =
        await import("@/integrations/supabase/household-queries");
      return await updateCareerProfileDb(id, updates);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.careerProfiles(householdId),
      });
    },
  });
}

export function useDeleteCareerProfileMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { deleteCareerProfileDb } =
        await import("@/integrations/supabase/household-queries");
      return await deleteCareerProfileDb(id);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.careerProfiles(householdId),
      });
    },
  });
}

// ==================== SKILLS ====================

export function useCreateSkillMutation(careerProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const { createSkill } =
        await import("@/integrations/supabase/household-queries");
      return await createSkill(careerProfileId, input);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.skills(careerProfileId) });
    },
  });
}

export function useUpdateSkillMutation(careerProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { updateSkillDb } =
        await import("@/integrations/supabase/household-queries");
      return await updateSkillDb(id, updates);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.skills(careerProfileId) });
    },
  });
}

export function useDeleteSkillMutation(careerProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { deleteSkillDb } =
        await import("@/integrations/supabase/household-queries");
      return await deleteSkillDb(id);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.skills(careerProfileId) });
    },
  });
}

// ==================== ACHIEVEMENTS ====================

export function useCreateAchievementMutation(careerProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const { createAchievement } =
        await import("@/integrations/supabase/household-queries");
      return await createAchievement(careerProfileId, input);
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: budgetKeys.achievements(careerProfileId),
      });
    },
  });
}

export function useDeleteAchievementMutation(careerProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { deleteAchievementDb } =
        await import("@/integrations/supabase/household-queries");
      return await deleteAchievementDb(id);
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: budgetKeys.achievements(careerProfileId),
      });
    },
  });
}

// ==================== CAREER GOALS ====================

export function useCreateCareerGoalMutation(careerProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      const { createCareerGoal } =
        await import("@/integrations/supabase/household-queries");
      return await createCareerGoal(careerProfileId, input);
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: budgetKeys.careerGoals(careerProfileId),
      });
    },
  });
}

export function useUpdateCareerGoalMutation(careerProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { updateCareerGoalDb } =
        await import("@/integrations/supabase/household-queries");
      return await updateCareerGoalDb(id, updates);
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: budgetKeys.careerGoals(careerProfileId),
      });
    },
  });
}

export function useDeleteCareerGoalMutation(careerProfileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { deleteCareerGoalDb } =
        await import("@/integrations/supabase/household-queries");
      return await deleteCareerGoalDb(id);
    },
    onSettled: () => {
      qc.invalidateQueries({
        queryKey: budgetKeys.careerGoals(careerProfileId),
      });
    },
  });
}

// ==================== SUMMARIES ====================

export function useWeeklySummariesQuery(householdId: string | null) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.weeklySummaries(householdId)
      : ["household-weekly-summaries", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const { fetchWeeklySummaries } =
        await import("@/integrations/supabase/household-queries");
      return await fetchWeeklySummaries(householdId);
    },
    enabled: !!householdId,
  });
}

export function useCreateWeeklySummaryMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      if (!householdId) throw new Error("No household");
      const { createWeeklySummary } =
        await import("@/integrations/supabase/household-queries");
      return await createWeeklySummary(householdId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.weeklySummaries(householdId),
      });
    },
  });
}

export function useUpdateWeeklySummaryMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { updateWeeklySummary } =
        await import("@/integrations/supabase/household-queries");
      return await updateWeeklySummary(id, updates);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.weeklySummaries(householdId),
      });
    },
  });
}

export function useDeleteWeeklySummaryMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { deleteWeeklySummary } =
        await import("@/integrations/supabase/household-queries");
      return await deleteWeeklySummary(id);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.weeklySummaries(householdId),
      });
    },
  });
}

export function useMonthlySummariesQuery(householdId: string | null) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.monthlySummaries(householdId)
      : ["household-monthly-summaries", "no-household"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const { fetchMonthlySummaries } =
        await import("@/integrations/supabase/household-queries");
      return await fetchMonthlySummaries(householdId);
    },
    enabled: !!householdId,
  });
}

export function useCreateMonthlySummaryMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: any) => {
      if (!householdId) throw new Error("No household");
      const { createMonthlySummary } =
        await import("@/integrations/supabase/household-queries");
      return await createMonthlySummary(householdId, input);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.monthlySummaries(householdId),
      });
    },
  });
}

export function useUpdateMonthlySummaryMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { updateMonthlySummary } =
        await import("@/integrations/supabase/household-queries");
      return await updateMonthlySummary(id, updates);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.monthlySummaries(householdId),
      });
    },
  });
}

export function useDeleteMonthlySummaryMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { deleteMonthlySummary } =
        await import("@/integrations/supabase/household-queries");
      return await deleteMonthlySummary(id);
    },
    onSettled: () => {
      if (!householdId) return;
      qc.invalidateQueries({
        queryKey: budgetKeys.monthlySummaries(householdId),
      });
    },
  });
}

// ==================== QUARTERLY SUMMARIES ====================

export function useQuarterlySummariesQuery(householdId: string | null) {
  return useQuery({
    queryKey: householdId
      ? budgetKeys.quarterlySummaries(householdId)
      : ["household-quarterly-summaries", "no-household"],
    queryFn: () => fetchQuarterlySummaries(householdId!),
    enabled: !!householdId,
  });
}

export function useUpsertQuarterlySummaryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuarterlySummaryInput) =>
      upsertQuarterlySummary(input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: budgetKeys.quarterlySummaries(vars.householdId),
      });
    },
  });
}

export function useDeleteQuarterlySummaryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; householdId: string }) =>
      deleteQuarterlySummary(id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: budgetKeys.quarterlySummaries(vars.householdId),
      });
    },
  });
}
