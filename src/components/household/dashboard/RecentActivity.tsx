import { useMemo, useState } from "react";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { ExpenseForm } from "@/components/household/budget/ExpenseForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
      <Card className="border-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle id="activity-heading" className="text-lg">
                Money Movement
              </CardTitle>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {budget.month}
            </div>
          </div>
          <CardDescription>Latest income and expenses</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-3 border-2">
              <AlertTitle>Data error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3 border-2 border-border bg-card flex items-center justify-between"
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
                  className="flex items-center justify-between p-3 border-2 border-border bg-card"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-1.5 py-[2px] border border-border bg-secondary">
                      {item.kind === "income" ? "IN" : "OUT"}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {new Date(item.date).toLocaleDateString()} •{" "}
                        {item.actor}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`font-mono font-bold ${item.kind === "income" ? "text-[hsl(var(--status-safe))]" : ""}`}
                  >
                    {item.kind === "income" ? "+" : "-"}$
                    {Math.round(item.amount).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
