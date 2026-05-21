import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Bill } from "@/integrations/supabase/household-types";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";

interface BillCalendarViewProps {
  bills: Bill[];
  onBillClick?: (bill: Bill) => void;
}

export function BillCalendarView({
  bills,
  onBillClick,
}: BillCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group bills by due date
  const billsByDate = useMemo(() => {
    const map = new Map<string, Bill[]>();
    bills
      .filter((b) => b.isActive !== false)
      .forEach((bill) => {
        const dateKey = bill.dueDate.slice(0, 10);
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(bill);
      });
    return map;
  }, [bills]);

  // Calculate totals for the month
  const monthStats = useMemo(() => {
    const monthBills = bills.filter((b) => {
      const dueDate = new Date(b.dueDate);
      return isSameMonth(dueDate, currentMonth) && b.isActive !== false;
    });

    const totalDue = monthBills.reduce((sum, b) => sum + b.amount, 0);
    const totalPaid = monthBills
      .filter((b) => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + b.amount, 0);
    const unpaidCount = monthBills.filter(
      (b) => b.paymentStatus !== "paid",
    ).length;
    const overdueCount = monthBills.filter((b) => {
      return (
        b.paymentStatus !== "paid" &&
        isBefore(new Date(b.dueDate), startOfDay(new Date()))
      );
    }).length;

    return { totalDue, totalPaid, unpaidCount, overdueCount, monthBills };
  }, [bills, currentMonth]);

  const goToPreviousMonth = () => setCurrentMonth((prev) => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const getStatusColor = (bill: Bill) => {
    if (bill.paymentStatus === "paid") return "bg-green-500";
    if (bill.paymentStatus === "partial") return "bg-yellow-500";
    const dueDate = new Date(bill.dueDate);
    if (isBefore(dueDate, startOfDay(new Date()))) return "bg-red-500";
    return "bg-primary";
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Pad start of month to align with correct day of week
  const startDayOfWeek = monthStart.getDay();
  const paddedDays = Array(startDayOfWeek).fill(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Bill Calendar
            </CardTitle>
            <CardDescription>
              View when bills are due for cash flow planning
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <span className="font-medium min-w-[140px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Month Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Total Due</p>
            <p className="text-lg font-bold">
              ${monthStats.totalDue.toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-green-600">
              ${monthStats.totalPaid.toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Unpaid</p>
            <p className="text-lg font-bold text-yellow-600">
              {monthStats.unpaidCount} bills
            </p>
          </div>
          {monthStats.overdueCount > 0 && (
            <div className="p-3 bg-red-500/10 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-lg font-bold text-red-600">
                {monthStats.overdueCount} bills
              </p>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty padding cells */}
          {paddedDays.map((_, idx) => (
            <div
              key={`pad-${idx}`}
              className="min-h-[80px] md:min-h-[100px] bg-muted/20 rounded-lg"
            />
          ))}

          {/* Actual days */}
          {daysInMonth.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayBills = billsByDate.get(dateKey) || [];
            const dayTotal = dayBills.reduce((sum, b) => sum + b.amount, 0);
            const hasOverdue = dayBills.some(
              (b) =>
                b.paymentStatus !== "paid" &&
                isBefore(day, startOfDay(new Date())),
            );
            const allPaid =
              dayBills.length > 0 &&
              dayBills.every((b) => b.paymentStatus === "paid");

            return (
              <div
                key={dateKey}
                className={cn(
                  "min-h-[80px] md:min-h-[100px] p-1.5 rounded-lg border transition-colors",
                  isToday(day) && "ring-2 ring-primary",
                  dayBills.length > 0
                    ? "bg-card hover:bg-accent/50 cursor-pointer"
                    : "bg-muted/20",
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isToday(day) && "text-primary font-bold",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayBills.length > 0 && (
                    <div className="flex items-center gap-0.5">
                      {hasOverdue && (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                      {allPaid && (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  )}
                </div>

                {/* Bill indicators */}
                <div className="space-y-0.5 overflow-hidden">
                  {dayBills.slice(0, 3).map((bill) => (
                    <div
                      key={bill.id}
                      onClick={() => onBillClick?.(bill)}
                      className={cn(
                        "text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white",
                        getStatusColor(bill),
                      )}
                      title={`${bill.name}: $${bill.amount}`}
                    >
                      {bill.name}
                    </div>
                  ))}
                  {dayBills.length > 3 && (
                    <div className="text-[10px] text-muted-foreground text-center">
                      +{dayBills.length - 3} more
                    </div>
                  )}
                </div>

                {/* Total for day */}
                {dayTotal > 0 && (
                  <div className="text-[10px] font-medium text-muted-foreground mt-auto pt-1">
                    ${dayTotal.toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>Upcoming</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Paid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Overdue</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
