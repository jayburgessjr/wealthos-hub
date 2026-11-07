# Desk build checklist
STATUS: CLOSED
RESULT: COMPLETE (original build) plus HARDENING pass (audit B1-B11, see Hardening notes)

- [x] Architect: ARCHITECTURE.md (schema, interfaces, ADRs)
- [x] Migration: 13 tables + RLS owner-only + order-requires-approval trigger
- [x] Risk engine (pure TS) + unit tests per rule
- [x] Broker port + paper adapter (+ Alpaca adapter behind same port, execution gated off)
- [x] approve-order edge fn (only trade-capable broker caller)
- [x] Scanner agents (6) + research agent (no broker access)
- [x] Scorecard (1/5/20d vs SPY)
- [x] Terminal UI + approval queue at /desk
- [x] Proofs: no-stop rejected; agent cannot order; seeded e2e scorecard populates
- [x] Independent gates on the original build: security (fail, fixed, re-run PASS), QA (7 defects, all fixed), code review (8 blocking, all fixed or gated), verifier PASS 5/5

## Review findings: current truth
All blocking findings from the original security, QA and code reviews (SEC-B1, CR-B1 to CR-B8, QA-D1 to QA-D14) were fixed or gated before the original build closed; the earlier version of this file left them listed as open after the fix, which was stale. The items below are the ones that were deliberately left open and are now handled by the hardening pass or recorded under Later.

## Hardening notes (audit B1-B11)
Migration: `supabase/migrations/20261110000000_desk_hardening.sql` (additive; the two earlier migrations are untouched and treated as applied in production). Not applied to any remote project by this pass.

| # | Status | What changed | Conservative choice |
|---|---|---|---|
| B1 | fixed | `desk_approvals_guard` needs a fresh service-written `check_passed` marker bound to the input hash and proposal economics. | The marker is a risk event (no API role can write them), so no new table or secret. Approve flow writes it before inserting the approval. |
| B2 | fixed | Idempotent retry with the same approval inside 4.5 min; otherwise released to `failed` with an audited `proposal_released` event. | No revert to `pending`: approvals are immutable and unique per proposal, and loosening that would weaken the approval invariant. |
| B3 | fixed | Dated quotes; stale, undated or future quotes refuse opens, warn on closes; UI stale tag and Approve block for opens. | Limits 4 calendar days (stock), 2 (crypto). A bare-number quote counts as undated and fails closed. Options price from legs, not quotes, so are not covered. |
| B4 | fixed | SQL requires a non-empty note, halted state, logs prior HWM, reset_by, prior halt reason; edge fn maps errors. | SQL minimum is non-empty (the edge function and UI keep the 10 character minimum); note capped at 500. |
| B5 | fixed | Option positions marked from Polygon option daily bars; premium-stop breach writes a pending close proposal only. | Stops are premium stops (as stored). Stale or missing leg prices leave the option unmarked and counted, never guessed. Stock/crypto paper stop enforcement is unchanged (proposals only). Needs an options-enabled Polygon plan. |
| B6 | fixed | `executed` only on a real fill; `pendingFill` result; new `settle.ts`, `reconcile.ts`, `desk-reconcile-orders` (cron, read-only); real `AlpacaReader.getOrder`. | Alpaca execution stays OFF behind `ALPACA_EXECUTION_ENABLED`. A partial close fill is not auto-applied; it is flagged for manual review. |
| B7 | fixed | `requireOwner` re-checks the allowlist every call; claim returns `reason` (not_allowlisted, email_unconfirmed, allowlist_empty, no_email, owner_cap_reached). | Empty allowlist locks everyone out. RLS read access of a removed owner ends only when the `desk_owner` row is deleted by hand (documented). |
| B8 | fixed | `desk_journal.author_user_id` and `last_edited_by` (trigger-set, author immutable); reset event records `reset_by`. | Recorded, not restricted: either owner may still edit notes or reset (no four-eyes rule), as the audit asked for a record. |
| B9 | fixed | Thesis text and catalyst caps (reject over cap), target within 50% of entry, escaped prompt attributes, http(s)-only bounded URLs, schema maxLength. | Over-cap output is rejected rather than truncated. |
| B10 | fixed | CHECKLIST truth, OPENAI_API_KEY, multi-owner headers, RUNBOOK (migrations, ALPACA_EXECUTION_ENABLED, reconcile cron, allowlist behaviour, Navbar note). | Navbar edit (`src/components/layout/Navbar.tsx`) documented, not touched. |
| B11 | fixed | `boundary.test.ts` builds the transitive import graph (with self-tests) and checks agents, read-only functions and the only importers of factory, Alpaca adapter and approve flow. | `resolveMode` moved to `_shared/desk/mode.ts` (re-exported from factory) so read-only code no longer reaches the broker factory. |

Other deliberate notes:
- Migration widens the `desk_risk_events.event_type` CHECK (drop and re-add of that one constraint) to allow `proposal_released`, `order_reconciled`, `order_reconcile_failed`, `stale_quote`, `option_stop_breach`. It only adds allowed values; the table stays append-only. Deploy functions after the migration.
- No tier, subscription or plan logic was added; Desk stays owner-only (allowlisted emails) and paper-only.

## Needs Jay
- Production backend (Hard Stop: prod migration, secrets, deploys): apply the three migrations in order, confirm `OPENAI_API_KEY` / `DESK_OWNER_EMAIL` / `DESK_CRON_SECRET`, deploy the 8 desk-* functions, schedule `desk-reconcile` per RUNBOOK.md.

## Later (max 3)
- Real-time quotes before live trading is ever enabled (daily bars only today).
- Four-eyes approval for kill-switch resets if the second owner is ever someone other than a trusted partner.
- Auto-revoke `desk_owner` rows when an email leaves the allowlist (today a manual SQL step).
