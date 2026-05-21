import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Category, Expense } from "@/integrations/supabase/household-types";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";

interface UseBudgetAlertsOptions {
  categories: Category[];
  expenses: Expense[];
  currentMonth: string;
  enabled?: boolean;
}

interface AlertState {
  [categoryId: string]: {
    warned80?: boolean;
    warned100?: boolean;
  };
}

export function useBudgetAlerts({
  categories,
  expenses,
  currentMonth,
  enabled = true,
}: UseBudgetAlertsOptions) {
  // Track which alerts have been shown to avoid duplicates
  const alertState = useRef<AlertState>({});
  const prevExpenseCount = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    // Only check when expenses are added (count increases)
    const currentCount = expenses.filter((e) =>
      e.date.startsWith(currentMonth),
    ).length;
    if (currentCount <= prevExpenseCount.current) {
      prevExpenseCount.current = currentCount;
      return;
    }
    prevExpenseCount.current = currentCount;

    // Calculate spending per category for current month
    const monthlyExpenses = expenses.filter((e) =>
      e.date.startsWith(currentMonth),
    );

    categories.forEach((category) => {
      if (category.monthlyLimit <= 0) return;

      const categoryExpenses = monthlyExpenses.filter(
        (e) => e.categoryId === category.id,
      );
      const spent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
      const percentage = (spent / category.monthlyLimit) * 100;

      const state = alertState.current[category.id] || {};

      // Check for 100% threshold (over budget)
      if (percentage >= 100 && !state.warned100) {
        toast.error(`🚨 Over Budget: ${category.name}`, {
          description: `You've spent $${spent.toFixed(2)} of your $${category.monthlyLimit} limit (${percentage.toFixed(0)}%)`,
          duration: 6000,
          action: {
            label: "View",
            onClick: () => {
              // Could navigate to category details
            },
          },
        });
        alertState.current[category.id] = {
          ...state,
          warned100: true,
          warned80: true,
        };
      }
      // Check for 80% threshold (warning)
      else if (percentage >= 80 && percentage < 100 && !state.warned80) {
        toast.warning(`⚠️ Budget Warning: ${category.name}`, {
          description: `You've used ${percentage.toFixed(0)}% of your $${category.monthlyLimit} budget. $${(category.monthlyLimit - spent).toFixed(2)} remaining.`,
          duration: 5000,
        });
        alertState.current[category.id] = { ...state, warned80: true };
      }
    });
  }, [categories, expenses, currentMonth, enabled]);

  // Reset alerts when month changes
  useEffect(() => {
    alertState.current = {};
    prevExpenseCount.current = 0;
  }, [currentMonth]);

  return null;
}

// Utility function to check budget status for a category
export function getCategoryBudgetStatus(
  categoryId: string,
  categories: Category[],
  expenses: Expense[],
  currentMonth: string,
): {
  spent: number;
  limit: number;
  percentage: number;
  status: "safe" | "warning" | "danger";
  remaining: number;
} {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    return { spent: 0, limit: 0, percentage: 0, status: "safe", remaining: 0 };
  }

  const monthlyExpenses = expenses.filter(
    (e) => e.categoryId === categoryId && e.date.startsWith(currentMonth),
  );
  const spent = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const limit = category.monthlyLimit;
  const percentage = limit > 0 ? (spent / limit) * 100 : 0;
  const remaining = Math.max(0, limit - spent);

  let status: "safe" | "warning" | "danger" = "safe";
  if (percentage >= 100) status = "danger";
  else if (percentage >= 80) status = "warning";

  return { spent, limit, percentage, status, remaining };
}

// Component to display inline budget status for a category
export function useCategoryBudgetCheck(
  categoryId: string | undefined,
  categories: Category[],
  expenses: Expense[],
  currentMonth: string,
) {
  if (!categoryId) {
    return null;
  }

  return getCategoryBudgetStatus(
    categoryId,
    categories,
    expenses,
    currentMonth,
  );
}
