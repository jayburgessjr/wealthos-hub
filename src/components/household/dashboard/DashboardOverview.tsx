import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/household-format";
import { StatCard } from "./StatCard";
import { RecentActivity } from "./RecentActivity";
import {
  Wallet,
  Shield,
  Receipt,
  Rocket,
  Landmark,
  Smile,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";

export function DashboardOverview() {
  const {
    budget,
    totalSpent,
    isLoading,
    remaining,
    subscriptionCashflowTotal,
    getDailyAverage,
  } = useHouseholdBudget();
  const navigate = useNavigate();

  const {
    monthIncome,
    cashTotal,
    flexMoney,
    goalContributionTotal,
    billsDueAmount,
    existingFixedCostsTotal,
    billsPaidCount,
    billsTotalCount,
    billsPaidAmount,
    billsTotalAmount,
  } = useMemo(() => {
    const monthStr = budget.month;
    const incomeEntriesThisMonth = budget.incomeEntries.filter((e) =>
      e.date.startsWith(monthStr),
    );
    const monthIncomeVal = incomeEntriesThisMonth.reduce(
      (s, e) => s + (e.amount ?? 0),
      0,
    );

    const cash = budget.bankAccounts
      .filter((a) => a.isActive)
      .reduce((s, a) => s + (a.currentBalance ?? 0), 0);

    const flexMoneyVal = budget.categories
      .filter((c) => c.type === "variable")
      .reduce((s, c) => s + Math.max(0, c.monthlyLimit - c.spent), 0);

    const goalContributionTotalVal = budget.goals.reduce(
      (s, g) => s + g.monthlyContribution,
      0,
    );

    const billsThisMonth = budget.bills.filter(
      (b) => b.dueDate.startsWith(budget.month) && b.isActive !== false,
    );
    const billsPaid = billsThisMonth.filter((b) => b.paymentStatus === "paid");
    const billsPaidAmt = billsPaid.reduce(
      (s, b) => s + (b.amountPaid || b.amount),
      0,
    );

    const billsTotalAmt = billsThisMonth.reduce((s, b) => s + b.amount, 0);

    const existingFixedCostsTotalVal =
      billsTotalAmt + subscriptionCashflowTotal;

    return {
      monthIncome: monthIncomeVal,
      cashTotal: cash,
      flexMoney: flexMoneyVal,
      goalContributionTotal: goalContributionTotalVal,
      billsDueAmount: billsTotalAmt,
      existingFixedCostsTotal: existingFixedCostsTotalVal,
      billsPaidCount: billsPaid.length,
      billsTotalCount: billsThisMonth.length,
      billsPaidAmount: billsPaidAmt,
      billsTotalAmount: billsTotalAmt,
    };
  }, [budget, subscriptionCashflowTotal]);

  const alerts = useMemo(() => {
    const list: { type: string; message: string }[] = [];
    budget.categories.forEach((c) => {
      if (c.spent > c.monthlyLimit) {
        list.push({
          type: "danger",
          message: `${c.name} is over budget by ${formatCurrency(c.spent - c.monthlyLimit)}`,
        });
      } else if (c.spent > c.monthlyLimit * 0.9) {
        list.push({
          type: "warning",
          message: `${c.name} is approaching limit`,
        });
      }
    });
    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);
    budget.bills.forEach((b) => {
      if (b.paymentStatus !== "paid") {
        const dueDate = new Date(b.dueDate);
        if (dueDate >= today && dueDate <= next7Days) {
          const days = differenceInDays(dueDate, today);
          list.push({
            type: "info",
            message: `${b.name} due in ${days} days (${formatCurrency(b.amount)})`,
          });
        }
      }
    });
    return list;
  }, [budget]);

  const topCategories = useMemo(() => {
    return [...budget.categories].sort((a, b) => b.spent - a.spent).slice(0, 4);
  }, [budget.categories]);

  const incomeList = useMemo(() => {
    return budget.incomeEntries
      .filter((e) => e.date.startsWith(budget.month))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [budget.incomeEntries, budget.month]);

  const existingFixedCostsBudget =
    budget.billsBudget + budget.subscriptionBudget;
  const variableExpensesTotal = useMemo(() => {
    return budget.expenses
      .filter((e) => !e.linkedBillId && !e.linkedSubscriptionId)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [budget.expenses]);

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
          <StatCard
            title="Income Received"
            value={formatCurrency(Math.round(monthIncome))}
            description="Total received this month"
            icon={<Wallet className="w-4 h-4" />}
            tone="success"
          />
          <StatCard
            title="Fixed Costs"
            value={formatCurrency(existingFixedCostsTotal)}
            description={`${formatCurrency(billsDueAmount)} Bills • ${formatCurrency(subscriptionCashflowTotal)} Subs`}
            icon={<Shield className="w-4 h-4" />}
            tone="default"
          />
          <StatCard
            title="Variable Spending"
            value={formatCurrency(variableExpensesTotal)}
            description="Excludes bills & subscriptions"
            icon={<Receipt className="w-4 h-4" />}
            tone={
              budget.expensesBudget > 0
                ? variableExpensesTotal <= budget.expensesBudget
                  ? "success"
                  : "danger"
                : "default"
            }
          />
          <StatCard
            title="Goal Velocity"
            value={formatCurrency(goalContributionTotal)}
            description="Invested in your vision"
            icon={<Rocket className="w-4 h-4" />}
            tone="success"
          />
          <StatCard
            title="Cash on Hand"
            value={formatCurrency(cashTotal)}
            description="Total liquid assets"
            icon={<Landmark className="w-4 h-4" />}
            tone="default"
          />
          <StatCard
            title="Safe to Spend"
            value={formatCurrency(flexMoney)}
            description="Left for lifestyle"
            icon={<Smile className="w-4 h-4" />}
            tone={flexMoney > 0 ? "success" : "warning"}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Bills Progress</CardTitle>
              <Badge variant="outline">
                {billsPaidCount} / {billsTotalCount} paid
              </Badge>
            </div>
            <CardDescription>Paid vs total bills this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Bills Paid</span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(billsPaidAmount)} /{" "}
                    {formatCurrency(billsTotalAmount)}
                  </span>
                </div>
                <Progress
                  value={
                    billsTotalAmount > 0
                      ? (billsPaidAmount / billsTotalAmount) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>{billsTotalCount - billsPaidCount} bills remaining</span>
                <span>
                  {formatCurrency(billsTotalAmount - billsPaidAmount)} left to
                  pay
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Spending Flow</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1"
                onClick={() => navigate("/household/dashboard?tab=reporting")}
              >
                VIEW ALL <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <CardDescription>Top categories by spend</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.icon || "📦"}</span>
                  <div>
                    <p className="text-sm font-medium leading-none">
                      {cat.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {cat.type}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">
                    {formatCurrency(cat.spent)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(cat.monthlyLimit)} limit
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Revenue</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 gap-1">
                INCOME <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <CardDescription>
              {formatCurrency(monthIncome)} total • {incomeList.length} entries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomeList.slice(0, 4).map((inc) => (
              <div key={inc.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{inc.sourceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(inc.date), "M/d/yyyy")}
                  </p>
                </div>
                <span className="text-sm font-bold text-green-600">
                  +{formatCurrency(inc.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Horizon & Alerts</CardTitle>
              <CardDescription>Next 7 days & budget alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.length === 0 && (
                <p className="text-sm text-muted-foreground">No alerts.</p>
              )}
              {alerts.slice(0, 5).map((alert, i) => (
                <Alert
                  key={i}
                  variant={alert.type === "danger" ? "destructive" : "default"}
                  className="py-2"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm font-medium">
                    {alert.type === "danger" ? "Over Budget" : "Alert"}
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    {alert.message}
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
