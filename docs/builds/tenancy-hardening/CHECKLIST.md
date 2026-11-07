# CHECKLIST: tenancy-hardening
STATUS: OPEN (built, awaiting independent verification)

## Findings
- [x] F1 profiles.household_id guard (UPDATE raises 42501, INSERT neutralised); owner-update policy dropped
- [x] F2 user_roles: client write policies dropped, INSERT/UPDATE/DELETE revoked; membership only via RPCs
- [x] F3 invitations bound to verified auth.users email (auth_verified_email); invitee SELECT policy rewritten, UPDATE policy dropped
- [x] F4 helpers answer only for auth.uid() or service_role; anon EXECUTE revoked
- [x] F5 unique index on stripe_customer_id, skipped with a NOTICE when duplicates exist
- [x] F6 create_household revoked from public/anon; invitee can no longer rewrite invitations.household_id
- [~] PARKED: deferred by design (low; follow-up slice). F7 DEFERRED by design (member-visible billing/admin profile columns; needs view + hook changes)
- [x] F8 households SELECT/UPDATE policies TO authenticated

## Build
- [x] Migration, RPCs (accept_invitation, switch_active_household, set_member_role, remove_member, auth_verified_email)
- [x] Frontend wrapper + legacy fallback (only on PGRST202 / 42883 / 404 / "Could not find the function", memoised per session)
- [x] Tests: 66 added (40 pglite, 26 frontend)
- [x] Independent verification: verifier PASS, security gate PASS, RLS audits (user_roles, invitations, profiles) reviewed; fix cycle 1 queued (truncate revoke, drift guard, runbook)
- [ ] Verifier re-check of fix cycle 1 delta, then PR, merge, deploy confirm
- [~] PARKED: Needs Jay (production step, no approved RELEASE.md). Jay-run production apply (runbook in ARCHITECTURE.md section 11)

## Needs Jay (MANDATORY pre-apply read-only checks; full queries in ARCHITECTURE.md section 11)
- [ ] T1 forged-membership review (user_roles with household, email, role, created_at, accepted-invite flag; profiles whose household has no accepted invitation and are not the earliest owner). Delete suspect rows in the SQL editor BEFORE applying, otherwise the backfill legitimises forged pointers.
- [ ] T2 run Q1 and compare policy names exactly (the migration's drift guard also fails loudly and rolls back).
- [ ] T3 Supabase Auth, Providers, Email: "Confirm email" must be ON.
- [ ] T6 run Q8 duplicates check; after apply confirm `profiles_stripe_customer_id_key` exists.

## Engineer notes (conservative choices)
- Migration version is 20261111000000 (override of the design's 20261110000000, taken by desk_hardening). ARCHITECTURE.md updated.
- Fixture runs the REAL migration files whole (0000, 0005, 0006, 0007, the 0523 section-7 policy-rewrite DO block extracted by regex, SEC, TEN) rather than extracting single statements; nothing is retyped. Only bootstrap (roles, auth schema, profile columns) is hand-written.
- Error codes: not_a_member / not_owner = 42501, last_owner / invitation_unavailable = P0001, unauthenticated = 28000.
- set_member_role on a non-member target raises not_a_member (no row creation; joining is only via invitation).
- remove_member by a non-owner for another user raises not_owner even when the target row is absent (no existence oracle).
- Dead functions setProfileHousehold and upsertOwnerRole deleted (no callers; would always fail after the migration). This is also why tsc dropped 614 -> 611.
- HouseholdSettings role/remove handlers had no error handling; added try/catch + toast so last_owner/not_owner refusals are visible. No other UI change.
- Legacy fallback functions keep today's code (renamed *Legacy). Cleanup PR to delete them once production confirms the migration.
- Not implemented from the design text: automatic client retry with backoff on network errors (section 8); not required by the slice brief.
- types.ts not touched; RPCs are called through the cast wrapper.

## Later
- send-household-invite authorises against a nonexistent `household_members` table (likely 403 always); pre-existing, deliberately NOT fixed here.
- F7: replace member-visible profile SELECT with a `household_member_profiles` security_invoker view; update useHouseholdFinancialData / useSubscription / Admin.
- fetchHouseholdMembers lists members by active pointer only; invitations never expire (no expires_at). Delete legacy fallback branch after production migration.
- Split the owner FOR ALL invitations policy and add an invited_by = auth.uid() check.
- Make stripe_customer_id linking service-role only.
- Add a profiles.email guard/sync against auth.users.
- F7 column privileges (see above).
- Delete the *Legacy fallbacks in household-queries.ts after the production apply.
- Fix send-household-invite (checks a nonexistent household_members table).

## Fix cycle 1 (hardening)
- Migration: revoke truncate/references/trigger on user_roles, invitations, profiles, households from public/anon/authenticated; S10 drift guard raises and rolls back on drifted policies.
