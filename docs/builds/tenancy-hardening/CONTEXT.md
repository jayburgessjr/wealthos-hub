# CONTEXT: tenancy-hardening (slice TEN)

Objective: close tenancy findings F1-F8 by making household membership server-controlled. Friends and family app, no tiers.
Design (frozen): ARCHITECTURE.md in this folder. Branch fix/tenancy-hardening (based on origin/main 6e03374, which has SEC and Desk).

## Scope (files)
- supabase/migrations/20261111000000_tenancy_hardening.sql (NOT 20261110000000: that version is the Desk migration)
- src/integrations/supabase/membership-rpc.ts (typed wrapper + legacy fallback), household-queries.ts (membership functions only),
  src/pages/household/AcceptInvitation.tsx and HouseholdSettings.tsx (error messages only)
- src/test/tenancy/{tenancy-harness.ts, tenancy-db.test.ts, membership-rpc.test.ts}

## Acceptance
- Cross-household negative test per finding F1-F4, F6, F8; positive flow; policy sweep; idempotence + backfill; fallback unit tests.
- Gates: vitest full (baseline 830), vite build, tsc (baseline 614 errors, zero new), eslint on touched files.

## Non-negotiables
No edits to desk files, stripe-webhook, AI prompts, types.ts. No commit/push/remote or production Supabase. Production apply is Jay-run
(order: frontend deploy, runbook Q1-Q9, SEC migration, TEN migration, smoke).

## Results (see CHECKLIST.md)
vitest 896 passed (830 baseline + 66 new); build OK; tsc 611 errors (baseline 614, none in touched/new files); eslint on touched files unchanged vs baseline (new files clean).
