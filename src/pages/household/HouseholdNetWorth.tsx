import DashboardLayout from "@/components/layout/DashboardLayout";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function HouseholdNetWorth() {
  const { budget } = useHouseholdBudget();
  const assets = budget.bankAccounts.reduce(
    (s, a) => s + (a.currentBalance || 0),
    0,
  );
  const liabilities = budget.bills
    .filter((b) => b.paymentStatus !== "paid")
    .reduce((s, b) => s + (b.totalBalance || 0), 0);
  const netWorth = assets - liabilities;

  return (
    <DashboardLayout>
      <div className="space-y-6" role="region" aria-labelledby="networth-title">
        <div>
          <h1 id="networth-title" className="text-2xl md:text-3xl font-bold">
            Net Worth
          </h1>
          <p className="text-muted-foreground font-mono text-xs md:text-sm mt-1">
            Assets minus liabilities
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription>Assets</CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${assets.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription>Liabilities</CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${liabilities.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription>Net Worth</CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${netWorth.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Accounts</CardTitle>
            <CardDescription>Balances by account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {budget.bankAccounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 border-2 border-border bg-card"
                >
                  <span>{a.name}</span>
                  <span className="font-mono font-bold">
                    ${a.currentBalance.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
