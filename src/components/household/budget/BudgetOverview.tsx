import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { StatusIndicator } from "./StatusIndicator";
import { ProgressBar } from "./ProgressBar";

export function BudgetOverview() {
  const { budget, totalSpent, remaining, budgetStatus, getDailyAverage } =
    useHouseholdBudget();
  const dailyAverage = getDailyAverage();

  const monthName = new Date(budget.month + "-01").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="border-4 border-border bg-card p-6 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{monthName}</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Household Budget
          </p>
        </div>
        <StatusIndicator status={budgetStatus} size="lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border-2 border-border p-4 bg-secondary">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Income
          </p>
          <p className="text-3xl font-bold font-mono mt-1">
            ${budget.income.toLocaleString()}
          </p>
        </div>
        <div className="border-2 border-border p-4 bg-secondary">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Spent
          </p>
          <p className="text-3xl font-bold font-mono mt-1">
            ${totalSpent.toLocaleString()}
          </p>
        </div>
        <div
          className={`border-2 border-border p-4 ${remaining >= 0 ? "bg-[hsl(var(--status-safe)/0.1)]" : "bg-[hsl(var(--status-danger)/0.1)]"}`}
        >
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Remaining
          </p>
          <p
            className={`text-3xl font-bold font-mono mt-1 ${remaining >= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
          >
            ${Math.abs(remaining).toLocaleString()}
            {remaining < 0 && <span className="text-sm ml-1">over</span>}
          </p>
        </div>
      </div>

      <ProgressBar value={totalSpent} max={budget.income} size="lg" showLabel />

      <div className="mt-4 pt-4 border-t-2 border-border">
        <p className="text-sm text-muted-foreground font-mono">
          Daily average:{" "}
          <span className="font-bold text-foreground">
            ${dailyAverage.toFixed(2)}
          </span>
          /day
        </p>
      </div>
    </div>
  );
}
