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
import {
  Heart,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import { MonthlyFinancialSummary } from "./CFODashboard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FinancialHealthScoreProps {
  summary: MonthlyFinancialSummary | null;
  previousSummary: MonthlyFinancialSummary | null;
}

interface MetricWeight {
  name: string;
  weight: number;
  calculate: (summary: MonthlyFinancialSummary) => number;
  description: string;
}

const METRICS: MetricWeight[] = [
  {
    name: "Savings Rate",
    weight: 25,
    description: "Percentage of income saved. Target: 20%+",
    calculate: (s) => {
      const rate = s.savingsRatePct;
      if (rate >= 20) return 100;
      if (rate >= 15) return 80;
      if (rate >= 10) return 60;
      if (rate >= 5) return 40;
      if (rate > 0) return 20;
      return 0;
    },
  },
  {
    name: "Debt-to-Income",
    weight: 25,
    description: "Monthly debt payments vs income. Target: ≤36%",
    calculate: (s) => {
      const dti = s.dtiRatioPct;
      if (dti <= 20) return 100;
      if (dti <= 28) return 85;
      if (dti <= 36) return 70;
      if (dti <= 43) return 50;
      if (dti <= 50) return 30;
      return 10;
    },
  },
  {
    name: "Emergency Fund",
    weight: 25,
    description: "Months of expenses covered. Target: 6+ months",
    calculate: (s) => {
      const months = s.emergencyFundMonths;
      if (months >= 6) return 100;
      if (months >= 4) return 80;
      if (months >= 3) return 60;
      if (months >= 2) return 40;
      if (months >= 1) return 20;
      return 0;
    },
  },
  {
    name: "Burn Rate",
    weight: 25,
    description: "Percentage of income spent. Target: ≤80%",
    calculate: (s) => {
      const burn = s.burnRatePct;
      if (burn <= 70) return 100;
      if (burn <= 80) return 85;
      if (burn <= 90) return 65;
      if (burn <= 100) return 40;
      return 10;
    },
  },
];

function getHealthGrade(score: number): {
  grade: string;
  color: string;
  label: string;
} {
  if (score >= 90)
    return {
      grade: "A+",
      color: "text-[hsl(var(--status-safe))]",
      label: "Excellent",
    };
  if (score >= 80)
    return {
      grade: "A",
      color: "text-[hsl(var(--status-safe))]",
      label: "Great",
    };
  if (score >= 70)
    return { grade: "B", color: "text-[hsl(var(--chart-3))]", label: "Good" };
  if (score >= 60)
    return {
      grade: "C",
      color: "text-[hsl(var(--status-warning))]",
      label: "Fair",
    };
  if (score >= 50)
    return { grade: "D", color: "text-orange-500", label: "Needs Work" };
  return {
    grade: "F",
    color: "text-[hsl(var(--status-danger))]",
    label: "Critical",
  };
}

function getMetricStatus(score: number): "safe" | "warning" | "danger" {
  if (score >= 70) return "safe";
  if (score >= 40) return "warning";
  return "danger";
}

export function FinancialHealthScore({
  summary,
  previousSummary,
}: FinancialHealthScoreProps) {
  const metricScores = useMemo(() => {
    if (!summary) return METRICS.map((m) => ({ ...m, score: 0 }));
    return METRICS.map((m) => ({ ...m, score: m.calculate(summary) }));
  }, [summary]);

  const totalScore = useMemo(() => {
    const weightedSum = metricScores.reduce(
      (sum, m) => sum + (m.score * m.weight) / 100,
      0,
    );
    return Math.round(weightedSum);
  }, [metricScores]);

  const previousScore = useMemo(() => {
    if (!previousSummary) return null;
    const prevScores = METRICS.map((m) => ({
      ...m,
      score: m.calculate(previousSummary),
    }));
    return Math.round(
      prevScores.reduce((sum, m) => sum + (m.score * m.weight) / 100, 0),
    );
  }, [previousSummary]);

  const scoreChange = previousScore !== null ? totalScore - previousScore : 0;
  const { grade, color, label } = getHealthGrade(totalScore);

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Financial Health Score
            </CardTitle>
            <CardDescription>
              Weighted composite of key financial metrics
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold font-mono ${color}`}>
              {totalScore}
            </div>
            <div className="flex items-center justify-end gap-1 mt-1">
              {scoreChange > 0 ? (
                <TrendingUp className="h-4 w-4 text-[hsl(var(--status-safe))]" />
              ) : scoreChange < 0 ? (
                <TrendingDown className="h-4 w-4 text-[hsl(var(--status-danger))]" />
              ) : null}
              {previousScore !== null && (
                <span
                  className={`text-sm ${
                    scoreChange > 0
                      ? "text-[hsl(var(--status-safe))]"
                      : scoreChange < 0
                        ? "text-[hsl(var(--status-danger))]"
                        : "text-muted-foreground"
                  }`}
                >
                  {scoreChange > 0 ? "+" : ""}
                  {scoreChange} vs last month
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <Progress value={totalScore} className="h-4" />
          </div>
          <Badge
            variant={
              totalScore >= 70
                ? "default"
                : totalScore >= 50
                  ? "secondary"
                  : "destructive"
            }
            className="text-lg px-3 py-1"
          >
            {grade} - {label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metricScores.map((metric) => {
            const status = getMetricStatus(metric.score);
            return (
              <div
                key={metric.name}
                className="p-3 border-2 border-border rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{metric.name}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-[200px] text-xs">
                            {metric.description}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    {status === "safe" && (
                      <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-safe))]" />
                    )}
                    {status === "warning" && (
                      <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-warning))]" />
                    )}
                    {status === "danger" && (
                      <XCircle className="h-4 w-4 text-[hsl(var(--status-danger))]" />
                    )}
                    <span className="font-mono font-bold">{metric.score}</span>
                  </div>
                </div>
                <Progress value={metric.score} className="h-1.5" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Weight: {metric.weight}%</span>
                  <span>
                    Contribution:{" "}
                    {Math.round((metric.score * metric.weight) / 100)} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t-2 border-border">
          <h4 className="text-sm font-medium mb-2">Improvement Priorities</h4>
          <div className="space-y-1">
            {metricScores
              .filter((m) => m.score < 70)
              .sort((a, b) => a.score * a.weight - b.score * b.weight)
              .slice(0, 2)
              .map((metric) => (
                <div
                  key={metric.name}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--status-warning))]" />
                  <span>
                    Focus on improving your <strong>{metric.name}</strong> for
                    the biggest impact
                  </span>
                </div>
              ))}
            {metricScores.every((m) => m.score >= 70) && (
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--status-safe))]">
                <CheckCircle2 className="h-4 w-4" />
                <span>All metrics are healthy! Keep up the great work.</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
