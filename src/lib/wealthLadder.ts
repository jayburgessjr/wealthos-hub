// Pure "wealth ladder" logic. No React, no network.
// Educational guidance only; it is not personalised financial advice.

import type { OnboardingAnswers } from "@/lib/onboardingProfile";

export const STARTER_FUND_TARGET = 500;
export const EMERGENCY_MONTHS_TARGET = 3;
/** Balances at or above this annual rate count as high-interest. */
export const HIGH_INTEREST_APR = 8;
export const GROW_TARGET = 10_000;
export const DIVERSIFY_TARGET = 50_000;
/** Used only when we know nothing about monthly costs. */
const FALLBACK_EMERGENCY_DOLLARS = 1500;

export type StageId =
  | "first_dollar"
  | "starter_fund"
  | "emergency_fund"
  | "debt_and_match"
  | "start_investing"
  | "grow"
  | "diversify";

export interface LadderDebt {
  balance: number;
  /** Annual percentage rate, e.g. 22.9. Missing or null counts as unknown (0). */
  apr?: number | null;
}

export interface LadderInput {
  onboarding?: OnboardingAnswers | null;
  hasHousehold: boolean;
  /** Sum of active bank balances. */
  cashBalance: number;
  debts: LadderDebt[];
  /** Whether debts were actually loaded from household data. */
  debtsKnown: boolean;
  /** Months of expenses covered by liquid savings, if known. */
  emergencyMonths?: number | null;
  /** Dollars already invested, if known. */
  investedAmount?: number;
}

export interface NextMove {
  title: string;
  why: string;
  to: string;
  cta: string;
}

export interface LadderStage {
  id: StageId;
  title: string;
  summary: string;
}

export interface LadderResult {
  stage: LadderStage;
  stageIndex: number;
  stages: (LadderStage & { done: boolean; current: boolean })[];
  /** Progress inside the current stage, 0 to 1. */
  progress: number;
  nextMove: NextMove;
}

export const LADDER_STAGES: LadderStage[] = [
  { id: "first_dollar", title: "First dollar", summary: "Know what you have and start from there." },
  { id: "starter_fund", title: "Starter fund", summary: `Set aside your first $${STARTER_FUND_TARGET}.` },
  { id: "emergency_fund", title: "Emergency fund", summary: `Cover ${EMERGENCY_MONTHS_TARGET} months of basic costs.` },
  { id: "debt_and_match", title: "Debt and employer match", summary: "Clear high-interest debt and claim any employer match." },
  { id: "start_investing", title: "Start investing", summary: "Begin with simple, low-cost index funds." },
  { id: "grow", title: "Grow", summary: "Add steadily and let time do the work." },
  { id: "diversify", title: "Diversify", summary: "Spread money across different kinds of assets." },
];

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const money = (n: number): string => `$${Math.round(n).toLocaleString("en-US")}`;

