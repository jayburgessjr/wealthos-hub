# CHECKLIST: AI Coach

STATUS: BUILT (awaiting independent verification)

- [x] Migration 20261112000000_ai_coach.sql (4 tables, RLS, invoker RPCs, edit trigger), pglite tests
- [x] `_shared/strategy` validate/stream/context/prompt + `ModeDef.run` + coach mode + handler dispatch
- [x] Existing prompts rewritten (beginner-safe), `pro` addendum, prompt-lint test
- [x] Income pillar: `income` section, `earn` track, `earnTrack.ts`, optional props on WealthLadder/NextBestMove
- [x] Frontend: coachDb wrapper, hooks, Coach page (Chat / My plan), Wealth strategy section, panel blocks, Home entry, `/coach` alias
- [x] streamInvoke `onEvent` (+ replayed JSON as non-error)
- [ ] Household AI repoint (separate later PR, not in this branch)
- [ ] Verifier / security gate (not done by the engineer)
- [ ] Apply migration, regenerate `types.ts`, delete `coachDb.ts`/`coachTypes.ts` hand types (post-merge, needs Jay for production)

## Engineer notes (conservative choices and deviations)

1. Strict tool schema: OpenAI `strict:true` requires every property listed and optional ones nullable, and forbids free-form objects. So `STRATEGY_UPDATE_JSON_SCHEMA` lists metrics as five fixed nullable keys (amount, target_pct, monthly_gain_estimate, effort, time_to_first_dollar). The validator treats null as absent and still accepts other safe metric keys (max 8).
2. Deny-list: negated mentions ("not guaranteed", "never risk-free") are allowed so honest disclaimers do not reject a whole plan. Affirmative guaranteed/risk-free/can't lose/double your money are rejected. Metric keys `expected_return*`, `target_price`, `entry_price`, `stop_price`, `ticker`, `price_target` rejected. The coach prompt also tells the model not to use those words in plan fields.
3. `coach_begin_turn` rate limit applies to new messages only. A `retry` (same client_msg_id, no reply yet) is allowed without the per-minute check; it is still bounded by the shared daily `consume_usage` cap that runs first.
4. `apply_strategy_update` also enforces completeness (goal plus horizon or risk) in SQL, in addition to the TS check, as defense in depth. `status` is derived inside the RPC, never accepted from input. AI `remove_keys` deletes unedited AI rows; edited or user rows count as skipped.
5. `resolve_strategy_proposal` also accepts kind `summary` (p_id = user_strategy.id) for `summary_proposal`.
6. `onboarding_hints_used` is set by a best-effort upsert from `coach.ts` (user JWT) when hints were used; hints are only injected while it is false.
7. A tool-only turn with no prose saves the reply "I updated your plan." so history never lacks the turn.
8. `consume_usage` is not loaded into the coach pglite harness (its behavior is covered by `src/test/edge/usage-db.test.ts` and by the handler test asserting one call before `coach_begin_turn`). Daily-cap behavior in the handler is tested with the fake RPC.
9. Legacy test `handlers.test.ts` pinned the old text "personal hedge fund AI analyst"; updated to "personal investing analyst" (prompt rewrite required by the design). No other legacy test changed.
10. `ValidChat` gained `pro: boolean`; `buildSystemPrompt(mode, ctx, pro=false)`. Client `pro` wiring from the simple/pro nav preference is NOT added to the legacy chat pages (they keep the default simple framing); only the server support and tests exist.
11. Panels (`WealthPanel`, `InvestPanel`) take an optional `strategy` prop (presentational `StrategyBlock`) so their existing tests and callers are unchanged; HomeDashboard always supplies it, giving the empty state "Start with the coach".
12. `EarnInput.earnActions` has an extra optional `monthlyGain` (additive) so done actions can sum the linked idea's illustrative estimate.
13. FinancialAdvisor no longer loads the portfolio or sends client context (server owns context). The `financial-advisor` mode remains in the registry, unused by the page.
14. Root `ARCHITECTURE.md` does not exist, so no root doc update.
15. `toast` for plan updated uses sonner `toast.success("Plan updated")`.

## Later (max 3)
- Revision history is not stored (only `version`).
- Wire `pro: true` from the simple/pro preference in the legacy AI chat pages.
- Regenerate `types.ts` and remove the hand-written wrapper.
