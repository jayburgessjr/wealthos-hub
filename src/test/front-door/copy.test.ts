import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Copy files changed in this slice must not contain em dashes (U+2014) outside comments.
const FILES = [
  "src/pages/Index.tsx",
  "src/pages/Onboarding.tsx",
  "src/pages/Learn.tsx",
  "src/pages/HomeDashboard.tsx",
  "src/pages/Login.tsx",
  "src/pages/Signup.tsx",
  "src/pages/Settings.tsx",
  "src/components/DemoBanner.tsx",
  "src/components/SubscriptionGate.tsx",
  "src/components/landing/LandingHero.tsx",
  "src/components/landing/LandingNavbar.tsx",
  "src/components/landing/ThreePillars.tsx",
  "src/components/landing/HowItWorks.tsx",
  "src/components/landing/SocialProof.tsx",
  "src/components/landing/PrivateAccess.tsx",
  "src/components/landing/FAQ.tsx",
  "src/components/home/HeroBar.tsx",
  "src/components/home/InvestPanel.tsx",
  "src/components/home/WealthPanel.tsx",
  "src/components/home/HouseholdPanel.tsx",
  "src/components/home/WealthLadder.tsx",
  "src/components/home/NextBestMove.tsx",
  "src/components/home/StarterChecklist.tsx",
  "src/components/layout/RightBar.tsx",
  "src/components/layout/simpleNav.ts",
  "src/lib/wealthLadder.ts",
  "src/lib/onboardingProfile.ts",
];

const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/(^|\s)\/\/.*$/, ""))
    .join("\n");

describe("copy rules", () => {
  it.each(FILES)("%s has no em dash", (f) => {
    const src = stripComments(readFileSync(resolve(process.cwd(), f), "utf8"));
    expect(src.includes("—")).toBe(false);
  });

  it("landing copy does not mention plans, prices or upgrades", () => {
    const landing = FILES.filter((f) => f.includes("landing/") || f.endsWith("Index.tsx"))
      .map((f) => readFileSync(resolve(process.cwd(), f), "utf8"))
      .join("\n");
    expect(landing).not.toMatch(/\bElite\b|\bFree tier\b|\bPricing\b|\/mo\b|Upgrade|hedge fund/i);
  });
});
