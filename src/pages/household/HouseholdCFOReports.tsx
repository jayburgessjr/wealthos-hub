import DashboardLayout from "@/components/layout/DashboardLayout";
import TabNav from "@/components/layout/TabNav";
import { CFODashboard } from "@/components/household/dashboard/CFODashboard";
import { BillPaymentAllocation } from "@/components/household/bills/BillPaymentAllocation";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useMonthlyFinancialSummary } from "@/hooks/useHouseholdFinancialSummary";
import {
  useBillPaymentsQuery,
  useCreateBillPaymentMutation,
} from "@/hooks/useHouseholdBillPayments";
import { useDebtsQuery } from "@/hooks/useHouseholdBudgetData";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { BarChart3, CreditCard } from "lucide-react";
import { useState } from "react";
import { useBudgetAlerts } from "@/hooks/useHouseholdBudgetAlerts";

export default function HouseholdCFOReports() {
  const { budget, currentMonth, householdId } = useHouseholdBudget();
  const [cfoTab, setCfoTab] = useState<string>("dashboard");

  const { data: summaries, isLoading: summariesLoading } =
    useMonthlyFinancialSummary(householdId);
  const { data: billPayments, isLoading: paymentsLoading } =
    useBillPaymentsQuery(householdId);
  const { data: debtsData } = useDebtsQuery(householdId);
  const createPaymentMutation = useCreateBillPaymentMutation(householdId);

  // Enable proactive budget alerts
  useBudgetAlerts({
    categories: budget.categories,
    expenses: budget.expenses,
    currentMonth,
    enabled: true,
  });

  const handleAllocatePayment = async (
    billId: string,
    expenseId: string,
    amount: number,
  ) => {
    await createPaymentMutation.mutateAsync({ billId, expenseId, amount });
  };

  // Calculate total income for current month
  const monthlyIncome =
    budget.incomeEntries
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.amount, 0) || budget.income;

  // Map debts to expected format
  const debts = (debtsData?.debts || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    current_balance: Number(d.current_balance) || 0,
    total_balance: Number(d.total_balance) || 0,
    monthly_payment: Number(d.monthly_payment) || 0,
    interest_rate: d.interest_rate ? Number(d.interest_rate) : null,
  }));

  return (
    <DashboardLayout>
      <TabNav group="household-insights" />
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Insights
            </span>
          </div>
          <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
            CFO <span className="text-emerald-500">Reports</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Executive-level financial insights and bill payment tracking.
          </p>
        </div>

        <Tabs value={cfoTab} onValueChange={setCfoTab} className="space-y-6">
          <div className="border border-border bg-card rounded-xl p-1 flex gap-1 w-fit overflow-x-auto">
            {[
              {
                id: "dashboard",
                label: "Financial Overview",
                icon: BarChart3,
              },
              { id: "payments", label: "Bill Payments", icon: CreditCard },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCfoTab(tab.id)}
                  className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    cfoTab === tab.id
                      ? "bg-foreground/[0.08] text-foreground"
                      : "text-foreground/40 hover:text-foreground/70"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <TabsContent value="dashboard">
            <CFODashboard
              summaries={summaries || []}
              currentMonth={currentMonth}
              isLoading={summariesLoading}
              categories={budget.categories}
              expenses={budget.expenses}
              income={monthlyIncome}
              debts={debts}
            />
          </TabsContent>

          <TabsContent value="payments">
            <BillPaymentAllocation
              bills={budget.bills}
              expenses={budget.expenses}
              billPayments={billPayments || []}
              onAllocatePayment={handleAllocatePayment}
              isLoading={paymentsLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
