import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/household-format";

interface HouseholdPanelProps {
  budgetSpent: number;
  budgetTotal: number;
  billsDueCount: number;
  activeGoalsCount: number;
  monthlyNet: number;
}

export function HouseholdPanel({
  budgetSpent,
  budgetTotal,
  billsDueCount,
  activeGoalsCount,
  monthlyNet,
}: HouseholdPanelProps) {
  const pct =
    budgetTotal > 0 ? Math.min((budgetSpent / budgetTotal) * 100, 100) : 0;

  return (
    <div className="rounded-xl border border-border border-t-2 border-t-amber-500 bg-card p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-amber-500">
            🏠 Household
          </p>
          <p className="mt-0.5 text-sm font-bold">Budget & Finance</p>
        </div>
        <Link
          to="/household/command-center"
          className="rounded-md bg-amber-500 px-2 py-1 text-xs font-bold text-black hover:bg-amber-400 transition-colors"
        >
          → Command Center
        </Link>
      </div>

      {/* Budget progress */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Monthly Budget</span>
          <span>
            {formatCurrency(budgetSpent)} / {formatCurrency(budgetTotal)}
          </span>
        </div>
        <div
          className="h-1.5 w-full rounded-full bg-muted"
          data-testid="budget-bar"
        >
          <div
            className="h-1.5 rounded-full bg-amber-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p
            className={`font-mono text-lg font-bold ${billsDueCount > 0 ? "text-red-400" : "text-foreground"}`}
          >
            {billsDueCount}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Bills Due</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="font-mono text-lg font-bold text-foreground">
            {activeGoalsCount}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Active Goals</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p
            className={`font-mono text-lg font-bold ${monthlyNet >= 0 ? "text-emerald-500" : "text-red-400"}`}
            data-testid="monthly-net"
          >
            {monthlyNet >= 0 ? "+" : ""}
            {formatCurrency(monthlyNet)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly Net</p>
        </div>
      </div>
    </div>
  );
}
