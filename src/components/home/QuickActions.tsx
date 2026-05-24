import { Link } from "react-router-dom";

interface QuickActionsProps {
  billsDueCount: number;
}

const actions = [
  {
    label: "Log Expense",
    icon: "+",
    iconColor: "text-amber-400",
    to: "/household/money-out/budget",
  },
  {
    label: "Add Trade",
    icon: "+",
    iconColor: "text-emerald-500",
    to: "/invs/review",
  },
  {
    label: "View Signals",
    icon: "📊",
    iconColor: "text-emerald-500",
    to: "/invs/discover",
  },
  {
    label: "View Tasks",
    icon: "📋",
    iconColor: "text-indigo-400",
    to: "/household/tasks",
  },
] as const;

export function QuickActions({ billsDueCount }: QuickActionsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        ⚡ Quick Actions
      </p>
      <div className="space-y-1.5">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <span className={action.iconColor}>{action.icon}</span>
            {action.label}
          </Link>
        ))}

        {/* Pay Bills — separate to handle badge */}
        <Link
          to="/household/money-out/bills"
          className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <span className="text-amber-400">🏠</span>
          Pay Bills
          {billsDueCount > 0 && (
            <span
              className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white"
              data-testid="bills-badge"
            >
              {billsDueCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
