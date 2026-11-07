# Checklist: beginner front door

STATUS: BUILT (awaiting independent verification and Lead integration)

## Scope changes from the Lead (override of the original brief)
- No tiers: every user has access to everything; invite-only friends-and-family app.
- PricingSection removed from the landing page; no plan, Free/Pro/Elite, price or upgrade copy anywhere in landing, Settings or the gate.
- SubscriptionGate is now non-blocking for everyone (children always rendered; `tier` prop kept for compatibility). Test added.
- Landing, hero, FAQ and CTAs are framed as private (sign in is the main action). `/signup` route kept and still linked from Login only.

## Findings
- [x] C1 landing copy
- [x] C2 pricing (superseded by the no-tiers correction: removed, not rewritten)
- [x] C3 demo
- [x] C4 onboarding
- [x] C5 home
- [x] C6 /invs/dashboard unchanged, no longer default landing
- [x] C7 navigation (simple/pro)
- [x] C8 RightBar honesty
- [x] C9 fake search removed; orphans listed below
- [x] C10 mobile drawer, RightBar hidden below lg
- [x] C11 text size, contrast, non-color cues, aria-labels (touched files only)
- [x] C12 keyboard cards, htmlFor
- [x] C13 ladder, next move, lessons (round-ups, fractional purchase and income tools not built; out of scope)
- [~] C14 not in scope of the brief (CSV template sample goal, stale comments) left as is

## Later (max 3)
- Orphaned pages not routed/imported: NetWorth, DebtManager, CashFlowPlanner, HouseholdCreditScores (redirects away). Not deleted.
- Unused landing components kept on disk: PricingSection, BentoGrid, AssetClasses, Marquee (fake tickers). Delete in a cleanup pass.
- Replace the localStorage onboarding fallback with profile columns when a schema slice allows; `useSubscription` still reports free/pro and can be simplified.
