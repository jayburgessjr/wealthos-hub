// Beginner-first onboarding answers: types, validation, destination, storage.
//
// The `profiles` table only has `onboarding_completed` (see
// src/integrations/supabase/types.ts), so the answers live in a typed
// localStorage fallback keyed by user id. The money facts are also written to
// the existing `compound_settings` table by the Onboarding page.

export type Goal =
  | "starter_fund"
  | "emergency_fund"
  | "pay_debt"
  | "start_investing"
  | "retire"
  | "grow_wealth";
export type Experience = "new" | "some" | "experienced";
export type Risk = "cautious" | "balanced" | "growth";
export type YesNo = "yes" | "no";

export interface OnboardingAnswers {
  goal: Goal;
  experience: Experience;
  /** Dollars on hand to start with. 0 is valid. */
  startingAmount: number;
  /** Optional dollars per month. 0 means not set. */
  monthlyAmount: number;
  hasEmergencyFund: boolean;
  hasHighInterestDebt: boolean;
  risk: Risk;
  /** Only asked when experience is not "new". */
  assetInterests: string[];
}

export const GOALS: { id: Goal; label: string; desc: string }[] = [
  { id: "starter_fund", label: "Build a starter fund", desc: "Put your first few hundred dollars aside." },
  { id: "emergency_fund", label: "Build an emergency fund", desc: "Cover about three months of basic costs." },
  { id: "pay_debt", label: "Pay down debt", desc: "Clear balances that cost you interest." },
  { id: "start_investing", label: "Start investing", desc: "Learn the basics and take a first step." },
  { id: "retire", label: "Save for retirement", desc: "Plan for the long road ahead." },
  { id: "grow_wealth", label: "Grow my wealth", desc: "Build on what I already have." },
];

export const EXPERIENCES: { id: Experience; label: string; desc: string }[] = [
  { id: "new", label: "I am new to this", desc: "Plain words, small steps." },
  { id: "some", label: "I know some of it", desc: "I have saved or invested a little." },
  { id: "experienced", label: "I am experienced", desc: "Show me the full toolset." },
];

export const RISKS: { id: Risk; label: string; desc: string }[] = [
  { id: "cautious", label: "Cautious", desc: "I would rather keep my money steady, even if it grows slowly." },
  { id: "balanced", label: "Balanced", desc: "I can accept some ups and downs for steadier growth." },
  { id: "growth", label: "Growth", desc: "I can handle big swings for the chance of more growth over many years." },
];

export const ASSET_INTERESTS = [
  "Stocks and funds",
  "Bonds",
  "Real estate",
  "Crypto",
  "Commodities",
  "Options",
] as const;

export const ONBOARDING_STEPS = [
  { id: "goal", title: "Your goal" },
  { id: "experience", title: "Experience" },
  { id: "amounts", title: "Your money" },
  { id: "checks", title: "Quick checks" },
  { id: "risk", title: "Comfort with risk" },
  { id: "assets", title: "Interests" },
  { id: "done", title: "Done" },
] as const;

export type StepId = (typeof ONBOARDING_STEPS)[number]["id"];

export interface Draft {
  goal: Goal | "";
  experience: Experience | "";
  /** Raw text from the input; empty is allowed (treated as 0). */
  startingAmount: string;
  monthlyAmount: string;
  emergencyFund: YesNo | "";
  highInterestDebt: YesNo | "";
  risk: Risk | "";
  assetInterests: string[];
}

export const EMPTY_DRAFT: Draft = {
  goal: "",
  experience: "",
  startingAmount: "",
  monthlyAmount: "",
  emergencyFund: "",
  highInterestDebt: "",
  risk: "",
  assetInterests: [],
};

/** Steps shown for a draft. The asset step is hidden unless experience is not "new". */
export function visibleSteps(draft: Draft): StepId[] {
  const ids = ONBOARDING_STEPS.map((s) => s.id) as StepId[];
  return draft.experience === "new" || draft.experience === ""
    ? ids.filter((id) => id !== "assets")
    : ids;
}

/** Parse a money input. Blank is 0; negative or non-numeric is invalid (null). */
export function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/[$,]/g, "");
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function canAdvance(step: StepId, draft: Draft): boolean {
  switch (step) {
    case "goal":
      return draft.goal !== "";
    case "experience":
      return draft.experience !== "";
    case "amounts":
      return parseAmount(draft.startingAmount) !== null && parseAmount(draft.monthlyAmount) !== null;
    case "checks":
      return draft.emergencyFund !== "" && draft.highInterestDebt !== "";
    case "risk":
      return draft.risk !== "";
    default:
      return true;
  }
}

export function toAnswers(draft: Draft): OnboardingAnswers | null {
  const start = parseAmount(draft.startingAmount);
  const monthly = parseAmount(draft.monthlyAmount);
  if (
    draft.goal === "" ||
    draft.experience === "" ||
    draft.risk === "" ||
    draft.emergencyFund === "" ||
    draft.highInterestDebt === "" ||
    start === null ||
    monthly === null
  ) {
    return null;
  }
  return {
    goal: draft.goal,
    experience: draft.experience,
    startingAmount: start,
    monthlyAmount: monthly,
    hasEmergencyFund: draft.emergencyFund === "yes",
    hasHighInterestDebt: draft.highInterestDebt === "yes",
    risk: draft.risk,
    assetInterests: draft.experience === "new" ? [] : draft.assetInterests,
  };
}

/** Both Finish and Skip land here. */
export const ONBOARDING_DESTINATION = "/home";

// ── Typed localStorage fallback ─────────────────────────────────────────────

const key = (userId: string) => `bwh_onboarding_v1_${userId}`;

export function saveAnswers(userId: string, answers: OnboardingAnswers): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(answers));
  } catch {
    // storage unavailable; the app still works with defaults
  }
}

const isOneOf = <T extends string>(list: readonly { id: T }[], v: unknown): v is T =>
  typeof v === "string" && list.some((x) => x.id === v);

export function loadAnswers(userId: string | undefined): OnboardingAnswers | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!isOneOf(GOALS, o.goal) || !isOneOf(EXPERIENCES, o.experience) || !isOneOf(RISKS, o.risk)) {
      return null;
    }
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    return {
      goal: o.goal,
      experience: o.experience,
      startingAmount: num(o.startingAmount),
      monthlyAmount: num(o.monthlyAmount),
      hasEmergencyFund: o.hasEmergencyFund === true,
      hasHighInterestDebt: o.hasHighInterestDebt === true,
      risk: o.risk,
      assetInterests: Array.isArray(o.assetInterests)
        ? o.assetInterests.filter((x): x is string => typeof x === "string")
        : [],
    };
  } catch {
    return null;
  }
}
