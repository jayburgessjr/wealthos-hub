import type { LadderInput } from "@/lib/wealthLadder";

/** Fixed sample numbers for logged-out demo visitors. Nothing here is saved anywhere. */
export const DEMO_LADDER_INPUT: LadderInput = {
  onboarding: null,
  hasHousehold: true,
  cashBalance: 320,
  debts: [{ balance: 1200, apr: 24 }],
  debtsKnown: true,
  emergencyMonths: 0.4,
  investedAmount: 0,
};

export const DEMO_NET_WORTH = 320 - 1200;
