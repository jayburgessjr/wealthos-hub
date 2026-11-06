# Desk build checklist
STATUS: OPEN

- [x] Architect: ARCHITECTURE.md (schema, interfaces, ADRs)
- [x] Migration: 11 tables + RLS owner-only + order-requires-approval trigger
- [x] Risk engine (pure TS) + unit tests per rule
- [x] Broker port + paper adapter (+ Alpaca adapter behind same port)
- [x] approve-order edge fn (only broker caller)
- [x] Scanner agents (6) + research agent (no broker access)
- [x] Scorecard (1/5/20d vs SPY)
- [x] Terminal UI + approval queue at /desk
- [x] Proofs: no-stop rejected; agent cannot order; seeded e2e scorecard populates
- [ ] Gates: lint, tsc, vitest, build; verifier; security; QA; code review
- [ ] PR merged; smoke check

## Needs Jay
## Later
