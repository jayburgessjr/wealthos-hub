import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  EMPTY_DRAFT,
  ONBOARDING_DESTINATION,
  canAdvance,
  loadAnswers,
  parseAmount,
  toAnswers,
  visibleSteps,
  type Draft,
} from "@/lib/onboardingProfile";
import { finishOnboarding, skipOnboarding } from "@/lib/onboardingActions";

const full: Draft = {
  goal: "pay_debt",
  experience: "new",
  startingAmount: "1",
  monthlyAmount: "",
  emergencyFund: "no",
  highInterestDebt: "yes",
  risk: "cautious",
  assetInterests: ["Crypto"],
};

beforeEach(() => localStorage.clear());

describe("onboarding flow logic", () => {
  it("has no preset money amounts", () => {
    expect(EMPTY_DRAFT.startingAmount).toBe("");
    expect(EMPTY_DRAFT.monthlyAmount).toBe("");
  });

  it("asset step is hidden for new users and shown otherwise", () => {
    expect(visibleSteps({ ...full, experience: "new" })).not.toContain("assets");
    expect(visibleSteps({ ...full, experience: "" })).not.toContain("assets");
    expect(visibleSteps({ ...full, experience: "some" })).toContain("assets");
    expect(visibleSteps({ ...full, experience: "experienced" })).toContain("assets");
  });

  it("parseAmount accepts 0, $1, blank and rejects negatives and junk", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("1")).toBe(1);
    expect(parseAmount("$1,250.50")).toBe(1250.5);
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("amount step allows $0 and blank monthly", () => {
    expect(canAdvance("amounts", { ...full, startingAmount: "0" })).toBe(true);
    expect(canAdvance("amounts", { ...full, startingAmount: "", monthlyAmount: "" })).toBe(true);
    expect(canAdvance("amounts", { ...full, startingAmount: "-1" })).toBe(false);
  });

  it("each step requires its answer", () => {
    expect(canAdvance("goal", EMPTY_DRAFT)).toBe(false);
    expect(canAdvance("experience", EMPTY_DRAFT)).toBe(false);
    expect(canAdvance("checks", { ...EMPTY_DRAFT, emergencyFund: "yes" })).toBe(false);
    expect(canAdvance("checks", { ...EMPTY_DRAFT, emergencyFund: "yes", highInterestDebt: "no" })).toBe(true);
    expect(canAdvance("risk", EMPTY_DRAFT)).toBe(false);
  });

  it("toAnswers drops asset interests for new users", () => {
    expect(toAnswers(full)?.assetInterests).toEqual([]);
    expect(toAnswers({ ...full, experience: "some" })?.assetInterests).toEqual(["Crypto"]);
    expect(toAnswers(EMPTY_DRAFT)).toBeNull();
  });

  it("round-trips through the typed localStorage fallback and rejects bad data", () => {
    const ans = toAnswers(full)!;
    localStorage.setItem("bwh_onboarding_v1_u1", JSON.stringify(ans));
    expect(loadAnswers("u1")).toEqual(ans);
    localStorage.setItem("bwh_onboarding_v1_u2", "{not json");
    expect(loadAnswers("u2")).toBeNull();
    localStorage.setItem("bwh_onboarding_v1_u3", JSON.stringify({ goal: "lottery" }));
    expect(loadAnswers("u3")).toBeNull();
    expect(loadAnswers(undefined)).toBeNull();
  });
});

function fakeClient() {
  const calls: { table: string; op: string; payload: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      update: (payload: unknown) => {
        calls.push({ table, op: "update", payload });
        return { eq: async () => ({ error: null }) };
      },
      upsert: async (payload: unknown) => {
        calls.push({ table, op: "upsert", payload });
        return { error: null };
      },
    }),
  };
  return { client: client as never, calls };
}

describe("onboarding finish and skip", () => {
  it("finish writes only existing columns and goes to /home", async () => {
    const { client, calls } = fakeClient();
    const to = await finishOnboarding(client, "u1", toAnswers(full)!);
    expect(to).toBe("/home");
    expect(ONBOARDING_DESTINATION).toBe("/home");
    const profile = calls.find((c) => c.table === "profiles")!;
    expect(profile.payload).toEqual({ onboarding_completed: true });
    const compound = calls.find((c) => c.table === "compound_settings")!.payload as Record<string, unknown>;
    expect(compound.starting_capital).toBe(1);
    expect(compound.monthly_contribution).toBe(0);
    expect(compound.risk_tier).toBe("conservative");
    expect(loadAnswers("u1")?.goal).toBe("pay_debt");
  });

  it("skip sets onboarding_completed and goes to /home", async () => {
    const { client, calls } = fakeClient();
    const to = await skipOnboarding(client, "u1");
    expect(to).toBe("/home");
    expect(calls).toEqual([{ table: "profiles", op: "update", payload: { onboarding_completed: true } }]);
  });

  it("finish surfaces a database error", async () => {
    const client = {
      from: () => ({ update: () => ({ eq: async () => ({ error: new Error("nope") }) }) }),
    };
    await expect(finishOnboarding(client as never, "u1", toAnswers(full)!)).rejects.toThrow("nope");
  });
});

void vi;
