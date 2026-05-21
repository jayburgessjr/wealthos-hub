import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";

export function useDemoMode() {
  const { householdId } = useHouseholdBudget();
  const allowBrowse =
    (import.meta as any).env?.VITE_ALLOW_BROWSE_WITHOUT_HOUSEHOLD === "true";
  const demoMode = allowBrowse && !householdId;
  return { demoMode };
}
