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

## Open review findings (security + code review; QA report not yet received)
Blocking, fix before PR:
- SEC-B1: close-order path skips side/symbol/structure checks and halt (engine.ts close branch; migration proposals guard). Require sell on same symbol+structure; DB guard must match an open position.
- CR-B1: UI preview blocks Approve on halt for closes (preview.ts:95); use `halted && intent==='open'`.
- CR-B2: `select("*")` and unbounded queries in src/lib/desk/hooks.ts.
- CR-B3: pnlClass uses green/red (format.ts:57); brand is single orange accent.
- CR-B4: useClaimOwner toasts success on `owner:false` (hooks.ts:21-31).
- CR-B5: mark.ts treats option positions as stocks and can abort the job; skip non-linear structures.
- CR-B6/B7/B8: Alpaca adapter (close orders with bracket stop, crypto needs stop_limit, options day TIF, async fills with no reconciler). Gate PAPER_VENUE=alpaca and live until fixed; internal paper broker is unaffected.
Should fix: S1 day P&L when day_start_equity is 0; S2 reset note length 10 in UI; S3 order result type casing; S4 Alpaca status map; S5 scorejob skips options; S6 realized pnl for options; S7 option preview refPrice; S8 stop on duplicate client id; N1 Polygon key out of URL/logs.

## QA report (adversarial, 229 tests added under src/test/desk-qa/; 7 deliberately red = blocking defects)
- QA-D1/D2 (= SEC-B1): close-intent BUY approved; close for a symbol that does not match the referenced position approved.
- QA-D5: option close proposals cannot be approved (no refPrice on closes; paper keys option fills by clientOrderId so closes never net).
- QA-D6: PaperBroker slippage applied upward on SELLs (fills above quote); sell limit uses min where it needs max. Inflates paper P&L.
- QA-D9: scorejob scores option trades (premium vs underlying close) as about +5200%; rows are immutable. Skip option structures.
- QA-D14: service_role can TRUNCATE desk_risk_events, desk_state (clears the kill switch) and desk_scorecard. Revoke truncate or add BEFORE TRUNCATE triggers.
- Non-blocking: fractional option contracts, limit order without limit price, horizon_days cap, `</signal>` delimiter injection, future decided_at, client_order_id not forced to approval_id, 'NaN' accepted by Postgres for stop/qty, no reconciler for orders stuck 'submitting'.
- Passed: engine boundaries (1.5%, 25%, 3 options, 3%, 10%), no-stop rejection everywhere, agent cannot place an order, replay/reuse/GUC spoofing blocked, existing WealthOS unchanged.
- Not tested: browser click-through, real Supabase RLS, live Alpaca, Deno HTTP auth paths.
