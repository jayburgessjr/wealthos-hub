import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/household-format";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import {
  Home,
  ShoppingBag,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Category, Expense } from "@/integrations/supabase/household-types";

interface BudgetRuleTrackerProps {
  categories: Category[];
  expenses: Expense[];
  income: number;
  currentMonth: string;
}

const TARGETS = { needs: 50, wants: 30, savings: 20 };

const COLORS = {
  needs: "hsl(var(--chart-1))",
  wants: "hsl(var(--chart-2))",
  savings: "hsl(var(--chart-3))",
};

function categorizeSpending(
  categories: Category[],
  expenses: Expense[],
): { needs: number; wants: number; savings: number } {
  let needs = 0;
  let wants = 0;
  let savings = 0;

  categories.forEach((cat) => {
    const catExpenses = expenses.filter((e) => e.categoryId === cat.id);
    const total = catExpenses.reduce((sum, e) => sum + e.amount, 0);

    switch (cat.type) {
      case "fixed":
        needs += total;
        break;
      case "variable":
        wants += total;
        break;
      case "savings":
        savings += total;
        break;
      case "debt":
        needs += total;
        break;
    }
  });

  return { needs, wants, savings };
}

function getStatus(
  actual: number,
  target: number,
  isLowerBetter: boolean,
): "safe" | "warning" | "danger" {
  const diff = actual - target;
  if (isLowerBetter) {
    if (diff <= 0) return "safe";
    if (diff <= 10) return "warning";
    return "danger";
  } else {
    if (diff >= 0) return "safe";
    if (diff >= -10) return "warning";
    return "danger";
  }
}

function StatusIcon({ status }: { status: "safe" | "warning" | "danger" }) {
  switch (status) {
    case "safe":
      return (
        <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-safe))]" />
      );
    case "warning":
      return (
        <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-warning))]" />
      );
    case "danger":
      return <XCircle className="h-4 w-4 text-[hsl(var(--status-danger))]" />;
  }
}

export function BudgetRuleTracker({
  categories,
  expenses,
  income,
  currentMonth,
}: BudgetRuleTrackerProps) {
  const monthlyExpenses = useMemo(
    () => expenses.filter((e) => e.date.startsWith(currentMonth)),
    [expenses, currentMonth],
  );

  const spending = useMemo(
    () => categorizeSpending(categories, monthlyExpenses),
    [categories, monthlyExpenses],
  );

  const totalSpent = spending.needs + spending.wants + spending.savings;

  const percentages = useMemo(() => {
    if (income <= 0) return { needs: 0, wants: 0, savings: 0 };
    return {
      needs: (spending.needs / income) * 100,
      wants: (spending.wants / income) * 100,
      savings: (spending.savings / income) * 100,
    };
  }, [spending, income]);

  const statuses = useMemo(
    () => ({
      needs: getStatus(percentages.needs, TARGETS.needs, true),
      wants: getStatus(percentages.wants, TARGETS.wants, true),
      savings: getStatus(percentages.savings, TARGETS.savings, false),
    }),
    [percentages],
  );

  const pieData = useMemo(
    () =>
      [
        {
          name: "Needs",
          value: spending.needs,
          target: TARGETS.needs,
          color: COLORS.needs,
        },
        {
          name: "Wants",
          value: spending.wants,
          target: TARGETS.wants,
          color: COLORS.wants,
        },
        {
          name: "Savings",
          value: spending.savings,
          target: TARGETS.savings,
          color: COLORS.savings,
        },
      ].filter((d) => d.value > 0),
    [spending],
  );

  const overallScore = useMemo(() => {
    let score = 100;
    if (percentages.needs > TARGETS.needs)
      score -= Math.min(30, (percentages.needs - TARGETS.needs) * 2);
    if (percentages.wants > TARGETS.wants)
      score -= Math.min(30, (percentages.wants - TARGETS.wants) * 2);
    if (percentages.savings < TARGETS.savings)
      score -= Math.min(40, (TARGETS.savings - percentages.savings) * 2);
    return Math.max(0, Math.round(score));
  }, [percentages]);

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              50/30/20 Budget Rule
            </CardTitle>
            <CardDescription>
              Track your spending against recommended allocations
            </CardDescription>
          </div>
          <Badge
            variant={
              overallScore >= 80
                ? "default"
                : overallScore >= 60
                  ? "secondary"
                  : "destructive"
            }
            className="text-lg px-3 py-1 font-mono"
          >
            {overallScore}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Needs</span>
                  <span className="text-xs text-muted-foreground">
                    (Fixed, Debt)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status={statuses.needs} />
                  <span className="font-mono font-bold">
                    {percentages.needs.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {TARGETS.needs}%
                  </span>
                </div>
              </div>
              <Progress
                value={Math.min(percentages.needs, 100)}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(spending.needs)} spent</span>
                <span>
                  Target: {formatCurrency((income * TARGETS.needs) / 100)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Wants</span>
                  <span className="text-xs text-muted-foreground">
                    (Variable)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status={statuses.wants} />
                  <span className="font-mono font-bold">
                    {percentages.wants.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {TARGETS.wants}%
                  </span>
                </div>
              </div>
              <Progress
                value={Math.min(percentages.wants, 100)}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(spending.wants)} spent</span>
                <span>
                  Target: {formatCurrency((income * TARGETS.wants) / 100)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Savings</span>
                  <span className="text-xs text-muted-foreground">
                    (Goals, Investments)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status={statuses.savings} />
                  <span className="font-mono font-bold">
                    {percentages.savings.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {TARGETS.savings}%
                  </span>
                </div>
              </div>
              <Progress
                value={Math.min(
                  (percentages.savings / TARGETS.savings) * 100,
                  100,
                )}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(spending.savings)} saved</span>
                <span>
                  Target: {formatCurrency((income * TARGETS.savings) / 100)}
                </span>
              </div>
            </div>

            {income > totalSpent && (
              <div className="mt-4 p-3 border-2 border-dashed border-border rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Unallocated</span>
                  <span className="font-mono font-bold text-[hsl(var(--status-safe))]">
                    {formatCurrency(income - totalSpent)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Consider moving to savings goals
                </p>
              </div>
            )}
          </div>

          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "2px solid hsl(var(--border))",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {statuses.needs === "danger" && (
            <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-sm">
                Your essential expenses are too high. Consider reducing fixed
                costs or finding cheaper alternatives.
              </p>
            </div>
          )}
          {statuses.wants === "danger" && (
            <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-sm">
                Discretionary spending is over budget. Try the 24-hour rule
                before non-essential purchases.
              </p>
            </div>
          )}
          {statuses.savings === "danger" && (
            <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-sm">
                You're not saving enough. Aim for at least 20% of income toward
                savings and investments.
              </p>
            </div>
          )}
          {overallScore >= 80 && (
            <div className="flex items-start gap-2 p-2 bg-[hsl(var(--status-safe))]/10 rounded-md">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-safe))] mt-0.5" />
              <p className="text-sm">
                Great job! You're following the 50/30/20 rule well. Keep it up!
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
