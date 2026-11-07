# Beginner front door (slice UX, findings C1-C14)

## Objective
Make the app feel like a wealth-building platform for anyone, starting with $1 or $0, with trader tools secondary ("Pro mode"). Private friends-and-family app: no tiers, no plans, no upsell.

## What was built
- `src/lib/wealthLadder.ts` (pure): 7 stages (first dollar, starter fund $500, emergency fund 3 months, debt and employer match, start investing, grow $10k, diversify). Output: stage, progress 0-1, one next best move (title, why, link).
- `src/lib/onboardingProfile.ts`, `onboardingActions.ts`: beginner-first answers, validation, finish/skip (both go to `/home`; skip sets `onboarding_completed`).
- `src/lib/navMode.ts` + `components/layout/simpleNav.ts`: simple (default for new/some/no data) vs pro (experienced); toggle persists in localStorage (try/catch).
- Home: `WealthLadder`, `NextBestMove`, `StarterChecklist` at top of `HomeDashboard`; no household wall; net worth = cash minus debts; placeholder tiles removed.
- Learn page `/learn` (5 static lessons + disclaimer).
- Landing rewritten (hero, pillars, how it works, what you get, private block, FAQ). PricingSection and SocialProof quotes removed from the page.
- Demo works for logged-out visitors: `ProtectedRoute` honors `isDemoMode`; Home shows fixed sample numbers, writes nothing.
- `SubscriptionGate` always renders children (API kept). Settings subscription/upgrade card replaced by an "Access" card.
- Mobile: Sheet drawer from Navbar hamburger below lg (reuses `SidebarNavList`); RightBar `hidden lg:flex`.
- RightBar relabelled "Quick guide", canned answers shown instantly, no typing simulation, no free-text input, pointer to AI coach.
- A11y: >= 12px text in touched files, higher-contrast nav, icons/text for status in HeroBar and InvestPanel, aria-labels on icon buttons, labels with htmlFor in Login/Signup/Onboarding.

## Persistence decision
`profiles` has only `onboarding_completed` (types.ts). Answers are kept in typed localStorage (`bwh_onboarding_v1_<userId>`); money facts also go to the existing `compound_settings` (starting_capital, monthly_contribution, risk_tier). No schema or migrations.

## Not touched
supabase/, edge functions, Stripe/billing files, desk files, `useSubscription` hook, PricingSection.tsx (now unused).
