import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { BillPayments } from "@/components/household/dashboard/BillPayments";
import { BillCalendarView } from "@/components/household/bills/BillCalendarView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { List, CalendarDays } from "lucide-react";

export default function HouseholdBills() {
  const { budget } = useHouseholdBudget();
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "list" | "calendar")}
        >
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>

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
