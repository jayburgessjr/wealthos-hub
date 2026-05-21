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
      <MonthlyCloseoutWizard
        budget={budget}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </DashboardLayout>
  );
}
