import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "reporting", label: "Financial Reporting" },
    { id: "expenses", label: "Expenses" },
    { id: "bills", label: "Bill Payments" },
    { id: "todos", label: "Todos" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Household Finance
            </span>
          </div>
          <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
            Budget <span className="text-emerald-500">Overview</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back. Here's your financial heartbeat.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="space-y-4"
        >
          <div className="border border-border bg-card rounded-xl p-1 flex gap-1 w-fit overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-foreground/[0.08] text-foreground"
                    : "text-foreground/40 hover:text-foreground/70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