export function computeWealthLadder(input: LadderInput): LadderResult {
  const ob = input.onboarding ?? null;
  const cashRecorded = Math.max(0, input.cashBalance || 0);
  // With no recorded balances, fall back to what the person said they start with.
  const cash = cashRecorded > 0 ? cashRecorded : Math.max(0, ob?.startingAmount ?? 0);
  const invested = Math.max(0, input.investedAmount ?? 0);

  // Emergency fund coverage.
  const months =
    input.emergencyMonths != null && Number.isFinite(input.emergencyMonths) && input.emergencyMonths > 0
      ? input.emergencyMonths
      : null;
  const selfReportedFund = months == null && ob?.hasEmergencyFund === true;
  const emergencyProgress =
    months != null
      ? clamp01(months / EMERGENCY_MONTHS_TARGET)
      : selfReportedFund
        ? 1
        : clamp01(cash / FALLBACK_EMERGENCY_DOLLARS);
  const emergencyDone = emergencyProgress >= 1;

  // High-interest debt: recorded debts win; otherwise the onboarding answer.
  const highDebtTotal = input.debtsKnown
    ? input.debts
        .filter((d) => (d.apr ?? 0) >= HIGH_INTEREST_APR && d.balance > 0)
        .reduce((s, d) => s + d.balance, 0)
    : 0;
  const hasHighDebt = input.debtsKnown ? highDebtTotal > 0 : ob?.hasHighInterestDebt === true;

  const done: boolean[] = [
    cash > 0 || invested > 0, // first dollar
    cash >= STARTER_FUND_TARGET || invested > 0 || emergencyDone, // starter fund
    emergencyDone,
    !hasHighDebt,
    invested > 0,
    invested >= GROW_TARGET,
    false, // diversify has no finish line
  ];
  let idx = done.findIndex((d) => !d);
  if (idx < 0) idx = LADDER_STAGES.length - 1;
  const stage = LADDER_STAGES[idx];

  let progress = 0;
  if (stage.id === "starter_fund") progress = clamp01(cash / STARTER_FUND_TARGET);
  else if (stage.id === "emergency_fund") progress = emergencyProgress;
  else if (stage.id === "grow") progress = clamp01(invested / GROW_TARGET);
  else if (stage.id === "diversify") progress = clamp01(invested / DIVERSIFY_TARGET);

  const hh = input.hasHousehold;
  let nextMove: NextMove;
  switch (stage.id) {
    case "first_dollar":
      nextMove = hh
        ? {
            title: "Add what you have today",
            why: "Everything starts from knowing your number. Even $1 counts, and so does $0.",
            to: "/household/money-in/bank-accounts",
            cta: "Add an account",
          }
        : {
            title: "Create your private money space",
            why: "A household is where your balances, bills and goals are kept. It takes a minute and starts empty.",
            to: "/household/setup",
            cta: "Set it up",
          };
      break;
    case "starter_fund":
      nextMove = {
        title: `Build a ${money(STARTER_FUND_TARGET)} starter fund`,
        why: `A small cushion means a surprise bill does not turn into debt. You have ${money(cash)} so far.`,
        to: hh ? "/household/future/goals" : "/household/setup",
        cta: hh ? "Set this goal" : "Set up first",
      };
      break;
    case "emergency_fund":
      nextMove = {
        title: `Grow savings to ${EMERGENCY_MONTHS_TARGET} months of costs`,
        why:
          months != null
            ? `You cover about ${months.toFixed(1)} months today. Three months gives you room if income stops.`
            : "Three months of basic costs gives you room if income stops, and keeps you from selling investments at a bad time.",
        to: hh ? "/household/future/goals" : "/household/setup",
        cta: hh ? "Set this goal" : "Set up first",
      };
      break;
    case "debt_and_match":
      nextMove = {
        title: "Pay down your highest-rate debt",
        why: input.debtsKnown
          ? `You have ${money(highDebtTotal)} at ${HIGH_INTEREST_APR}% or more. Paying it off saves the interest you would otherwise pay. If your job offers a retirement match, claim it too.`
          : "High-rate debt usually costs more each year than savings are likely to earn. If your job offers a retirement match, claim it too.",
        to: hh ? "/household/money-out/debts" : "/household/setup",
        cta: hh ? "See my debts" : "Set up first",
      };
      break;
    case "start_investing":
      nextMove = {
        title: "Learn index fund basics, then take a small first step",
        why: "Index funds hold many companies at once and charge low fees, so they are a common starting point. Investments can lose value, and nothing is guaranteed.",
        to: "/learn",
        cta: "Read the basics",
      };
      break;
    case "grow":
      nextMove = {
        title: "Add a little on a schedule",
        why: `Steady contributions matter more than timing. You are at ${money(invested)} of a ${money(GROW_TARGET)} milestone.`,
        to: hh ? "/household/future/goals" : "/household/setup",
        cta: hh ? "Track my goal" : "Set up first",
      };
      break;
    default:
      nextMove = {
        title: "Spread across different kinds of assets",
        why: "Holding different asset types means one weak area hurts less. Review your mix from time to time.",
        to: "/wealth/assets/real-estate",
        cta: "Review my assets",
      };
  }

  return {
    stage,
    stageIndex: idx,
    stages: LADDER_STAGES.map((s, i) => ({ ...s, done: i < idx, current: i === idx })),
    progress,
    nextMove,
  };
}
