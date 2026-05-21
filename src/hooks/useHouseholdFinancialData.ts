import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import type { BudgetData } from "@/services/householdAiService";

export function useHouseholdFinancialData() {
  const { user } = useAuth();

  // Fetch user profile to get household_id
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { budget, totalSpent, remaining } = useHouseholdBudget();
  const householdId = profile?.household_id;

  // Fetch credit scores
  const { data: creditScoresData } = useQuery({
    queryKey: ["financial-credit-scores", householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("credit_scores")
        .select("*")
        .eq("household_id", householdId)
        .order("date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!householdId,
    staleTime: 0,
  });
  const creditScores = Array.isArray(creditScoresData) ? creditScoresData : [];

  // Fetch bank accounts
  const { data: bankAccountsData } = useQuery({
    queryKey: ["financial-bank-accounts", householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("household_id", householdId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!householdId,
    staleTime: 0,
  });
  const bankAccounts = Array.isArray(bankAccountsData) ? bankAccountsData : [];

  // Fetch bills
  const { data: billsData } = useQuery({
    queryKey: ["financial-bills", householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("household_id", householdId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!householdId,
    staleTime: 0,
  });
  const bills = Array.isArray(billsData) ? billsData : [];

  // Fetch income sources
  const { data: incomeSourcesData } = useQuery({
    queryKey: ["financial-income-sources", householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("income_sources")
        .select("*")
        .eq("household_id", householdId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!householdId,
    staleTime: 0,
  });
  const incomeSources = Array.isArray(incomeSourcesData)
    ? incomeSourcesData
    : [];

  // Fetch recent expenses with category names
  const { data: recentExpensesData } = useQuery({
    queryKey: ["financial-recent-expenses", householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*, categories(name)")
        .eq("household_id", householdId)
        .order("date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (
        data?.map((e) => ({
          description: e.description,
          amount: e.amount,
          categoryName: (e.categories as any)?.name || "Unknown",
          date: e.date,
        })) || []
      );
    },
    enabled: !!householdId,
    staleTime: 0,
  });
  const recentExpenses = Array.isArray(recentExpensesData)
    ? recentExpensesData
    : [];

  // Build comprehensive budget data for AI
  const budgetData: BudgetData = {
    income: budget.income,
    totalSpent,
    remaining,
    categories: budget.categories.map((c) => ({
      name: c.name,
      spent: c.spent,
      monthlyLimit: c.monthlyLimit,
    })),
    goals: budget.goals.map((g) => ({
      name: g.name,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      targetDate: g.deadline, // Map deadline to targetDate for AI
    })),
    recentExpenses,
    creditScores: creditScores.map((cs) => ({
      score: cs.score,
      bureau: cs.bureau || undefined,
      date: cs.date,
    })),
    bankAccounts: bankAccounts.map((acc) => ({
      name: acc.name,
      type: acc.type,
      current_balance: acc.current_balance,
    })),
    bills: bills.map((b) => ({
      name: b.name,
      amount: b.amount,
      due_date: b.due_date,
      payment_status: b.payment_status,
    })),
    incomeSources: incomeSources.map((src) => ({
      name: src.name,
      type: src.type,
      expected_amount: src.expected_amount || undefined,
      frequency: src.frequency || undefined,
    })),
  };

  const hasData =
    budget.income > 0 ||
    budget.categories.length > 0 ||
    creditScores.length > 0 ||
    bankAccounts.length > 0;

  return {
    budgetData,
    hasData,
    creditScores,
    bankAccounts,
    bills,
    incomeSources,
    recentExpenses,
  };
}
