import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/household-format";

interface HeroBarProps {
  greeting: string;
  displayName: string;
  netWorth: number;
  budgetLeft: number;
  budgetPct: number; // 0-100, percent of monthly budget used
  billsDueCount: number;
}

export function HeroBar({
  greeting,
  displayName,
  netWorth,
  budgetLeft,
  budgetPct,
  billsDueCount,
}: HeroBarProps) {
  const budgetAmber = budgetPct >= 80;
  const billsRed = billsDueCount > 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground">
          {greeting}
        </p>
        <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
          {displayName}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        {/* Net Worth */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold text-muted-foreground">
            Net Worth
          </p>
          <p
            className={`mt-1 font-mono text-xl font-bold ${netWorth < 0 ? "text-red-400" : "text-emerald-500"}`}
            data-testid="net-worth-value"
          >
            {netWorth < 0 ? "-" : ""}
            {formatCurrency(Math.abs(netWorth))}
          </p>
          <p className="text-xs text-muted-foreground">Cash minus debts</p>
        </div>

        {/* Budget left */}
        <div
          className="rounded-xl border border-border bg-card p-3"
          data-testid="budget-left-chip"
        >
          <p className="text-xs font-semibold text-muted-foreground">
            Budget left
          </p>
          <p
            className={`mt-1 font-mono text-xl font-bold ${
              budgetAmber ? "text-amber-400" : "text-emerald-500"
            }`}
            data-testid="budget-left-value"
          >
            {formatCurrency(budgetLeft)}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {budgetAmber ? (
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            )}
            {budgetPct}% used{budgetAmber ? ", running low" : ", on track"}
          </p>
        </div>

        {/* Bills due */}
        <div
          className="rounded-xl border border-border bg-card p-3"
          data-testid="bills-due-chip"
        >
          <p className="text-xs font-semibold text-muted-foreground">
            Bills due
          </p>
          <p
            className={`mt-1 font-mono text-xl font-bold ${
              billsRed ? "text-red-400" : "text-foreground"
            }`}
            data-testid="bills-due-value"
          >
            {billsDueCount}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {billsRed ? (
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            )}
            {billsRed ? "due in the next 7 days" : "none due in 7 days"}
          </p>
        </div>
      </div>
    </div>
  );
}
