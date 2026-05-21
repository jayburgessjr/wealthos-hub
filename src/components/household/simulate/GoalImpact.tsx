import { useMemo } from "react";
import { Scenario } from "@/services/householdAiService";
import { Target, ArrowRight, FastForward, Rewind } from "lucide-react";

interface Goal {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  monthlyContribution: number;
  targetDate?: string;
}

interface GoalImpactProps {
  scenarios: Scenario[];
  goals: Goal[];
  currentSurplus: number;
  results: Map<string, { newSurplus: number }>;
}

export function GoalImpact({
  scenarios,
  goals,
  currentSurplus,
  results,
}: GoalImpactProps) {
  const goalImpacts = useMemo(() => {
    const impacts: Map<
      string,
      Map<string, { currentMonths: number; newMonths: number; change: number }>
    > = new Map();

    scenarios.forEach((scenario) => {
      const result = results.get(scenario.id);
      if (!result) return;

      const scenarioImpacts: Map<
        string,
        { currentMonths: number; newMonths: number; change: number }
      > = new Map();

      goals.forEach((goal) => {
        const remaining = goal.targetAmount - goal.currentAmount;
        const monthlyContrib =
          goal.monthlyContribution || Math.max(currentSurplus * 0.2, 100);

        const currentMonths =
          monthlyContrib > 0 ? Math.ceil(remaining / monthlyContrib) : 999;

        // Adjust contribution based on surplus change
        const surplusChange = result.newSurplus - currentSurplus;
        const newMonthlyContrib = Math.max(
          0,
          monthlyContrib + surplusChange * 0.2,
        );
        const newMonths =
          newMonthlyContrib > 0
            ? Math.ceil(remaining / newMonthlyContrib)
            : 999;

        const change = newMonths - currentMonths;

        scenarioImpacts.set(goal.id, { currentMonths, newMonths, change });
      });

      impacts.set(scenario.id, scenarioImpacts);
    });

    return impacts;
  }, [scenarios, goals, currentSurplus, results]);

  if (scenarios.length === 0 || goals.length === 0) {
    return (
      <div className="border-2 border-dashed border-border p-8 text-center">
        <p className="text-muted-foreground font-mono text-sm">
          {goals.length === 0
            ? "No goals set up"
            : "Add scenarios to see goal impact"}
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-border p-4 bg-card">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Goal Timeline Impact
      </h3>

      <div className="space-y-4">
        {goals.map((goal) => (
          <div key={goal.id} className="border border-border p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🎯</span>
              <span className="font-bold text-sm">{goal.name}</span>
              <span className="text-xs text-muted-foreground ml-auto font-mono">
                ${goal.currentAmount.toLocaleString()} / $
                {goal.targetAmount.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              {scenarios.map((scenario) => {
                const scenarioImpacts = goalImpacts.get(scenario.id);
                const impact = scenarioImpacts?.get(goal.id);
                if (!impact) return null;

                const isPositive = impact.change < 0;
                const isNegative = impact.change > 0;

                return (
                  <div
                    key={scenario.id}
                    className="flex items-center gap-3 p-2 bg-secondary"
                    style={{ borderLeft: `3px solid ${scenario.color}` }}
                  >
                    <span className="font-mono text-xs truncate max-w-[100px]">
                      {scenario.name}
                    </span>

                    <div className="flex items-center gap-2 ml-auto">
                      <span className="font-mono text-xs text-muted-foreground">
                        {impact.currentMonths === 999
                          ? "∞"
                          : impact.currentMonths}
                        mo
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-mono text-xs font-bold">
                        {impact.newMonths === 999 ? "∞" : impact.newMonths}mo
                      </span>

                      {impact.change !== 0 && (
                        <span
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold
                          ${isPositive ? "bg-[hsl(var(--status-safe)/0.2)] text-[hsl(var(--status-safe))]" : ""}
                          ${isNegative ? "bg-[hsl(var(--status-danger)/0.2)] text-[hsl(var(--status-danger))]" : ""}
                        `}
                        >
                          {isPositive ? (
                            <FastForward className="w-3 h-3" />
                          ) : (
                            <Rewind className="w-3 h-3" />
                          )}
                          {isPositive ? "-" : "+"}
                          {Math.abs(impact.change)}mo
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
