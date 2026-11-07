import { describe, it, expect } from "vitest";
import {
  computeWealthLadder,
  LADDER_STAGES,
  STARTER_FUND_TARGET,
  GROW_TARGET,
  DIVERSIFY_TARGET,
  type LadderInput,
} from "@/lib/wealthLadder";
import type { OnboardingAnswers } from "@/lib/onboardingProfile";

const base: LadderInput = {
  onboarding: null,
  hasHousehold: true,
  cashBalance: 0,
  debts: [],
  debtsKnown: true,
  emergencyMonths: null,
  investedAmount: 0,
};

const ob = (o: Partial<OnboardingAnswers> = {}): OnboardingAnswers => ({
  goal: "starter_fund",
  experience: "new",
  startingAmount: 0,
  monthlyAmount: 0,
  hasEmergencyFund: false,
  hasHighInterestDebt: false,
  risk: "cautious",
  assetInterests: [],
  ...o,
});

describe("computeWealthLadder stages", () => {
  it("zero data: first dollar, progress 0, set up household", () => {
    const r = computeWealthLadder({ ...base, hasHousehold: false, debtsKnown: false, debts: [] });
    expect(r.stage.id).toBe("first_dollar");
    expect(r.progress).toBe(0);
    expect(r.nextMove.to).toBe("/household/setup");
    expect(r.stages).toHaveLength(LADDER_STAGES.length);
  });

  it("zero data with household points to adding an account", () => {
    const r = computeWealthLadder(base);
    expect(r.stage.id).toBe("first_dollar");
    expect(r.nextMove.to).toBe("/household/money-in/bank-accounts");
  });

  it("$1 moves past first dollar into starter fund with tiny progress", () => {
    const r = computeWealthLadder({ ...base, cashBalance: 1 });
    expect(r.stage.id).toBe("starter_fund");
    expect(r.progress).toBeCloseTo(1 / STARTER_FUND_TARGET);
  });

  it("onboarding starting amount counts when no balances are recorded", () => {
    const r = computeWealthLadder({ ...base, onboarding: ob({ startingAmount: 250 }) });
    expect(r.stage.id).toBe("starter_fund");
    expect(r.progress).toBeCloseTo(0.5);
  });

  it("starter fund reached moves to emergency fund", () => {
    const r = computeWealthLadder({ ...base, cashBalance: STARTER_FUND_TARGET });
    expect(r.stage.id).toBe("emergency_fund");
  });

  it("emergency fund progress follows months of cover", () => {
    const r = computeWealthLadder({ ...base, cashBalance: 800, emergencyMonths: 1.5 });
    expect(r.stage.id).toBe("emergency_fund");
    expect(r.progress).toBeCloseTo(0.5);
    expect(r.nextMove.why).toContain("1.5");
  });

  it("self-reported emergency fund is trusted when months are unknown", () => {
    const r = computeWealthLadder({
      ...base,
      cashBalance: 100,
      onboarding: ob({ hasEmergencyFund: true }),
    });
    expect(r.stage.id).not.toBe("emergency_fund");
    expect(r.stage.id).toBe("start_investing");
  });

  it("high-interest debt blocks the debt stage; low-rate debt does not", () => {
    const withHigh = computeWealthLadder({
      ...base,
      cashBalance: 2000,
      emergencyMonths: 3,
      debts: [{ balance: 1200, apr: 24 }],
    });
    expect(withHigh.stage.id).toBe("debt_and_match");
    expect(withHigh.nextMove.to).toBe("/household/money-out/debts");
    expect(withHigh.nextMove.why).toContain("$1,200");

    const withLow = computeWealthLadder({
      ...base,
      cashBalance: 2000,
      emergencyMonths: 3,
      debts: [{ balance: 9000, apr: 4 }],
    });
    expect(withLow.stage.id).toBe("start_investing");
  });

  it("null or missing APR counts as not high-interest", () => {
    const r = computeWealthLadder({
      ...base,
      cashBalance: 2000,
      emergencyMonths: 3,
      debts: [{ balance: 500, apr: null }, { balance: 500 }],
    });
    expect(r.stage.id).toBe("start_investing");
  });

  it("falls back to the onboarding debt answer when debts are unknown", () => {
    const r = computeWealthLadder({
      ...base,
      hasHousehold: false,
      debtsKnown: false,
      cashBalance: 0,
      onboarding: ob({ startingAmount: 3000, hasEmergencyFund: true, hasHighInterestDebt: true }),
    });
    expect(r.stage.id).toBe("debt_and_match");
  });

  it("recorded debts override the onboarding debt answer", () => {
    const r = computeWealthLadder({
      ...base,
      cashBalance: 2000,
      emergencyMonths: 3,
      debts: [],
      onboarding: ob({ hasHighInterestDebt: true }),
    });
    expect(r.stage.id).toBe("start_investing");
  });

  it("start investing links to the learn page", () => {
    const r = computeWealthLadder({ ...base, cashBalance: 2000, emergencyMonths: 3 });
    expect(r.stage.id).toBe("start_investing");
    expect(r.nextMove.to).toBe("/learn");
  });

  it("grow stage tracks progress toward the milestone", () => {
    const r = computeWealthLadder({
      ...base,
      cashBalance: 2000,
      emergencyMonths: 3,
      investedAmount: GROW_TARGET / 2,
    });
    expect(r.stage.id).toBe("grow");
    expect(r.progress).toBeCloseTo(0.5);
  });

  it("diversify is the last stage and caps progress at 1", () => {
    const r = computeWealthLadder({
      ...base,
      cashBalance: 2000,
      emergencyMonths: 3,
      investedAmount: DIVERSIFY_TARGET * 3,
    });
    expect(r.stage.id).toBe("diversify");
    expect(r.stageIndex).toBe(LADDER_STAGES.length - 1);
    expect(r.progress).toBe(1);
  });

  it("marks earlier stages done and the current one current", () => {
    const r = computeWealthLadder({ ...base, cashBalance: 2000, emergencyMonths: 3 });
    expect(r.stages.filter((s) => s.done).map((s) => s.id)).toEqual([
      "first_dollar",
      "starter_fund",
      "emergency_fund",
      "debt_and_match",
    ]);
    expect(r.stages.filter((s) => s.current)).toHaveLength(1);
  });
});

describe("computeWealthLadder edge cases", () => {
  it("negative or NaN inputs do not break progress", () => {
    const r = computeWealthLadder({
      ...base,
      cashBalance: -50,
      investedAmount: Number.NaN,
      emergencyMonths: Number.NaN,
    });
    expect(r.progress).toBeGreaterThanOrEqual(0);
    expect(r.progress).toBeLessThanOrEqual(1);
    expect(r.stage.id).toBe("first_dollar");
  });

  it("progress is always within 0 to 1 and every move has a why and a link", () => {
    const cases: Partial<LadderInput>[] = [
      {},
      { cashBalance: 1 },
      { cashBalance: 499 },
      { cashBalance: 5000, emergencyMonths: 10 },
      { investedAmount: 1 },
      { investedAmount: 1e9, cashBalance: 1e9, emergencyMonths: 99 },
    ];
    for (const c of cases) {
      const r = computeWealthLadder({ ...base, ...c });
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(1);
      expect(r.nextMove.why.length).toBeGreaterThan(10);
      expect(r.nextMove.to.startsWith("/")).toBe(true);
    }
  });

  it("never promises returns in move copy", () => {
    const r = computeWealthLadder({ ...base, cashBalance: 2000, emergencyMonths: 3 });
    expect(r.nextMove.why).toMatch(/lose value|no guarantee|nothing is guaranteed/i);
  });
});
