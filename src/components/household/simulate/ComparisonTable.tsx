import { Scenario } from "@/services/householdAiService";
import { Trophy, TrendingUp, TrendingDown, Clock, Shield } from "lucide-react";

interface ComparisonTableProps {
  scenarios: Scenario[];
  currentSurplus: number;
  currentSavings: number;
  monthlyIncome: number;
  results: Map<
    string,
    { newSurplus: number; surplusChange: number; isStressed: boolean }
  >;
}

export function ComparisonTable({
  scenarios,
  currentSurplus,
  currentSavings,
  monthlyIncome,
  results,
}: ComparisonTableProps) {
  if (scenarios.length < 2) {
    return (
      <div className="border-2 border-dashed border-border p-8 text-center">
        <p className="text-muted-foreground font-mono text-sm">
          Add 2+ scenarios to compare
        </p>
      </div>
    );
  }

  // Find the best scenario (highest surplus that isn't stressed)
  let bestScenarioId: string | null = null;
  let bestSurplus = -Infinity;

  scenarios.forEach((s) => {
    const result = results.get(s.id);
    if (result && !result.isStressed && result.newSurplus > bestSurplus) {
      bestSurplus = result.newSurplus;
      bestScenarioId = s.id;
    }
  });

  const getMetrics = (scenario: Scenario) => {
    const result = results.get(scenario.id);
    if (!result) return null;

    const monthlyExpenses = monthlyIncome - currentSurplus;
    const newMonthlyExpenses = monthlyIncome - result.newSurplus;
    const emergencyMonths =
      newMonthlyExpenses > 0 ? currentSavings / newMonthlyExpenses : 999;
    const savingsRate = (result.newSurplus / monthlyIncome) * 100;
    const yearly = result.newSurplus * 12;

    return {
      surplus: result.newSurplus,
      change: result.surplusChange,
      isStressed: result.isStressed,
      emergencyMonths: Math.round(emergencyMonths * 10) / 10,
      savingsRate: Math.round(savingsRate * 10) / 10,
      yearly,
    };
  };

  return (
    <div className="border-2 border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-bold flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Scenario Comparison
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary">
              <th className="p-3 text-left font-mono text-xs uppercase text-muted-foreground">
                Metric
              </th>
              {scenarios.map((s) => (
                <th
                  key={s.id}
                  className="p-3 text-center font-mono text-xs"
                  style={{ borderBottom: `3px solid ${s.color}` }}
                >
                  <div className="flex items-center justify-center gap-1">
                    {s.id === bestScenarioId && (
                      <Trophy className="w-3.5 h-3.5 text-[hsl(var(--status-warning))]" />
                    )}
                    {s.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Monthly Surplus */}
            <tr className="border-b border-border">
              <td className="p-3 font-mono text-xs flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" /> Surplus
              </td>
              {scenarios.map((s) => {
                const metrics = getMetrics(s);
                return (
                  <td key={s.id} className="p-3 text-center">
                    <span
                      className={`font-mono font-bold ${metrics?.surplus && metrics.surplus >= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
                    >
                      ${metrics?.surplus.toLocaleString()}
                    </span>
                    <span
                      className={`block text-[10px] font-mono ${metrics?.change && metrics.change >= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
                    >
                      ({metrics?.change && metrics.change >= 0 ? "+" : ""}
                      {metrics?.change}/mo)
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Yearly Impact */}
            <tr className="border-b border-border">
              <td className="p-3 font-mono text-xs flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" /> Yearly
              </td>
              {scenarios.map((s) => {
                const metrics = getMetrics(s);
                return (
                  <td key={s.id} className="p-3 text-center">
                    <span
                      className={`font-mono font-bold ${metrics?.yearly && metrics.yearly >= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
                    >
                      ${metrics?.yearly.toLocaleString()}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Savings Rate */}
            <tr className="border-b border-border">
              <td className="p-3 font-mono text-xs flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5" /> Savings %
              </td>
              {scenarios.map((s) => {
                const metrics = getMetrics(s);
                return (
                  <td key={s.id} className="p-3 text-center font-mono text-sm">
                    {metrics?.savingsRate}%
                  </td>
                );
              })}
            </tr>

            {/* Emergency Fund */}
            <tr className="border-b border-border">
              <td className="p-3 font-mono text-xs flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Reserve
              </td>
              {scenarios.map((s) => {
                const metrics = getMetrics(s);
                const isLow =
                  metrics?.emergencyMonths && metrics.emergencyMonths < 3;
                return (
                  <td key={s.id} className="p-3 text-center">
                    <span
                      className={`font-mono text-sm ${isLow ? "text-[hsl(var(--status-danger))]" : ""}`}
                    >
                      {metrics?.emergencyMonths === 999
                        ? "∞"
                        : metrics?.emergencyMonths}{" "}
                      months
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Risk Level */}
            <tr>
              <td className="p-3 font-mono text-xs flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> Risk
              </td>
              {scenarios.map((s) => {
                const metrics = getMetrics(s);
                let riskLevel = "Low";
                let riskColor = "bg-[hsl(var(--status-safe))]";
                if (metrics?.isStressed) {
                  riskLevel = "High";
                  riskColor = "bg-[hsl(var(--status-danger))]";
                } else if (
                  metrics?.emergencyMonths &&
                  metrics.emergencyMonths < 3
                ) {
                  riskLevel = "Medium";
                  riskColor = "bg-[hsl(var(--status-warning))]";
                }
                return (
                  <td key={s.id} className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold text-white ${riskColor}`}
                    >
                      {riskLevel}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {bestScenarioId && (
        <div className="p-3 bg-[hsl(var(--status-safe)/0.1)] border-t-2 border-[hsl(var(--status-safe))]">
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-[hsl(var(--status-warning))]" />
            <span className="font-bold">Best Option:</span>
            <span className="font-mono">
              {scenarios.find((s) => s.id === bestScenarioId)?.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
