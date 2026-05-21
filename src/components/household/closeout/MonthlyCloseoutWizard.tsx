import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Target,
  TrendingUp,
  TrendingDown,
  Landmark,
  Calendar,
  Sparkles,
  DollarSign,
  Receipt,
  PiggyBank,
  AlertTriangle,
  Lock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Budget,
  Goal,
  Category,
} from "@/integrations/supabase/household-types";
import { format, addMonths } from "date-fns";

type CloseoutStep =
  | "welcome"
  | "review-income"
  | "review-spending"
  | "review-bills"
  | "review-goals"
  | "set-next-goals"
  | "performance"
  | "finalize";

interface MonthlyCloseoutWizardProps {
  budget: Budget;
  onComplete: (data: CloseoutData) => void;
  onCancel: () => void;
}

interface CloseoutData {
  month: string;
  notes: string;
  nextMonthGoals: string[];
  performance: {
    income: number;
    expenses: number;
    netSavings: number;
    savingsRate: number;
    goalsProgress: { goalId: string; progress: number }[];
  };
}

export function MonthlyCloseoutWizard({
  budget,
  onComplete,
  onCancel,
}: MonthlyCloseoutWizardProps) {
  // Storage key for this wizard (includes month to separate sessions)
  const STORAGE_KEY = `monthly-closeout-progress-${budget.month}`;

  // Initialize state from localStorage or defaults
  const getInitialStep = (): CloseoutStep => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.currentStep || "welcome";
      }
    } catch {}
    return "welcome";
  };

  const getInitialNotes = (): string => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.notes || "";
      }
    } catch {}
    return "";
  };

  const getInitialGoals = (): string[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.nextMonthGoals || ["", "", ""];
      }
    } catch {}
    return ["", "", ""];
  };

  const [currentStep, setCurrentStep] = useState<CloseoutStep>(getInitialStep);
  const [notes, setNotes] = useState(getInitialNotes);
  const [nextMonthGoals, setNextMonthGoals] =
    useState<string[]>(getInitialGoals);

  // Auto-save to localStorage on step or data change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentStep,
          notes,
          nextMonthGoals,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {}
  }, [currentStep, notes, nextMonthGoals, STORAGE_KEY]);

  // Clear localStorage on successful completion
  const clearWizardProgress = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const steps: { id: CloseoutStep; label: string; icon: any }[] = [
    { id: "welcome", label: "Overview", icon: Calendar },
    { id: "review-income", label: "Income", icon: DollarSign },
    { id: "review-spending", label: "Spending", icon: Receipt },
    { id: "review-bills", label: "Bills", icon: Landmark },
    { id: "review-goals", label: "Goals", icon: Target },
    { id: "set-next-goals", label: "Next Month", icon: ArrowRight },
    { id: "performance", label: "Performance", icon: TrendingUp },
    { id: "finalize", label: "Finalize", icon: Sparkles },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Calculate stats
  const stats = useMemo(() => {
    const totalIncome = budget.incomeEntries.reduce(
      (sum, e) => sum + e.amount,
      0,
    );
    const totalExpenses = budget.categories.reduce(
      (sum, cat) => sum + cat.spent,
      0,
    );
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    const unpaidBills = budget.bills.filter(
      (b) => b.paymentStatus !== "paid" && b.isActive !== false,
    );
    const paidBills = budget.bills.filter(
      (b) => b.paymentStatus === "paid" && b.isActive !== false,
    );

    const goalsProgress = budget.goals.map((g) => ({
      goalId: g.id,
      name: g.name,
      progress:
        g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0,
      current: g.currentAmount,
      target: g.targetAmount,
    }));

    const overBudgetCategories = budget.categories.filter(
      (c) => c.spent > c.monthlyLimit && c.monthlyLimit > 0,
    );
    const underBudgetCategories = budget.categories.filter(
      (c) => c.spent < c.monthlyLimit * 0.5 && c.monthlyLimit > 0,
    );

    return {
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      unpaidBills,
      paidBills,
      goalsProgress,
      overBudgetCategories,
      underBudgetCategories,
    };
  }, [budget]);

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleComplete = () => {
    clearWizardProgress();
    onComplete({
      month: budget.month,
      notes,
      nextMonthGoals: nextMonthGoals.filter((g) => g.trim()),
      performance: {
        income: stats.totalIncome,
        expenses: stats.totalExpenses,
        netSavings: stats.netSavings,
        savingsRate: stats.savingsRate,
        goalsProgress: stats.goalsProgress.map((g) => ({
          goalId: g.goalId,
          progress: g.progress,
        })),
      },
    });
  };

  const nextMonth = format(
    addMonths(new Date(budget.month + "-01"), 1),
    "MMMM yyyy",
  );

  const renderWelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
        <Calendar className="h-10 w-10 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Monthly Closeout</h2>
        <p className="text-muted-foreground">
          Let's review {format(new Date(budget.month + "-01"), "MMMM yyyy")} and
          prepare for {nextMonth}.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
        <Card className="bg-green-500/10 border-green-500/20">
          <CardHeader className="pb-2">
            <CardDescription>Income</CardDescription>
            <CardTitle className="text-green-600">
              ${stats.totalIncome.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <CardHeader className="pb-2">
            <CardDescription>Expenses</CardDescription>
            <CardTitle className="text-red-600">
              ${stats.totalExpenses.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={cn(
            stats.netSavings >= 0
              ? "bg-green-500/10 border-green-500/20"
              : "bg-red-500/10 border-red-500/20",
          )}
        >
          <CardHeader className="pb-2">
            <CardDescription>Net</CardDescription>
            <CardTitle
              className={
                stats.netSavings >= 0 ? "text-green-600" : "text-red-600"
              }
            >
              ${stats.netSavings.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );

  const renderIncomeReviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-green-500" />
        <h3 className="text-xl font-bold">Income Review</h3>
      </div>
      <p className="text-muted-foreground">
        Review all income received this month.
      </p>

      <div className="grid gap-3 max-h-[400px] overflow-y-auto">
        {budget.incomeEntries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center text-muted-foreground">
              No income entries recorded this month
            </CardContent>
          </Card>
        ) : (
          budget.incomeEntries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{entry.sourceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.date} • {entry.type}
                  </p>
                </div>
                <span className="font-bold text-green-600">
                  +${entry.amount.toLocaleString()}
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="bg-green-500/10">
        <CardContent className="pt-4 flex justify-between items-center">
          <span className="font-medium">Total Income</span>
          <span className="text-xl font-bold text-green-600">
            ${stats.totalIncome.toLocaleString()}
          </span>
        </CardContent>
      </Card>
    </div>
  );

  const renderSpendingReviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6 text-orange-500" />
        <h3 className="text-xl font-bold">Spending Review</h3>
      </div>
      <p className="text-muted-foreground">
        Review spending by category and identify areas for improvement.
      </p>

      <div className="grid gap-3 max-h-[300px] overflow-y-auto">
        {budget.categories.map((cat) => {
          const pct =
            cat.monthlyLimit > 0 ? (cat.spent / cat.monthlyLimit) * 100 : 0;
          const isOver = pct > 100;
          const isUnder = pct < 50 && cat.monthlyLimit > 0;

          return (
            <Card
              key={cat.id}
              className={cn(
                isOver && "border-red-500/50 bg-red-500/5",
                isUnder && "border-green-500/50 bg-green-500/5",
              )}
            >
              <CardContent className="pt-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span className="font-medium">{cat.name}</span>
                    {isOver && (
                      <Badge variant="destructive" className="text-xs">
                        Over
                      </Badge>
                    )}
                    {isUnder && (
                      <Badge className="text-xs bg-green-500">Under</Badge>
                    )}
                  </div>
                  <span className="font-mono text-sm">
                    ${cat.spent.toLocaleString()} / $
                    {cat.monthlyLimit.toLocaleString()}
                  </span>
                </div>
                <Progress value={Math.min(pct, 100)} className="h-2" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {stats.overBudgetCategories.length > 0 && (
        <div className="p-3 bg-red-500/10 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-600">Over Budget Categories</p>
            <p className="text-sm text-muted-foreground">
              {stats.overBudgetCategories.map((c) => c.name).join(", ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderBillsReviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Landmark className="h-6 w-6 text-blue-500" />
        <h3 className="text-xl font-bold">Bills Status</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-green-500/10">
          <CardContent className="pt-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">
              {stats.paidBills.length}
            </p>
            <p className="text-sm text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
        <Card className={cn(stats.unpaidBills.length > 0 && "bg-red-500/10")}>
          <CardContent className="pt-4 text-center">
            <AlertTriangle
              className={cn(
                "h-8 w-8 mx-auto mb-2",
                stats.unpaidBills.length > 0
                  ? "text-red-500"
                  : "text-muted-foreground",
              )}
            />
            <p
              className={cn(
                "text-2xl font-bold",
                stats.unpaidBills.length > 0
                  ? "text-red-600"
                  : "text-muted-foreground",
              )}
            >
              {stats.unpaidBills.length}
            </p>
            <p className="text-sm text-muted-foreground">Unpaid</p>
          </CardContent>
        </Card>
      </div>

      {stats.unpaidBills.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-red-600">Unpaid Bills:</p>
          {stats.unpaidBills.map((bill) => (
            <Card key={bill.id} className="border-red-500/50">
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{bill.name}</p>
                  <p className="text-xs text-red-600">Due: {bill.dueDate}</p>
                </div>
                <span className="font-bold">
                  ${bill.amount.toLocaleString()}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stats.unpaidBills.length === 0 && (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-green-600 font-medium">
            All bills are paid! Great job!
          </p>
        </div>
      )}
    </div>
  );

  const renderGoalsReviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-purple-500" />
        <h3 className="text-xl font-bold">Goals Progress</h3>
      </div>
      <p className="text-muted-foreground">
        Review your savings goals progress this month.
      </p>

      <div className="grid gap-3">
        {budget.goals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center text-muted-foreground">
              No goals set. Consider creating savings goals!
            </CardContent>
          </Card>
        ) : (
          stats.goalsProgress.map((goal) => (
            <Card key={goal.goalId}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{goal.name}</span>
                  <Badge
                    variant={goal.progress >= 100 ? "default" : "secondary"}
                  >
                    {goal.progress.toFixed(0)}%
                  </Badge>
                </div>
                <Progress
                  value={Math.min(goal.progress, 100)}
                  className="h-3 mb-2"
                />
                <p className="text-xs text-muted-foreground text-right">
                  ${goal.current.toLocaleString()} of $
                  {goal.target.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  const renderSetNextGoalsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ArrowRight className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-bold">Goals for {nextMonth}</h3>
      </div>
      <p className="text-muted-foreground">
        What do you want to accomplish next month?
      </p>

      <div className="space-y-3">
        {nextMonthGoals.map((goal, idx) => (
          <div key={idx}>
            <Label className="text-xs text-muted-foreground">
              Goal {idx + 1}
            </Label>
            <Input
              value={goal}
              onChange={(e) => {
                const updated = [...nextMonthGoals];
                updated[idx] = e.target.value;
                setNextMonthGoals(updated);
              }}
              placeholder={`e.g., Save $500, Pay off credit card, etc.`}
            />
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setNextMonthGoals([...nextMonthGoals, ""])}
        >
          + Add Another Goal
        </Button>
      </div>
    </div>
  );

  const renderPerformanceStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-bold">Monthly Performance</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">Savings Rate</p>
            <p
              className={cn(
                "text-3xl font-bold",
                stats.savingsRate >= 20
                  ? "text-green-600"
                  : stats.savingsRate >= 10
                    ? "text-yellow-600"
                    : "text-red-600",
              )}
            >
              {stats.savingsRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.savingsRate >= 20
                ? "Excellent!"
                : stats.savingsRate >= 10
                  ? "Good"
                  : "Needs improvement"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">Net Cash Flow</p>
            <p
              className={cn(
                "text-3xl font-bold",
                stats.netSavings >= 0 ? "text-green-600" : "text-red-600",
              )}
            >
              {stats.netSavings >= 0 ? "+" : ""}$
              {stats.netSavings.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.netSavings >= 0 ? "Positive flow" : "Overspent"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 mb-4">
            <PiggyBank className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Monthly Summary</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Income</span>
              <span className="font-mono text-green-600">
                +${stats.totalIncome.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Expenses</span>
              <span className="font-mono text-red-600">
                -${stats.totalExpenses.toLocaleString()}
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>Net Savings</span>
              <span
                className={cn(
                  "font-mono",
                  stats.netSavings >= 0 ? "text-green-600" : "text-red-600",
                )}
              >
                ${stats.netSavings.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFinalizeStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Sparkles className="h-12 w-12 text-yellow-500 mx-auto" />
        <h2 className="text-2xl font-bold">Finalize & Close Month</h2>
        <p className="text-muted-foreground">
          Add any final notes and lock this month.
        </p>
      </div>

      <Textarea
        placeholder="Reflections on this month... What went well? What could improve?"
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <Card className="bg-muted/50">
        <CardContent className="pt-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">What happens when you close?</p>
            <ul className="text-muted-foreground mt-1 space-y-1">
              <li>• Summary is saved for historical reference</li>
              <li>• Goals for next month are recorded</li>
              <li>• You can still view this month's data</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-12 text-lg" onClick={handleComplete}>
        <Lock className="h-5 w-5 mr-2" />
        Close {format(new Date(budget.month + "-01"), "MMMM yyyy")}
      </Button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <span className="text-muted-foreground">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex gap-2 overflow-x-auto pb-2">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isCur = idx === currentStepIndex;
                const isCompleted = idx < currentStepIndex;
                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(step.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors",
                      isCur && "bg-primary text-primary-foreground",
                      isCompleted && !isCur && "bg-green-500/20 text-green-600",
                      !isCur && !isCompleted && "bg-muted hover:bg-accent",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {step.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 min-h-[400px]">
          {currentStep === "welcome" && renderWelcomeStep()}
          {currentStep === "review-income" && renderIncomeReviewStep()}
          {currentStep === "review-spending" && renderSpendingReviewStep()}
          {currentStep === "review-bills" && renderBillsReviewStep()}
          {currentStep === "review-goals" && renderGoalsReviewStep()}
          {currentStep === "set-next-goals" && renderSetNextGoalsStep()}
          {currentStep === "performance" && renderPerformanceStep()}
          {currentStep === "finalize" && renderFinalizeStep()}
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={currentStepIndex === 0 ? onCancel : goToPreviousStep}
          className="flex-1"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {currentStepIndex === 0 ? "Cancel" : "Previous"}
        </Button>
        {currentStep !== "finalize" && (
          <Button onClick={goToNextStep} className="flex-1">
            Next <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
