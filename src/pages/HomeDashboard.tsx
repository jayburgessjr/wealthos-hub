import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useDebtsQuery } from "@/hooks/useHouseholdBudgetData";
import { useMonthlyFinancialSummary } from "@/hooks/useHouseholdFinancialSummary";
import { usePlanSummary } from "@/hooks/useCoachPlan";
import { useNavMode } from "@/lib/navMode";
import { loadAnswers } from "@/lib/onboardingProfile";
import { computeWealthLadder, type LadderInput } from "@/lib/wealthLadder";
import { DEMO_LADDER_INPUT } from "@/lib/demoSnapshot";
import {
  HeroBar,
  InvestPanel,
  HouseholdPanel,
  WealthPanel,
  QuickActions,
  WealthLadder,
  NextBestMove,
  StarterChecklist,
} from "@/components/home";
import type { ChecklistItem } from "@/components/home/StarterChecklist";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface DebtRow {
  current_balance: number | null;
  interest_rate: number | null;
  is_active: boolean | null;
}

const INVEST_GOAL_PATTERN = /invest|retire|brokerage|401|ira\b|index|stock/i;

export default function HomeDashboard() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const { mode } = useNavMode();
  const { budget, totalSpent, householdId } = useHouseholdBudget();
  const { data: debtData } = useDebtsQuery(householdId);
  const { data: summaries } = useMonthlyFinancialSummary(householdId);

  const displayName = useMemo(() => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) return user.email.split("@")[0];
    return "there";
  }, [user]);

  const plan = usePlanSummary();
  const blockFor = (section: "wealth" | "invest") => ({
    topItem: plan.plan.items.find((i) => i.section === section) ?? null,
    openActionCount: plan.openActions.length,
  });

  const onboarding = useMemo(() => loadAnswers(user?.id), [user?.id]);

  const cash = useMemo(
    () =>
      budget.bankAccounts
        .filter((a) => a.isActive)
        .reduce((sum, a) => sum + a.currentBalance, 0),
    [budget.bankAccounts],
  );

  const activeDebts = useMemo(
    () =>
      ((debtData?.debts ?? []) as unknown as DebtRow[])
        .filter((d) => d.is_active !== false)
        .map((d) => ({
          balance: Number(d.current_balance ?? 0),
          apr: d.interest_rate == null ? null : Number(d.interest_rate),
        })),
    [debtData],
  );
  const debtsTotal = activeDebts.reduce((s, d) => s + d.balance, 0);

  // Net worth = assets minus debts. Assets are the active bank balances tracked here.
  const netWorth = isDemoMode ? 320 - 1200 : cash - debtsTotal;

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

  const activeGoalsCount = useMemo(
    () => budget.goals.filter((g) => g.currentAmount < g.targetAmount).length,
    [budget.goals],
  );

  const investedAmount = useMemo(
    () =>
      budget.goals
        .filter((g) => INVEST_GOAL_PATTERN.test(g.name))
        .reduce((s, g) => s + g.currentAmount, 0),
    [budget.goals],
  );

  const ladder = useMemo(() => {
    if (isDemoMode) return computeWealthLadder(DEMO_LADDER_INPUT);
    const latest = summaries?.[0];
    const input: LadderInput = {
      onboarding,
      hasHousehold: !!householdId,
      cashBalance: cash,
      debts: activeDebts,
      debtsKnown: !!householdId && debtData !== undefined,
      emergencyMonths: latest ? latest.emergencyFundMonths : null,
      investedAmount,
    };
    return computeWealthLadder(input);
  }, [isDemoMode, onboarding, householdId, cash, activeDebts, debtData, summaries, investedAmount]);

  const checklist: ChecklistItem[] = [
    { id: "onboarding", label: "Tell us your goal", done: isDemoMode || !!onboarding, to: "/onboarding" },
    {
      id: "balance",
      label: "Add what you have saved",
      done: isDemoMode || cash > 0,
      to: householdId ? "/household/money-in/bank-accounts" : "/household/setup",
    },
    {
      id: "goal",
      label: "Set your first savings goal",
      done: isDemoMode || budget.goals.length > 0,
      to: householdId ? "/household/future/goals" : "/household/setup",
    },
    { id: "learn", label: "Read a two-minute lesson", done: false, to: "/learn" },
  ];

  const monthlyNet = budgetTotal - totalSpent;
  const greeting = getGreeting();
  const showPro = mode === "pro";

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

        <div className="flex justify-end">
          <Link
            to="/invs/strategy"
            className="rounded-md border border-primary/40 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Ask the coach
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NextBestMove move={ladder.nextMove} planMove={plan.planMove} showCoachLink />
          <WealthLadder result={ladder} earn={plan.earn} />
        </div>

        <StarterChecklist items={checklist} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            {householdId ? (
              <HouseholdPanel
                budgetSpent={totalSpent}
                budgetTotal={budgetTotal}
                billsDueCount={billsDueCount}
                activeGoalsCount={activeGoalsCount}
                monthlyNet={monthlyNet}
              />
            ) : (
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="font-display text-base font-bold">Track your money</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a private household to keep your balances, bills, debts and goals in one
                  place. It starts empty, and you can begin with $0.
                </p>
                <Link
                  to="/household/setup"
                  className="mt-3 inline-block rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Set up my household
                </Link>
              </div>
            )}
            {showPro && <InvestPanel strategy={blockFor("invest")} />}
          </div>

          <div className="space-y-4">
            <WealthPanel strategy={blockFor("wealth")} />
            {showPro && <QuickActions billsDueCount={billsDueCount} />}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Educational tools only, not investment advice. Investments can lose value and nothing
          here promises any return.
        </p>
      </div>
    </DashboardLayout>
  );
}
