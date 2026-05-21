import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/household-format";
import {
  Calculator,
  Calendar,
  DollarSign,
  TrendingDown,
  PiggyBank,
  Zap,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Debt {
  id: string;
  name: string;
  current_balance: number;
  total_balance: number;
  monthly_payment: number;
  interest_rate: number | null;
}

interface DebtPayoffProjectionsProps {
  debts: Debt[];
}

function calculatePayoff(
  balance: number,
  payment: number,
  apr: number,
  extraMonthly: number = 0,
) {
  const monthlyPayment = payment + extraMonthly;
  if (monthlyPayment <= 0)
    return { months: Infinity, totalInterest: Infinity, timeline: [] };

  const r = apr > 0 ? apr / 100 / 12 : 0;
  let b = balance;
  let months = 0;
  let totalInterest = 0;
  const timeline: {
    month: number;
    balance: number;
    interest: number;
    principal: number;
  }[] = [];

  const maxMonths = 600;

  while (b > 0.01 && months < maxMonths) {
    months++;
    const interest = r > 0 ? b * r : 0;
    let principal = monthlyPayment - interest;

    if (principal <= 0) {
      return { months: Infinity, totalInterest: Infinity, timeline: [] };
    }

    if (principal > b) principal = b;
    b = Math.max(0, b - principal);
    totalInterest += interest;

    timeline.push({ month: months, balance: b, interest, principal });
  }

  return {
    months: b <= 0.01 ? months : Infinity,
    totalInterest,
    timeline,
  };
}

export function DebtPayoffProjections({ debts }: DebtPayoffProjectionsProps) {
  const [extraPayment, setExtraPayment] = useState(0);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(
    debts[0]?.id ?? null,
  );

  const activeDebts = debts.filter((d) => d.current_balance > 0);

  const projections = useMemo(() => {
    return activeDebts.map((debt) => {
      const current = calculatePayoff(
        debt.current_balance,
        debt.monthly_payment,
        debt.interest_rate ?? 0,
      );
      const withExtra = calculatePayoff(
        debt.current_balance,
        debt.monthly_payment,
        debt.interest_rate ?? 0,
        extraPayment / activeDebts.length,
      );

      const monthsSaved = current.months - withExtra.months;
      const interestSaved = current.totalInterest - withExtra.totalInterest;

      return {
        debt,
        current,
        withExtra,
        monthsSaved: isFinite(monthsSaved) ? monthsSaved : 0,
        interestSaved: isFinite(interestSaved) ? interestSaved : 0,
      };
    });
  }, [activeDebts, extraPayment]);

  const totals = useMemo(() => {
    const totalBalance = activeDebts.reduce(
      (sum, d) => sum + d.current_balance,
      0,
    );
    const totalMonthlyPayment = activeDebts.reduce(
      (sum, d) => sum + d.monthly_payment,
      0,
    );
    const totalOriginal = activeDebts.reduce(
      (sum, d) => sum + d.total_balance,
      0,
    );

    const totalInterestWithoutExtra = projections.reduce(
      (sum, p) =>
        sum + (isFinite(p.current.totalInterest) ? p.current.totalInterest : 0),
      0,
    );
    const totalInterestWithExtra = projections.reduce(
      (sum, p) =>
        sum +
        (isFinite(p.withExtra.totalInterest) ? p.withExtra.totalInterest : 0),
      0,
    );

    const longestPayoff = Math.max(
      ...projections.map((p) =>
        isFinite(p.current.months) ? p.current.months : 0,
      ),
    );
    const longestWithExtra = Math.max(
      ...projections.map((p) =>
        isFinite(p.withExtra.months) ? p.withExtra.months : 0,
      ),
    );

    return {
      totalBalance,
      totalMonthlyPayment,
      totalOriginal,
      totalInterestWithoutExtra,
      totalInterestWithExtra,
      interestSaved: totalInterestWithoutExtra - totalInterestWithExtra,
      longestPayoff,
      longestWithExtra,
      monthsSaved: longestPayoff - longestWithExtra,
      paidOff: totalOriginal - totalBalance,
      progress:
        totalOriginal > 0
          ? ((totalOriginal - totalBalance) / totalOriginal) * 100
          : 0,
    };
  }, [activeDebts, projections]);

  const selectedProjection = projections.find(
    (p) => p.debt.id === selectedDebtId,
  );

  const chartData = useMemo(() => {
    if (!selectedProjection) return [];

    const currentTimeline = selectedProjection.current.timeline;
    const extraTimeline = selectedProjection.withExtra.timeline;

    const maxLength = Math.max(currentTimeline.length, extraTimeline.length);
    const data: { month: number; current: number; withExtra: number }[] = [];

    for (let i = 0; i < Math.min(maxLength, 60); i++) {
      data.push({
        month: i + 1,
        current: currentTimeline[i]?.balance ?? 0,
        withExtra: extraTimeline[i]?.balance ?? 0,
      });
    }

    return data;
  }, [selectedProjection]);

  if (activeDebts.length === 0) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Debt Payoff Projections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <PiggyBank className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active debts to project. You're debt-free!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Debt Payoff Projections
            </CardTitle>
            <CardDescription>
              See how extra payments accelerate your debt-free date
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-mono">Extra/mo:</Label>
            <div className="relative w-24">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="50"
                value={extraPayment}
                onChange={(e) =>
                  setExtraPayment(parseFloat(e.target.value) || 0)
                }
                className="pl-6 font-mono"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-3 border-2 border-border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3 w-3" />
              Total Debt
            </div>
            <div className="font-mono font-bold text-lg">
              {formatCurrency(totals.totalBalance)}
            </div>
            <Progress value={totals.progress} className="h-1 mt-2" />
            <div className="text-xs text-muted-foreground mt-1">
              {totals.progress.toFixed(0)}% paid off
            </div>
          </div>

          <div className="p-3 border-2 border-border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Calendar className="h-3 w-3" />
              Debt-Free Date
            </div>
            <div className="font-mono font-bold text-lg">
              {isFinite(totals.longestWithExtra)
                ? new Date(
                    Date.now() +
                      totals.longestWithExtra * 30 * 24 * 60 * 60 * 1000,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </div>
            {extraPayment > 0 && totals.monthsSaved > 0 && (
              <Badge variant="secondary" className="mt-1 text-xs">
                <Zap className="h-3 w-3 mr-1" />
                {totals.monthsSaved} mo faster
              </Badge>
            )}
          </div>

          <div className="p-3 border-2 border-border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingDown className="h-3 w-3" />
              Total Interest
            </div>
            <div className="font-mono font-bold text-lg">
              {formatCurrency(totals.totalInterestWithExtra)}
            </div>
            {extraPayment > 0 && totals.interestSaved > 0 && (
              <Badge
                variant="default"
                className="mt-1 text-xs bg-[hsl(var(--status-safe))]"
              >
                Save {formatCurrency(totals.interestSaved)}
              </Badge>
            )}
          </div>

          <div className="p-3 border-2 border-border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3 w-3" />
              Monthly Payment
            </div>
            <div className="font-mono font-bold text-lg">
              {formatCurrency(totals.totalMonthlyPayment + extraPayment)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Base: {formatCurrency(totals.totalMonthlyPayment)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-mono uppercase">
              Select Debt to View
            </Label>
            {projections.map(
              ({ debt, withExtra, monthsSaved, interestSaved }) => (
                <div
                  key={debt.id}
                  onClick={() => setSelectedDebtId(debt.id)}
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedDebtId === debt.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{debt.name}</span>
                    <span className="font-mono text-sm">
                      {formatCurrency(debt.current_balance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>
                      {debt.interest_rate
                        ? `${debt.interest_rate}% APR`
                        : "No interest"}
                    </span>
                    <span>
                      {isFinite(withExtra.months)
                        ? `${withExtra.months} mo`
                        : "∞"}
                      {extraPayment > 0 && monthsSaved > 0 && (
                        <span className="text-[hsl(var(--status-safe))] ml-1">
                          (-{monthsSaved})
                        </span>
                      )}
                    </span>
                  </div>
                  {extraPayment > 0 && interestSaved > 0 && (
                    <div className="text-xs text-[hsl(var(--status-safe))] mt-1">
                      Save {formatCurrency(interestSaved)} in interest
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          <div className="lg:col-span-2 h-[250px]">
            {selectedProjection && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v) => `${v}m`}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Month ${label}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "2px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    name="Current Plan"
                    dot={false}
                  />
                  {extraPayment > 0 && (
                    <Line
                      type="monotone"
                      dataKey="withExtra"
                      stroke="hsl(var(--status-safe))"
                      strokeWidth={2}
                      name={`+${formatCurrency(extraPayment)}/mo`}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a debt to view payoff projection
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
