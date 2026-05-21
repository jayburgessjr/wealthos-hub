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
import { useEffect, useState, useMemo } from "react";
import { ErrorBoundary } from "@/components/household/errors/ErrorBoundary";
import { formatCurrency } from "@/lib/household-format";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function FinancialReporting() {
  const {
    budget,
    totalSpent,
    isLoading,
    remaining,
    variableExpensesTotal,
    subscriptionCashflowTotal,
  } = useHouseholdBudget();

  const byCategory = budget.categories.map((c) => ({
    name: c.name,
    value: c.spent,
  }));

  const expenseBreakdown = useMemo(() => {
    const fixed =
      subscriptionCashflowTotal +
      budget.bills.reduce(
        (sum, b) => sum + (b.paymentStatus === "paid" ? b.amountPaid : 0),
        0,
      );
    const discretionary = totalSpent - fixed;
    return [
      { name: "Fixed Costs", value: fixed, fill: "#0ea5e9" },
      {
        name: "Discretionary",
        value: discretionary > 0 ? discretionary : 0,
        fill: "#f59e0b",
      },
    ];
  }, [budget, totalSpent, subscriptionCashflowTotal]);

  const [recharts, setRecharts] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    import("recharts").then((mod) => mounted && setRecharts(mod));
    return () => {
      mounted = false;
    };
  }, []);

  const {
    monthIncome,
    netCashFlow,
    burnRate,
    currIncomeTrendPct,
    currExpensesTrendPct,
  } = useMemo(() => {
    const monthStr = budget.month;
    const incomeEntriesThisMonth = budget.incomeEntries.filter((e) =>
      e.date.startsWith(monthStr),
    );
    const monthIncomeVal = incomeEntriesThisMonth.reduce(
      (s, e) => s + (e.amount ?? 0),
      0,
    );

    const net = monthIncomeVal - totalSpent;
    const burn = monthIncomeVal > 0 ? (totalSpent / monthIncomeVal) * 100 : 0;

    const d = new Date(monthStr + "-01");
    d.setMonth(d.getMonth() - 1);
    const prevMonthStr = d.toISOString().slice(0, 7);
    const prevSummary = budget.monthlySummaries.find(
      (s) => s.month === prevMonthStr,
    );

    const prevInc = prevSummary?.data?.income ?? 0;
    const prevSpd = prevSummary?.data?.spent ?? 0;

    const incTrendVal =
      prevInc > 0 ? ((monthIncomeVal - prevInc) / prevInc) * 100 : 0;
    const expTrendVal =
      prevSpd > 0 ? ((totalSpent - prevSpd) / prevSpd) * 100 : 0;

    return {
      monthIncome: monthIncomeVal,
      netCashFlow: net,
      burnRate: burn,
      prevMonthIncome: prevInc,
      prevMonthSpent: prevSpd,
      currIncomeTrendPct: incTrendVal,
      currExpensesTrendPct: expTrendVal,
    };
  }, [budget, totalSpent]);

  const cashFlowTrendData = useMemo(() => {
    const months = [];
    const current = new Date(budget.month + "-01");
    for (let i = 5; i >= 0; i--) {
      const d = new Date(current);
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }

    return months.map((m) => {
      if (m === budget.month) {
        return {
          month: m,
          income: monthIncome,
          expenses: totalSpent,
          net: netCashFlow,
        };
      }
      const s = budget.monthlySummaries.find((sum) => sum.month === m);
      return {
        month: m,
        income: s?.data?.income ?? 0,
        expenses: s?.data?.spent ?? 0,
        net: (s?.data?.income ?? 0) - (s?.data?.spent ?? 0),
      };
    });
  }, [
    budget.month,
    budget.monthlySummaries,
    monthIncome,
    totalSpent,
    netCashFlow,
  ]);

  const burnRateHistoryData = useMemo(
    () =>
      cashFlowTrendData.map((d) => ({
        month: d.month,
        burnRate: d.income > 0 ? (d.expenses / d.income) * 100 : 0,
      })),
    [cashFlowTrendData],
  );

  const exportCsv = () => {
    const headers = ["date", "amount", "category", "description", "type"];
    const expenseRows = budget.expenses.map((e) => [
      e.date,
      -e.amount,
      budget.categories.find((c) => c.id === e.categoryId)?.name ||
        "Uncategorized",
      e.description || "",
      "expense",
    ]);
    const incomeRows = budget.incomeEntries.map((e) => [
      e.date,
      e.amount,
      e.sourceName || "Income",
      e.notes || "",
      "income",
    ]);

    const allRows = [...expenseRows, ...incomeRows].sort(
      (a, b) =>
        new Date(a[0] as string).getTime() - new Date(b[0] as string).getTime(),
    );

    const csv = [headers.join(","), ...allRows.map((r) => r.join(","))].join(
      "\n",
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial_report_${budget.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderTrend = (pct: number, invert = false) => {
    if (pct === 0)
      return (
        <span className="text-muted-foreground flex items-center text-xs ml-2">
          <Minus className="h-3 w-3 mr-1" /> 0.0%
        </span>
      );
    const isPositive = pct > 0;
    const isGood = invert ? !isPositive : isPositive;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isGood ? "text-green-500" : "text-red-500";
    return (
      <span className={`${colorClass} flex items-center text-xs ml-2`}>
        <Icon className="h-3 w-3 mr-1" /> {Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">
          Financial Reporting
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="font-mono"
          onClick={exportCsv}
        >
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Cash Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {netCashFlow < 0 ? "-" : ""}
              {formatCurrency(Math.abs(netCashFlow))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Income minus expenses this month
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Burn Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${burnRate > 100 ? "text-red-500" : burnRate > 80 ? "text-yellow-500" : "text-green-500"}`}
            >
              {burnRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              % of income spent
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline">
              <div className="text-2xl font-bold font-mono">
                {formatCurrency(monthIncome)}
              </div>
              {renderTrend(currIncomeTrendPct)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs last month</p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline">
              <div className="text-2xl font-bold font-mono">
                {formatCurrency(totalSpent)}
              </div>
              {renderTrend(currExpensesTrendPct, true)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs last month</p>
          </CardContent>
        </Card>
      </div>

      <ErrorBoundary>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="col-span-1 lg:col-span-2 border-2">
            <CardHeader>
              <CardTitle>Cash Flow Trend</CardTitle>
              <CardDescription>
                Monthly income and expenses over time
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {!recharts || isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <recharts.ResponsiveContainer width="100%" height="100%">
                  <recharts.ComposedChart data={cashFlowTrendData}>
                    <recharts.CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <recharts.XAxis
                      dataKey="month"
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <recharts.YAxis />
                    <recharts.Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <recharts.Legend />
                    <recharts.Bar
                      dataKey="income"
                      name="Income"
                      fill="#10b981"
                      barSize={20}
                    />
                    <recharts.Bar
                      dataKey="expenses"
                      name="Expenses"
                      fill="#ef4444"
                      barSize={20}
                    />
                    <recharts.Line
                      type="monotone"
                      dataKey="net"
                      name="Net Cash Flow"
                      stroke="#3b82f6"
                      strokeWidth={2}
                    />
                  </recharts.ComposedChart>
                </recharts.ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-1 border-2">
            <CardHeader>
              <CardTitle>Expense Breakdown</CardTitle>
              <CardDescription>Where your money is going</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {!recharts || isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Skeleton className="h-full w-full rounded-full" />
                </div>
              ) : (
                <recharts.ResponsiveContainer width="100%" height="100%">
                  <recharts.PieChart>
                    <recharts.Pie
                      data={expenseBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <recharts.Cell
                          key={`cell-${index}`}
                          fill={entry.fill}
                        />
                      ))}
                    </recharts.Pie>
                    <recharts.Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <recharts.Legend verticalAlign="bottom" height={36} />
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan x="50%" dy="-1em" fontSize="12" fill="#888">
                        Total
                      </tspan>
                      <tspan x="50%" dy="1.5em" fontSize="16" fontWeight="bold">
                        {formatCurrency(totalSpent)}
                      </tspan>
                    </text>
                  </recharts.PieChart>
                </recharts.ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Burn Rate History</CardTitle>
            <CardDescription>
              Monthly spending as percentage of income (target: under 80%)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            {!recharts || isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <recharts.ResponsiveContainer width="100%" height="100%">
                <recharts.AreaChart data={burnRateHistoryData}>
                  <recharts.CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <recharts.XAxis
                    dataKey="month"
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <recharts.YAxis
                    domain={[0, "auto"]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <recharts.Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                  />
                  <recharts.ReferenceLine
                    y={80}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label="Target (80%)"
                  />
                  <recharts.Area
                    type="monotone"
                    dataKey="burnRate"
                    name="Burn Rate"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.2}
                  />
                </recharts.AreaChart>
              </recharts.ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </ErrorBoundary>
    </div>
  );
}
