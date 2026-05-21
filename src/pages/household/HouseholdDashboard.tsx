import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialReporting } from "@/components/household/dashboard/FinancialReporting";
import { BillPayments } from "@/components/household/dashboard/BillPayments";
import { DashboardOverview } from "@/components/household/dashboard/DashboardOverview";
import { ExpensesTab } from "@/components/household/dashboard/ExpensesTab";
import { TodosTab } from "@/components/household/dashboard/TodosTab";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function HouseholdDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState(tabParam || "overview");

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const onTabChange = (val: string) => {
    setActiveTab(val);
    const params = new URLSearchParams(location.search);
    params.set("tab", val);
    navigate({ search: params.toString() }, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Household Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your financial heartbeat.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 md:w-auto overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reporting">Financial Reporting</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="bills">Bill Payments</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>

          <TabsContent
            value="overview"
            className="space-y-4 animate-in fade-in-50 slide-in-from-left-5 duration-300"
          >
            <DashboardOverview />
          </TabsContent>
          <TabsContent
            value="reporting"
            className="space-y-4 animate-in fade-in-50 slide-in-from-left-5 duration-300"
          >
            <FinancialReporting />
          </TabsContent>
          <TabsContent
            value="expenses"
            className="space-y-4 animate-in fade-in-50 slide-in-from-left-5 duration-300"
          >
            <ExpensesTab />
          </TabsContent>
          <TabsContent
            value="bills"
            className="space-y-4 animate-in fade-in-50 slide-in-from-right-5 duration-300"
          >
            <BillPayments />
          </TabsContent>
          <TabsContent
            value="todos"
            className="space-y-4 animate-in fade-in-50 slide-in-from-right-5 duration-300"
          >
            <TodosTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
