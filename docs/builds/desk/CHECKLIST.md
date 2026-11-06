# Desk build checklist
STATUS: CLOSED
RESULT: INCOMPLETE

- [x] Architect: ARCHITECTURE.md (schema, interfaces, ADRs)
- [x] Migration: 11 tables + RLS owner-only + order-requires-approval trigger
- [x] Risk engine (pure TS) + unit tests per rule
- [x] Broker port + paper adapter (+ Alpaca adapter behind same port)
- [x] approve-order edge fn (only broker caller)
- [x] Scanner agents (6) + research agent (no broker access)
- [x] Scorecard (1/5/20d vs SPY)
- [x] Terminal UI + approval queue at /desk
- [x] Proofs: no-stop rejected; agent cannot order; seeded e2e scorecard populates
- [x] Deterministic gates: eslint (desk files clean), tsc (no desk errors), vitest 174/174, build green
- [~] PARKED: independent security, QA and code-review gates were dispatched but had not reported when the run's continuation limit hit; their findings are unread and unfixed
- [~] PARKED: PR, merge and smoke check not done; they depend on the unread review findings and on production backend deploy (migration, functions, secrets), which needs Jay

## Needs Jay
- Read the three reviewer reports (security, QA, code review) for the desk branch, then let a fresh run fix blocking findings, open the PR and merge.
- Production backend (Hard Stop, secrets and prod migration): apply migration, set ANTHROPIC_API_KEY / DESK_OWNER_EMAIL / DESK_CRON_SECRET, deploy the 7 desk-* functions per RUNBOOK.md.
## Later
