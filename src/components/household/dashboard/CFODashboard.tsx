import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProgressBar } from "@/components/household/budget/ProgressBar";
import { formatCurrency } from "@/lib/household-format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Activity,
  PiggyBank,
  Receipt,
  Flame,
  Shield,
  Landmark,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FinancialHealthScore } from "./FinancialHealthScore";
import { BudgetRuleTracker } from "./BudgetRuleTracker";
import { DebtPayoffProjections } from "./DebtPayoffProjections";
import { Category, Expense } from "@/integrations/supabase/household-types";

export interface MonthlyFinancialSummary {
  householdId: string;
  month: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  fixedCosts: number;
  discretionarySpend: number;
  recurringCosts: number;
  subscriptionCosts: number;
  burnRatePct: number;
  savingsRatePct: number;
  dtiRatioPct: number;
  debtPayments: number;
  liquidAssets: number;
  emergencyFundMonths: number;
  runwayMonths: number | null;
}

interface CFODashboardProps {
  summaries: MonthlyFinancialSummary[];
  currentMonth: string;
  isLoading?: boolean;
  categories?: Category[];
  expenses?: Expense[];
  income?: number;
  debts?: Array<{
    id: string;
    name: string;
    current_balance: number;
    total_balance: number;
    monthly_payment: number;
    interest_rate: number | null;
  }>;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function getSavingsRateStatus(rate: number): "safe" | "warning" | "danger" {
  if (rate >= 20) return "safe";
  if (rate >= 10) return "warning";
  return "danger";
}

function getDTIStatus(dti: number): "safe" | "warning" | "danger" {
  if (dti <= 36) return "safe";
  if (dti <= 43) return "warning";
  return "danger";
}

function getEmergencyFundStatus(months: number): "safe" | "warning" | "danger" {
  if (months >= 6) return "safe";
  if (months >= 3) return "warning";
  return "danger";
}

export function CFODashboard({
  summaries,
  currentMonth,
  isLoading,
  categories = [],
  expenses = [],
  income = 0,
  debts = [],
}: CFODashboardProps) {
  const currentSummary = useMemo(
    () => summaries.find((s) => s.month === currentMonth) || null,
    [summaries, currentMonth],
  );

  const previousSummary = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    return summaries.find((s) => s.month === prevMonthStr) || null;
  }, [summaries, currentMonth]);

  const chartData = useMemo(
    () =>
      [...summaries]
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12)
        .map((s) => ({
          month: s.month.slice(5),
          fullMonth: s.month,
          income: s.income,
          expenses: s.expenses,
          netCashFlow: s.netCashFlow,
          burnRate: s.burnRatePct,
        })),
    [summaries],
  );

  const expenseBreakdown = useMemo(() => {
    if (!currentSummary) return [];
    return [
      {
        name: "Fixed Costs",
        value: currentSummary.fixedCosts,
        color: COLORS[0],
      },
      {
        name: "Discretionary",
        value: currentSummary.discretionarySpend,
        color: COLORS[1],
      },
      {
        name: "Recurring",
        value: currentSummary.recurringCosts,
        color: COLORS[2],
      },
      {
        name: "Subscriptions",
        value: currentSummary.subscriptionCosts,
        color: COLORS[3],
      },
    ].filter((item) => item.value > 0);
  }, [currentSummary]);

  const incomeChange = useMemo(() => {
    if (!currentSummary || !previousSummary || previousSummary.income === 0)
      return 0;
    return (
      ((currentSummary.income - previousSummary.income) /
        previousSummary.income) *
      100
    );
  }, [currentSummary, previousSummary]);

  const expenseChange = useMemo(() => {
    if (!currentSummary || !previousSummary || previousSummary.expenses === 0)
      return 0;
    return (
      ((currentSummary.expenses - previousSummary.expenses) /
        previousSummary.expenses) *
      100
    );
  }, [currentSummary, previousSummary]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-2">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-2">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase">
              Net Cash Flow
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                (currentSummary?.netCashFlow ?? 0) >= 0
                  ? "text-[hsl(var(--status-safe))]"
                  : "text-[hsl(var(--status-danger))]"
              }`}
            >
              {formatCurrency(currentSummary?.netCashFlow ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Income minus expenses this month
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase">
              Burn Rate
            </CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                (currentSummary?.burnRatePct ?? 0) <= 80
                  ? "text-[hsl(var(--status-safe))]"
                  : (currentSummary?.burnRatePct ?? 0) <= 100
                    ? "text-[hsl(var(--status-warning))]"
                    : "text-[hsl(var(--status-danger))]"
              }`}
            >
              {(currentSummary?.burnRatePct ?? 0).toFixed(1)}%
            </div>
            <ProgressBar
              value={currentSummary?.burnRatePct ?? 0}
              max={100}
              size="sm"
              tone={
                (currentSummary?.burnRatePct ?? 0) <= 80
                  ? "safe"
                  : (currentSummary?.burnRatePct ?? 0) <= 100
                    ? "warning"
                    : "danger"
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              % of income spent
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase">
              Income
            </CardTitle>
            {incomeChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-[hsl(var(--status-safe))]" />
            ) : (
              <TrendingDown className="h-4 w-4 text-[hsl(var(--status-danger))]" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(currentSummary?.income ?? 0)}
            </div>
            <p
              className={`text-xs mt-1 ${
                incomeChange >= 0
                  ? "text-[hsl(var(--status-safe))]"
                  : "text-[hsl(var(--status-danger))]"
              }`}
            >
              {incomeChange >= 0 ? "+" : ""}
              {incomeChange.toFixed(1)}% vs last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase">
              Expenses
            </CardTitle>
            {expenseChange <= 0 ? (
              <TrendingDown className="h-4 w-4 text-[hsl(var(--status-safe))]" />
            ) : (
              <TrendingUp className="h-4 w-4 text-[hsl(var(--status-danger))]" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(currentSummary?.expenses ?? 0)}
            </div>
            <p
              className={`text-xs mt-1 ${
                expenseChange <= 0
                  ? "text-[hsl(var(--status-safe))]"
                  : "text-[hsl(var(--status-danger))]"
              }`}
            >
              {expenseChange >= 0 ? "+" : ""}
              {expenseChange.toFixed(1)}% vs last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase">
              Savings Rate
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                getSavingsRateStatus(currentSummary?.savingsRatePct ?? 0) ===
                "safe"
                  ? "text-[hsl(var(--status-safe))]"
                  : getSavingsRateStatus(
                        currentSummary?.savingsRatePct ?? 0,
                      ) === "warning"
                    ? "text-[hsl(var(--status-warning))]"
                    : "text-[hsl(var(--status-danger))]"
              }`}
            >
              {(currentSummary?.savingsRatePct ?? 0).toFixed(1)}%
            </div>
            <ProgressBar
              value={Math.max(0, currentSummary?.savingsRatePct ?? 0)}
              max={30}
              size="sm"
              tone={getSavingsRateStatus(currentSummary?.savingsRatePct ?? 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Target: 20%+ (saving{" "}
              {formatCurrency(currentSummary?.netCashFlow ?? 0)}/mo)
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase">
              Debt-to-Income
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                getDTIStatus(currentSummary?.dtiRatioPct ?? 0) === "safe"
                  ? "text-[hsl(var(--status-safe))]"
                  : getDTIStatus(currentSummary?.dtiRatioPct ?? 0) === "warning"
                    ? "text-[hsl(var(--status-warning))]"
                    : "text-[hsl(var(--status-danger))]"
              }`}
            >
              {(currentSummary?.dtiRatioPct ?? 0).toFixed(1)}%
            </div>
            <ProgressBar
              value={currentSummary?.dtiRatioPct ?? 0}
              max={50}
              size="sm"
              tone={getDTIStatus(currentSummary?.dtiRatioPct ?? 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Target: ≤36% ({formatCurrency(currentSummary?.debtPayments ?? 0)}
              /mo debt)
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase">
              Emergency Fund
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                getEmergencyFundStatus(
                  currentSummary?.emergencyFundMonths ?? 0,
                ) === "safe"
                  ? "text-[hsl(var(--status-safe))]"
                  : getEmergencyFundStatus(
                        currentSummary?.emergencyFundMonths ?? 0,
                      ) === "warning"
                    ? "text-[hsl(var(--status-warning))]"
                    : "text-[hsl(var(--status-danger))]"
              }`}
            >
              {(currentSummary?.emergencyFundMonths ?? 0).toFixed(1)} mo
            </div>
            <ProgressBar
              value={Math.min(currentSummary?.emergencyFundMonths ?? 0, 12)}
              max={12}
              size="sm"
              tone={getEmergencyFundStatus(
                currentSummary?.emergencyFundMonths ?? 0,
              )}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Target: 6+ months (
              {formatCurrency(currentSummary?.liquidAssets ?? 0)} saved)
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase">
              Runway
            </CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {currentSummary?.runwayMonths === null ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--status-safe))]" />
                  <span className="text-2xl font-bold font-mono text-[hsl(var(--status-safe))]">
                    ∞
                  </span>
                </div>
                <Badge variant="secondary" className="mt-2">
                  Cash Flow Positive
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  No runway needed — you're saving!
                </p>
              </>
            ) : (
              <>
                <div
                  className={`text-2xl font-bold font-mono ${
                    (currentSummary?.runwayMonths ?? 0) >= 12
                      ? "text-[hsl(var(--status-safe))]"
                      : (currentSummary?.runwayMonths ?? 0) >= 6
                        ? "text-[hsl(var(--status-warning))]"
                        : "text-[hsl(var(--status-danger))]"
                  }`}
                >
                  {(currentSummary?.runwayMonths ?? 0).toFixed(1)} mo
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-warning))]" />
                  <span className="text-xs text-[hsl(var(--status-warning))]">
                    Spending exceeds income
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Time until reserves depleted
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Cash Flow Trend
            </CardTitle>
            <CardDescription>
              Monthly income and expenses over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="hsl(var(--status-safe))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--status-safe))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="hsl(var(--status-danger))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--status-danger))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netCashFlow"
                    name="Net Cash Flow"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No data available yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Expense Breakdown
            </CardTitle>
            <CardDescription>
              Where your money is going this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No expenses this month
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Burn Rate Trend */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Burn Rate History
          </CardTitle>
          <CardDescription>
            Monthly spending as percentage of income (target: under 80%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 150]}
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  labelFormatter={(label) => `Month: ${label}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="burnRate" name="Burn Rate" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.burnRate <= 80
                          ? "hsl(var(--status-safe))"
                          : entry.burnRate <= 100
                            ? "hsl(var(--status-warning))"
                            : "hsl(var(--status-danger))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No data available yet
            </div>
          )}
        </CardContent>
      </Card>

      <FinancialHealthScore
        summary={currentSummary}
        previousSummary={previousSummary}
      />

      {categories.length > 0 && (
        <BudgetRuleTracker
          categories={categories}
          expenses={expenses}
          income={income}
          currentMonth={currentMonth}
        />
      )}

      {debts.length > 0 && <DebtPayoffProjections debts={debts} />}
    </div>
  );
}
