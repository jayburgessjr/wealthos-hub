import DashboardLayout from "@/components/layout/DashboardLayout";
import { MonthlyCloseoutWizard } from "@/components/household/closeout/MonthlyCloseoutWizard";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useCreateMonthlySummaryMutation } from "@/hooks/useHouseholdBudgetData";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function HouseholdMonthlyCloseout() {
  const { budget, householdId } = useHouseholdBudget();
  const { mutate: createMonthlySummary } =
    useCreateMonthlySummaryMutation(householdId);
  const navigate = useNavigate();

  const handleComplete = (data: any) => {
    createMonthlySummary(
      {
        month: data.month,
        notes: data.notes,
        data: {
          ...data.performance,
          nextMonthGoals: data.nextMonthGoals,
        },
      },
      {
        onSuccess: () => {
          toast.success("Monthly closeout complete!");
          navigate("/household");
        },
        onError: () => {
          toast.error("Failed to save monthly summary");
        },
      },
    );
  };

  const handleCancel = () => {
    navigate("/household");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Insights
            </span>
          </div>
          <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
            Monthly <span className="text-emerald-500">Closeout</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wrap up the month and set the table for the next.
          </p>
        </div>
        <MonthlyCloseoutWizard
          budget={budget}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </DashboardLayout>
  );
}
