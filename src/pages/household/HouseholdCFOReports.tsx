import DashboardLayout from "@/components/layout/DashboardLayout";
import { CFODashboard } from "@/components/household/dashboard/CFODashboard";
import { BillPaymentAllocation } from "@/components/household/bills/BillPaymentAllocation";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useMonthlyFinancialSummary } from "@/hooks/useHouseholdFinancialSummary";
import {
  useBillPaymentsQuery,
  useCreateBillPaymentMutation,
} from "@/hooks/useHouseholdBillPayments";
import { useDebtsQuery } from "@/hooks/useHouseholdBudgetData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, CreditCard } from "lucide-react";
import { useBudgetAlerts } from "@/hooks/useHouseholdBudgetAlerts";

export default function HouseholdCFOReports() {
  const { budget, currentMonth, householdId } = useHouseholdBudget();

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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            CFO Reports
          </h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Executive-level financial insights and bill payment tracking
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dashboard" className="font-mono">
              <BarChart3 className="h-4 w-4 mr-2" />
              Financial Overview
            </TabsTrigger>
            <TabsTrigger value="payments" className="font-mono">
              <CreditCard className="h-4 w-4 mr-2" />
              Bill Payments
            </TabsTrigger>
          </TabsList>

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
