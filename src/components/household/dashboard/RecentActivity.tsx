import { useMemo, useState } from "react";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Calendar, AlertTriangle } from "lucide-react";
import { ExpenseForm } from "@/components/household/budget/ExpenseForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function RecentActivity() {
  const { budget, isLoading, error } = useHouseholdBudget();
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);

  const recentActivity = useMemo(() => {
    const expenseItems = budget.expenses.map((e) => ({
      id: `exp_${e.id}`,
      kind: "expense" as const,
      amount: e.amount,
      date: e.date,
      label: e.description || "Expense",
      actor: e.userName,
    }));
    const incomeItems = budget.incomeEntries.map((i) => ({
      id: `inc_${i.id}`,
      kind: "income" as const,
      amount: i.amount,
      date: i.date,
      label: i.sourceName || "Income",
      actor: i.userName,
    }));
    return [...expenseItems, ...incomeItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [budget.expenses, budget.incomeEntries]);

  return (
    <section role="region" aria-labelledby="activity-heading">
      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h3
              id="activity-heading"
              className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground"
            >
              Money Movement
            </h3>
          </div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {budget.month}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Latest income and expenses
        </p>
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-500">
                Data error
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-2 w-full">
                  <Skeleton className="h-4 w-10" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>No activity yet</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-xs touch-target"
                onClick={() => setExpenseDialogOpen(true)}
              >
                ADD EXPENSE
              </Button>
              <Link to="/household/income">
                <Button size="sm" className="font-mono text-xs touch-target">
                  ADD INCOME
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider rounded px-1.5 py-0.5 ${
                      item.kind === "income"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {item.kind === "income" ? "IN" : "OUT"}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString()} • {item.actor}
                    </div>
                  </div>
                </div>
                <div
                  className={`font-display font-extrabold ${
                    item.kind === "income"
                      ? "text-emerald-500"
                      : "text-foreground"
                  }`}
                >
                  {item.kind === "income" ? "+" : "-"}$
                  {Math.round(item.amount).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <ExpenseForm onSuccess={() => setExpenseDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
