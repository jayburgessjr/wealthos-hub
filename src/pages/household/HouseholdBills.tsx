import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { BillPayments } from "@/components/household/dashboard/BillPayments";
import { BillCalendarView } from "@/components/household/bills/BillCalendarView";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { List, CalendarDays } from "lucide-react";

export default function HouseholdBills() {
  const { budget } = useHouseholdBudget();
  const [view, setView] = useState<"list" | "calendar">("list");

  const tabs = [
    { id: "list" as const, label: "List View", icon: List },
    { id: "calendar" as const, label: "Calendar View", icon: CalendarDays },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Money Out
            </span>
          </div>
          <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
            Bills & <span className="text-emerald-500">Payments</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track upcoming bills and confirm payments before they're due.
          </p>
        </div>

        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "list" | "calendar")}
        >
          <div className="border border-border bg-card rounded-xl p-1 flex gap-1 w-fit overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                    view === tab.id
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

          <TabsContent value="list" className="mt-4">
            <BillPayments />
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <BillCalendarView bills={budget.bills} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
