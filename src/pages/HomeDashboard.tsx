import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useAuth } from "@/components/AuthProvider";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  HeroBar,
  InvestPanel,
  HouseholdPanel,
  WealthPanel,
  QuickActions,
} from "@/components/home";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeDashboard() {
  const { user } = useAuth();
  const { budget, totalSpent, householdId } = useHouseholdBudget();

  const displayName = useMemo(() => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) return user.email.split("@")[0];
    return "there";
  }, [user]);

  const netWorth = useMemo(() => {
    const assets = budget.bankAccounts
      .filter((a) => a.isActive)
      .reduce((sum, a) => sum + a.currentBalance, 0);
    return assets;
  }, [budget.bankAccounts]);

  const budgetTotal =
    budget.income > 0 ? budget.income : budget.expectedMonthlyIncome;

  const budgetLeft = Math.max(0, budgetTotal - totalSpent);

  const budgetPct =
    budgetTotal > 0
      ? Math.min(100, Math.round((totalSpent / budgetTotal) * 100))
      : 0;

  const billsDueCount = useMemo(() => {
    const now = new Date();
    const sevenDaysOut = new Date(now);
    sevenDaysOut.setDate(now.getDate() + 7);
    return budget.bills.filter((b) => {
      if (b.paymentStatus === "paid") return false;
      if (!b.dueDate) return false;
      const due = new Date(b.dueDate);
      return due >= now && due <= sevenDaysOut;
    }).length;
  }, [budget.bills]);

  const activeGoalsCount = useMemo(() => {
    return budget.goals.filter((g) => g.currentAmount < g.targetAmount).length;
  }, [budget.goals]);

  const monthlyNet = budgetTotal - totalSpent;

  const greeting = getGreeting();

  if (!householdId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
          <p className="text-2xl font-bold">Welcome to AJE</p>
          <p className="text-muted-foreground max-w-sm">
            Set up your household to unlock budgeting, bills, goals, and more.
          </p>
          <Link
            to="/household/setup"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 transition-colors"
          >
            Set Up Household →
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <HeroBar
          greeting={greeting}
          displayName={displayName}
          netWorth={netWorth}
          budgetLeft={budgetLeft}
          budgetPct={budgetPct}
          billsDueCount={billsDueCount}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Left column — spans 2 */}
          <div className="md:col-span-2 space-y-4">
            <InvestPanel />
            <HouseholdPanel
              budgetSpent={totalSpent}
              budgetTotal={budgetTotal}
              billsDueCount={billsDueCount}
              activeGoalsCount={activeGoalsCount}
              monthlyNet={monthlyNet}
            />
          </div>

          {/* Right column — spans 1 */}
          <div className="space-y-4">
            <WealthPanel />
            <QuickActions billsDueCount={billsDueCount} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
