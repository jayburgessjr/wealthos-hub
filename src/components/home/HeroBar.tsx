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
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {greeting}
        </p>
        <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
          {displayName}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Net Worth */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Net Worth
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-500">
            {formatCurrency(netWorth)}
          </p>
        </div>

        {/* Portfolio — placeholder until brokerage connected */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Portfolio
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-foreground">$—</p>
          <p className="text-xs text-muted-foreground">Connect broker</p>
        </div>

        {/* Budget Left */}
        <div
          className="rounded-xl border border-border bg-card p-3"
          data-testid="budget-left-chip"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Budget Left
          </p>
          <p
            className={`mt-1 font-mono text-xl font-bold ${
              budgetAmber ? "text-amber-400" : "text-emerald-500"
            }`}
            data-testid="budget-left-value"
          >
            {formatCurrency(budgetLeft)}
          </p>
          <p className="text-xs text-muted-foreground">{budgetPct}% used</p>
        </div>

        {/* Bills Due */}
        <div
          className="rounded-xl border border-border bg-card p-3"
          data-testid="bills-due-chip"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Bills Due
          </p>
          <p
            className={`mt-1 font-mono text-xl font-bold ${
              billsRed ? "text-red-400" : "text-foreground"
            }`}
            data-testid="bills-due-value"
          >
            {billsDueCount}
          </p>
          <p className="text-xs text-muted-foreground">next 7 days</p>
        </div>
      </div>
    </div>
  );
}
