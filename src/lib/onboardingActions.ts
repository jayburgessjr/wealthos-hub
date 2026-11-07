import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ONBOARDING_DESTINATION,
  saveAnswers,
  type OnboardingAnswers,
  type Risk,
} from "@/lib/onboardingProfile";

const COMPOUND_RISK: Record<Risk, string> = {
  cautious: "conservative",
  balanced: "moderate",
  growth: "aggressive",
};

/**
 * Save the answers and mark onboarding done. Only existing columns are written:
 * profiles.onboarding_completed and compound_settings (capital, monthly, risk).
 * Everything else lives in the typed localStorage fallback.
 * Returns the route to navigate to.
 */
export async function finishOnboarding(
  client: SupabaseClient,
  userId: string,
  answers: OnboardingAnswers,
): Promise<string> {
  saveAnswers(userId, answers);

  const { error: profileErr } = await client
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);
  if (profileErr) throw profileErr;

  const { error: compoundErr } = await client.from("compound_settings").upsert(
    {
      user_id: userId,
      starting_capital: answers.startingAmount,
      monthly_contribution: answers.monthlyAmount,
      risk_tier: COMPOUND_RISK[answers.risk],
      reinvestment_pct: 100,
    },
    { onConflict: "user_id" },
  );
  if (compoundErr) throw compoundErr;

  return ONBOARDING_DESTINATION;
}

/** Skip still marks onboarding complete so the user is not sent back. */
export async function skipOnboarding(client: SupabaseClient, userId: string): Promise<string> {
  const { error } = await client
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);
  if (error) throw error;
  return ONBOARDING_DESTINATION;
}
