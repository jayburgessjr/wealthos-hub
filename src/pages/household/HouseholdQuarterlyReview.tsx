import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/household-format";
import { toast } from "sonner";
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { format, startOfQuarter, endOfQuarter, subQuarters } from "date-fns";

function getCurrentQuarter(date: Date): string {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q} ${date.getFullYear()}`;
}

function getPeriodKey(date: Date): string {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${q}`;
}

export default function HouseholdQuarterlyReview() {
  const { budget, upsertQuarterlySummary, householdId } = useHouseholdBudget();
  const navigate = useNavigate();

  const now = new Date();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const quarterLabel = getCurrentQuarter(now);
  const periodKey = getPeriodKey(now);

  // Existing summary for this quarter
  const existing = budget.quarterlySummaries.find(
    (s) => s.period === periodKey,
  );

  // Quarter date range
  const qStart = startOfQuarter(now);
  const qEnd = endOfQuarter(now);

  // Compute summary metrics from budget data
  const metrics = useMemo(() => {
    const totalSpent = budget.expenses.reduce((s, e) => s + e.amount, 0);
    const totalIncome = budget.incomeEntries.reduce((s, e) => s + e.amount, 0);
    const netSavings = totalIncome - totalSpent;
    const savingsRate =
      totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : "0.0";
    const goalsOnTrack = budget.goals.filter(
      (g) => g.currentAmount >= g.targetAmount * 0.75,
    ).length;
    return { totalSpent, totalIncome, netSavings, savingsRate, goalsOnTrack };
  }, [budget]);

  const handleSave = async () => {
    if (!householdId) {
      toast.error("No household — create one first");
      return;
    }
    setSaving(true);
    try {
      upsertQuarterlySummary({
        period: periodKey,
        notes,
        data: {
          totalSpent: metrics.totalSpent,
          totalIncome: metrics.totalIncome,
          netSavings: metrics.netSavings,
          savingsRate: metrics.savingsRate,
          goalsOnTrack: metrics.goalsOnTrack,
        },
      });
      toast.success("Quarterly review saved!");
      navigate("/household");
    } catch {
      toast.error("Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/household")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Quarterly Review
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              {quarterLabel} · {format(qStart, "MMM d")} –{" "}
              {format(qEnd, "MMM d, yyyy")}
            </p>
          </div>
          {existing && (
            <Badge variant="secondary" className="ml-auto">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs font-mono uppercase">
                Income
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl font-bold text-emerald-600">
                {formatCurrency(metrics.totalIncome)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs font-mono uppercase">
                Spent
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl font-bold">
                {formatCurrency(metrics.totalSpent)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs font-mono uppercase">
                Net Savings
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p
                className={`text-xl font-bold flex items-center gap-1 ${metrics.netSavings >= 0 ? "text-emerald-600" : "text-destructive"}`}
              >
                {metrics.netSavings >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {formatCurrency(Math.abs(metrics.netSavings))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs font-mono uppercase">
                Savings Rate
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl font-bold">{metrics.savingsRate}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Goals Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budget.goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No goals set.</p>
            ) : (
              <div className="space-y-2">
                {budget.goals.map((g) => {
                  const pct = Math.min(
                    (g.currentAmount / g.targetAmount) * 100,
                    100,
                  );
                  return (
                    <div key={g.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{g.name}</span>
                          <span className="text-muted-foreground font-mono text-xs">
                            {formatCurrency(g.currentAmount)} /{" "}
                            {formatCurrency(g.targetAmount)}
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <Badge
                        variant={pct >= 75 ? "default" : "secondary"}
                        className="shrink-0 text-xs"
                      >
                        {pct.toFixed(0)}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes & Reflections</CardTitle>
            <CardDescription>
              What went well? What would you change next quarter?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="notes" className="sr-only">
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Key wins, lessons learned, goals for next quarter…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => navigate("/household")}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !householdId}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? "Saving…" : "Save Quarterly Review"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
