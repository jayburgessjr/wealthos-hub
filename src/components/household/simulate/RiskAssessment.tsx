import { useMemo } from "react";
import { Scenario } from "@/services/householdAiService";
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldX,
  TrendingDown,
  Clock,
  Wallet,
} from "lucide-react";

interface RiskAssessmentProps {
  scenarios: Scenario[];
  currentSurplus: number;
  currentSavings: number;
  monthlyIncome: number;
  results: Map<string, { newSurplus: number; isStressed: boolean }>;
}

interface RiskMetrics {
  level: "low" | "medium" | "high" | "critical";
  emergencyFundMonths: number;
  debtToIncomeChange: number;
  savingsRateChange: number;
  flags: string[];
}

export function RiskAssessment({
  scenarios,
  currentSurplus,
  currentSavings,
  monthlyIncome,
  results,
}: RiskAssessmentProps) {
  const riskAnalysis = useMemo(() => {
    const analysis: Map<string, RiskMetrics> = new Map();

    scenarios.forEach((scenario) => {
      const result = results.get(scenario.id);
      if (!result) return;

      const flags: string[] = [];

      // Calculate emergency fund months
      const monthlyExpenses = monthlyIncome - currentSurplus;
      const newMonthlyExpenses = monthlyIncome - result.newSurplus;
      const emergencyFundMonths =
        newMonthlyExpenses > 0 ? currentSavings / newMonthlyExpenses : 999;

      // Savings rate change
      const currentSavingsRate = (currentSurplus / monthlyIncome) * 100;
      const newSavingsRate = (result.newSurplus / monthlyIncome) * 100;
      const savingsRateChange = newSavingsRate - currentSavingsRate;

      // Debt to income (simplified - expense increase as proxy)
      const debtToIncomeChange =
        ((newMonthlyExpenses - monthlyExpenses) / monthlyIncome) * 100;

      // Risk flags
      if (result.isStressed) flags.push("Creates monthly deficit");
      if (emergencyFundMonths < 3) flags.push("Emergency fund < 3 months");
      if (emergencyFundMonths < 1) flags.push("Critically low reserves");
      if (savingsRateChange < -10)
        flags.push("Savings rate drops significantly");
      if (scenario.amount < -500 && scenario.type === "income_change")
        flags.push("Major income reduction");
      if (scenario.amount > 500 && scenario.type === "new_expense")
        flags.push("Large new recurring expense");

      // Determine risk level
      let level: RiskMetrics["level"] = "low";
      if (flags.length >= 1 || savingsRateChange < -5) level = "medium";
      if (flags.length >= 2 || result.isStressed) level = "high";
      if (result.isStressed && emergencyFundMonths < 3) level = "critical";

      analysis.set(scenario.id, {
        level,
        emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10,
        debtToIncomeChange: Math.round(debtToIncomeChange * 10) / 10,
        savingsRateChange: Math.round(savingsRateChange * 10) / 10,
        flags,
      });
    });

    return analysis;
  }, [scenarios, results, currentSurplus, currentSavings, monthlyIncome]);

  const getRiskIcon = (level: RiskMetrics["level"]) => {
    switch (level) {
      case "low":
        return <Shield className="w-5 h-5 text-[hsl(var(--status-safe))]" />;
      case "medium":
        return (
          <ShieldAlert className="w-5 h-5 text-[hsl(var(--status-warning))]" />
        );
      case "high":
        return <ShieldX className="w-5 h-5 text-[hsl(var(--status-danger))]" />;
      case "critical":
        return (
          <AlertTriangle className="w-5 h-5 text-[hsl(var(--status-danger))]" />
        );
    }
  };

  const getRiskColor = (level: RiskMetrics["level"]) => {
    switch (level) {
      case "low":
        return "border-[hsl(var(--status-safe))] bg-[hsl(var(--status-safe)/0.1)]";
      case "medium":
        return "border-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.1)]";
      case "high":
        return "border-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger)/0.1)]";
      case "critical":
        return "border-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger)/0.2)]";
    }
  };

  if (scenarios.length === 0) {
    return (
      <div className="border-2 border-dashed border-border p-8 text-center">
        <p className="text-muted-foreground font-mono text-sm">
          Add scenarios to see risk assessment
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-border p-4 bg-card">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Risk Assessment
      </h3>

      <div className="space-y-3">
        {scenarios.map((scenario) => {
          const risk = riskAnalysis.get(scenario.id);
          if (!risk) return null;

          return (
            <div
              key={scenario.id}
              className={`p-4 border-2 ${getRiskColor(risk.level)}`}
              style={{
                borderLeftColor: scenario.color,
                borderLeftWidth: "4px",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getRiskIcon(risk.level)}
                  <span className="font-mono font-bold text-sm">
                    {scenario.name}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 font-mono text-xs uppercase font-bold
                  ${risk.level === "low" ? "bg-[hsl(var(--status-safe))] text-[hsl(var(--status-safe-foreground))]" : ""}
                  ${risk.level === "medium" ? "bg-[hsl(var(--status-warning))] text-[hsl(var(--status-warning-foreground))]" : ""}
                  ${risk.level === "high" || risk.level === "critical" ? "bg-[hsl(var(--status-danger))] text-white" : ""}
                `}
                >
                  {risk.level} risk
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Reserve:</span>
                  <span className="font-mono font-bold">
                    {risk.emergencyFundMonths}mo
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Savings:</span>
                  <span
                    className={`font-mono font-bold ${risk.savingsRateChange >= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
                  >
                    {risk.savingsRateChange >= 0 ? "+" : ""}
                    {risk.savingsRateChange}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Expense:</span>
                  <span
                    className={`font-mono font-bold ${risk.debtToIncomeChange <= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
                  >
                    {risk.debtToIncomeChange >= 0 ? "+" : ""}
                    {risk.debtToIncomeChange}%
                  </span>
                </div>
              </div>

              {risk.flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {risk.flags.map((flag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-[10px] font-mono bg-background border border-border"
                    >
                      ⚠ {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
