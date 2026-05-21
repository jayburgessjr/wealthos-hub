import { useMemo } from "react";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Clock, Star } from "lucide-react";
import { formatCurrency } from "@/lib/household-format";

interface QuickExpensePattern {
  id: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  averageAmount: number;
  expenseType: "one_off" | "recurring" | "bill_payment" | "subscription";
  linkedBillId?: string;
  linkedSubscriptionId?: string;
  linkedBillName?: string;
  linkedSubscriptionName?: string;
  frequency: number; // How many times this pattern occurred
}

interface QuickExpenseEntryProps {
  onSelectPattern: (pattern: {
    description: string;
    categoryId: string;
    amount: number;
    expenseType: "one_off" | "recurring" | "bill_payment" | "subscription";
    linkedBillId?: string;
    linkedSubscriptionId?: string;
  }) => void;
}

export function QuickExpenseEntry({ onSelectPattern }: QuickExpenseEntryProps) {
  const { budget } = useHouseholdBudget();

  // Analyze recent expenses to find patterns
  const patterns = useMemo(() => {
    const expensePatterns = new Map<
      string,
      {
        descriptions: string[];
        amounts: number[];
        categoryId: string;
        expenseType: "one_off" | "recurring" | "bill_payment" | "subscription";
        linkedBillId?: string;
        linkedSubscriptionId?: string;
        count: number;
      }
    >();

    // Group expenses by normalized description + category
    budget.expenses.forEach((expense) => {
      if (!expense.description) return;

      const normalizedDesc = expense.description.toLowerCase().trim();
      const key = `${normalizedDesc}|${expense.categoryId}`;

      const existing = expensePatterns.get(key);
      if (existing) {
        existing.descriptions.push(expense.description);
        existing.amounts.push(expense.amount);
        existing.count++;
        // Prefer linked items if found
        if (expense.linkedBillId) existing.linkedBillId = expense.linkedBillId;
        if (expense.linkedSubscriptionId)
          existing.linkedSubscriptionId = expense.linkedSubscriptionId;
        if (expense.expenseType !== "one_off")
          existing.expenseType = expense.expenseType;
      } else {
        expensePatterns.set(key, {
          descriptions: [expense.description],
          amounts: [expense.amount],
          categoryId: expense.categoryId,
          expenseType: expense.expenseType,
          linkedBillId: expense.linkedBillId,
          linkedSubscriptionId: expense.linkedSubscriptionId,
          count: 1,
        });
      }
    });

    // Convert to sorted array and enhance with category info
    const results: QuickExpensePattern[] = [];

    expensePatterns.forEach((data, key) => {
      // Only include patterns that occurred at least once
      const category = budget.categories.find((c) => c.id === data.categoryId);
      if (!category) return;

      const avgAmount =
        data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;
      const mostCommonDesc = data.descriptions[data.descriptions.length - 1]; // Use most recent description

      const linkedBill = data.linkedBillId
        ? budget.bills.find((b) => b.id === data.linkedBillId)
        : undefined;
      const linkedSub = data.linkedSubscriptionId
        ? budget.subscriptions.find((s) => s.id === data.linkedSubscriptionId)
        : undefined;

      results.push({
        id: key,
        description: mostCommonDesc,
        categoryId: data.categoryId,
        categoryName: category.name,
        categoryIcon: category.icon || "📦",
        averageAmount: Math.round(avgAmount * 100) / 100,
        expenseType: data.expenseType,
        linkedBillId: data.linkedBillId,
        linkedSubscriptionId: data.linkedSubscriptionId,
        linkedBillName: linkedBill?.name,
        linkedSubscriptionName: linkedSub?.name,
        frequency: data.count,
      });
    });

    // Sort by frequency (most common first), then by most recent
    return results.sort((a, b) => b.frequency - a.frequency).slice(0, 8);
  }, [budget.expenses, budget.categories, budget.bills, budget.subscriptions]);

  // Get bill payments that are due/recurring
  const upcomingBillPayments = useMemo(() => {
    return budget.bills
      .filter((bill) => bill.isActive && bill.paymentStatus !== "paid")
      .slice(0, 3)
      .map((bill) => {
        const category = budget.categories.find(
          (c) => c.id === bill.categoryId,
        );
        return {
          id: `bill-${bill.id}`,
          description: bill.name,
          categoryId: bill.categoryId || "",
          categoryName: category?.name || "Bills",
          categoryIcon: category?.icon || "📄",
          averageAmount: bill.amount,
          expenseType: "bill_payment" as const,
          linkedBillId: bill.id,
          linkedBillName: bill.name,
          frequency: 0,
        };
      });
  }, [budget.bills, budget.categories]);

  // Get upcoming subscriptions
  const upcomingSubscriptions = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return budget.subscriptions
      .filter((sub) => {
        if (!sub.confirmed) return false; // Use confirmed as a proxy for active
        const nextDate = new Date(sub.nextDate);
        return nextDate <= nextWeek;
      })
      .slice(0, 3)
      .map((sub) => {
        const category = budget.categories.find((c) => c.id === sub.categoryId);
        return {
          id: `sub-${sub.id}`,
          description: sub.name,
          categoryId: sub.categoryId || "",
          categoryName: category?.name || "Subscriptions",
          categoryIcon: category?.icon || "🔄",
          averageAmount: sub.amount,
          expenseType: "subscription" as const,
          linkedSubscriptionId: sub.id,
          linkedSubscriptionName: sub.name,
          frequency: 0,
        };
      });
  }, [budget.subscriptions, budget.categories]);

  const handleSelect = (pattern: QuickExpensePattern) => {
    onSelectPattern({
      description: pattern.description,
      categoryId: pattern.categoryId,
      amount: pattern.averageAmount,
      expenseType: pattern.expenseType,
      linkedBillId: pattern.linkedBillId,
      linkedSubscriptionId: pattern.linkedSubscriptionId,
    });
  };

  const hasPatterns = patterns.length > 0;
  const hasBills = upcomingBillPayments.length > 0;
  const hasSubscriptions = upcomingSubscriptions.length > 0;

  if (!hasPatterns && !hasBills && !hasSubscriptions) {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase">
          <Zap className="h-4 w-4 text-primary" />
          Quick Entry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bill Payments Due */}
        {hasBills && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase">
              <Clock className="h-3 w-3" />
              Bills Due
            </div>
            <div className="flex flex-wrap gap-2">
              {upcomingBillPayments.map((pattern) => (
                <Button
                  key={pattern.id}
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-3 font-mono text-xs gap-2"
                  onClick={() => handleSelect(pattern as QuickExpensePattern)}
                >
                  <span>{pattern.categoryIcon}</span>
                  <span className="truncate max-w-[120px]">
                    {pattern.description}
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {formatCurrency(pattern.averageAmount)}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Subscriptions */}
        {hasSubscriptions && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase">
              <TrendingUp className="h-3 w-3" />
              Due Soon
            </div>
            <div className="flex flex-wrap gap-2">
              {upcomingSubscriptions.map((pattern) => (
                <Button
                  key={pattern.id}
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-3 font-mono text-xs gap-2"
                  onClick={() => handleSelect(pattern as QuickExpensePattern)}
                >
                  <span>{pattern.categoryIcon}</span>
                  <span className="truncate max-w-[120px]">
                    {pattern.description}
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {formatCurrency(pattern.averageAmount)}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Frequent Patterns */}
        {hasPatterns && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase">
              <Star className="h-3 w-3" />
              Recent Transactions
            </div>
            <div className="flex flex-wrap gap-2">
              {patterns.map((pattern) => (
                <Button
                  key={pattern.id}
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-3 font-mono text-xs gap-2"
                  onClick={() => handleSelect(pattern)}
                >
                  <span>{pattern.categoryIcon}</span>
                  <span className="truncate max-w-[120px]">
                    {pattern.description}
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {formatCurrency(pattern.averageAmount)}
                  </Badge>
                  {pattern.frequency > 1 && (
                    <span className="text-muted-foreground">
                      ×{pattern.frequency}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
