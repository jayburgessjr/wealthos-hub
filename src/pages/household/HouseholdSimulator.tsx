import { useState, useMemo, useCallback } from "react";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useHouseholdFinancialData } from "@/hooks/useHouseholdFinancialData";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TabNav from "@/components/layout/TabNav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  FlaskConical,
  Plus,
  RotateCcw,
  Sparkles,
  BarChart3,
  Target,
  Shield,
} from "lucide-react";
import { Scenario, BudgetData } from "@/services/householdAiService";
import { ScenarioCard } from "@/components/household/simulate/ScenarioCard";
import { TimelineProjection } from "@/components/household/simulate/TimelineProjection";
import { RiskAssessment } from "@/components/household/simulate/RiskAssessment";
import { GoalImpact } from "@/components/household/simulate/GoalImpact";
import { ComparisonTable } from "@/components/household/simulate/ComparisonTable";
import { AISuggestions } from "@/components/household/simulate/AISuggestions";

const SCENARIO_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--status-safe))",
  "hsl(var(--status-warning))",
  "hsl(var(--accent))",
];

export default function HouseholdSimulator() {
  const { budget, remaining } = useHouseholdBudget();
  const financialData = useHouseholdFinancialData();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeTab, setActiveTab] = useState("builder");

  // Calculate current financial state
  const currentMonthlyExpenses = budget.categories.reduce(
    (sum, c) => sum + c.monthlyLimit,
    0,
  );
  const currentSurplus = budget.income - currentMonthlyExpenses;

  // Create a new empty scenario
  const createScenario = useCallback(() => {
    const id = `scenario-${Date.now()}`;
    const colorIndex = scenarios.length % SCENARIO_COLORS.length;
    const newScenario: Scenario = {
      id,
      name: `Scenario ${scenarios.length + 1}`,
      type: "expense_change",
      amount: 0,
      isRecurring: true,
      color: SCENARIO_COLORS[colorIndex],
    };
    setScenarios((prev) => [...prev, newScenario]);
  }, [scenarios.length]);

  // Update a scenario
  const updateScenario = useCallback((updated: Scenario) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    );
  }, []);

  // Remove a scenario
  const removeScenario = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Reset all scenarios
  const resetAll = useCallback(() => {
    setScenarios([]);
  }, []);

  // Calculate results for all scenarios
  const results = useMemo(() => {
    const resultsMap = new Map<
      string,
      {
        newMonthlyIncome: number;
        newMonthlyExpenses: number;
        newSurplus: number;
        surplusChange: number;
        monthsUntilStress: number | null;
        isStressed: boolean;
      }
    >();

    scenarios.forEach((scenario) => {
      let newMonthlyIncome = budget.income;
      let newMonthlyExpenses = currentMonthlyExpenses;

      switch (scenario.type) {
        case "income_change":
          newMonthlyIncome += scenario.amount;
          break;
        case "expense_change":
          if (scenario.categoryId) {
            const category = budget.categories.find(
              (c) => c.id === scenario.categoryId,
            );
            if (category) {
              newMonthlyExpenses =
                newMonthlyExpenses -
                category.monthlyLimit +
                (category.monthlyLimit + scenario.amount);
            }
          } else {
            newMonthlyExpenses += scenario.amount;
          }
          break;
        case "new_expense":
        case "goal_contribution":
          newMonthlyExpenses += scenario.amount;
          break;
        case "one_time":
          // One-time doesn't affect monthly, but we'll show impact in projections
          break;
      }

      const newSurplus = newMonthlyIncome - newMonthlyExpenses;
      const surplusChange = newSurplus - currentSurplus;
      const monthsUntilStress =
        newSurplus < 0 ? Math.ceil(remaining / Math.abs(newSurplus)) : null;

      resultsMap.set(scenario.id, {
        newMonthlyIncome,
        newMonthlyExpenses,
        newSurplus,
        surplusChange,
        monthsUntilStress,
        isStressed: newSurplus < 0,
      });
    });

    return resultsMap;
  }, [scenarios, budget, currentMonthlyExpenses, currentSurplus, remaining]);

  // Build budget data for AI
  const budgetData: BudgetData = useMemo(
    () => ({
      income: budget.income,
      totalSpent: budget.categories.reduce((sum, c) => sum + c.spent, 0),
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
      })),
      creditScores: financialData.creditScores,
      bankAccounts: financialData.bankAccounts,
      bills: financialData.bills,
      incomeSources: financialData.incomeSources,
      recentExpenses: financialData.recentExpenses,
    }),
    [budget, remaining, financialData],
  );

  // Map goals for GoalImpact component
  const goalsForImpact = budget.goals.map((g) => ({
    id: g.id,
    name: g.name,
    currentAmount: g.currentAmount,
    targetAmount: g.targetAmount,
    monthlyContribution: g.monthlyContribution || 0,
  }));

  return (
    <DashboardLayout>
      <TabNav group="household-future" />
      <div className="space-y-6">
        {/* Header */}
        <div className="border-4 border-border bg-secondary p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    Future
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold tracking-widest rounded border border-emerald-500/20">
                    AI POWERED
                  </span>
                </div>
                <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
                  Budget <span className="text-emerald-500">Simulator</span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Test hypothetical scenarios, compare outcomes, and get AI
                  insights.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={resetAll}
                disabled={scenarios.length === 0}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                className="font-mono text-xs"
                onClick={createScenario}
                disabled={scenarios.length >= 4}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Scenario
              </Button>
            </div>
          </div>
        </div>

        {/* Current State Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border-2 border-border p-3 bg-card">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">
              Monthly Income
            </p>
            <p className="text-xl font-bold font-mono">
              ${budget.income.toLocaleString()}
            </p>
          </div>
          <div className="border-2 border-border p-3 bg-card">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">
              Monthly Expenses
            </p>
            <p className="text-xl font-bold font-mono">
              ${currentMonthlyExpenses.toLocaleString()}
            </p>
          </div>
          <div className="border-2 border-border p-3 bg-card">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">
              Current Surplus
            </p>
            <p
              className={`text-xl font-bold font-mono ${currentSurplus >= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
            >
              ${currentSurplus.toLocaleString()}
            </p>
          </div>
          <div className="border-2 border-border p-3 bg-card">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">
              Savings
            </p>
            <p className="text-xl font-bold font-mono">
              ${remaining.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <div className="border border-border bg-card rounded-xl p-1 flex gap-1 w-fit overflow-x-auto">
            {[
              { id: "builder", label: "Builder", icon: Plus },
              { id: "projection", label: "Project", icon: BarChart3 },
              { id: "goals", label: "Goals", icon: Target },
              { id: "ai", label: "AI", icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    activeTab === tab.id
                      ? "bg-foreground/[0.08] text-foreground"
                      : "text-foreground/40 hover:text-foreground/70"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Builder Tab */}
          <TabsContent value="builder" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Scenarios */}
              <div className="space-y-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" />
                  Scenarios ({scenarios.length}/4)
                </h2>

                {scenarios.length === 0 ? (
                  <div className="border-2 border-dashed border-border p-8 text-center">
                    <FlaskConical className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground font-mono text-sm mb-4">
                      No scenarios yet. Add one to start simulating.
                    </p>
                    <Button onClick={createScenario} className="font-mono">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Scenario
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scenarios.map((scenario) => (
                      <ScenarioCard
                        key={scenario.id}
                        scenario={scenario}
                        categories={budget.categories.map((c) => ({
                          id: c.id,
                          name: c.name,
                          icon: c.icon,
                          monthlyLimit: c.monthlyLimit,
                        }))}
                        onUpdate={updateScenario}
                        onRemove={() => removeScenario(scenario.id)}
                        result={results.get(scenario.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Comparison & Risk */}
              <div className="space-y-4">
                <ComparisonTable
                  scenarios={scenarios}
                  currentSurplus={currentSurplus}
                  currentSavings={remaining}
                  monthlyIncome={budget.income}
                  results={results}
                />

                <RiskAssessment
                  scenarios={scenarios}
                  currentSurplus={currentSurplus}
                  currentSavings={remaining}
                  monthlyIncome={budget.income}
                  results={results}
                />
              </div>
            </div>
          </TabsContent>

          {/* Projection Tab */}
          <TabsContent value="projection" className="space-y-6">
            <TimelineProjection
              scenarios={scenarios}
              currentSurplus={currentSurplus}
              currentSavings={remaining}
              results={results}
            />

            <ComparisonTable
              scenarios={scenarios}
              currentSurplus={currentSurplus}
              currentSavings={remaining}
              monthlyIncome={budget.income}
              results={results}
            />
          </TabsContent>

          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-6">
            <GoalImpact
              scenarios={scenarios}
              goals={goalsForImpact}
              currentSurplus={currentSurplus}
              results={results}
            />

            <RiskAssessment
              scenarios={scenarios}
              currentSurplus={currentSurplus}
              currentSavings={remaining}
              monthlyIncome={budget.income}
              results={results}
            />
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <AISuggestions budgetData={budgetData} scenarios={scenarios} />

              <div className="space-y-4">
                <TimelineProjection
                  scenarios={scenarios}
                  currentSurplus={currentSurplus}
                  currentSavings={remaining}
                  results={results}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
