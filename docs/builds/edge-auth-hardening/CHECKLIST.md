# CHECKLIST: edge-auth-hardening (slice SEC)

STATUS: OPEN (built, awaiting verifier + Security gate; nothing committed, pushed or deployed)

## Build
- [x] A1 real JWT verification (`auth.getUser`) + approved gate on ai-advisor, weekly-briefing, generate-signals, screen-assets, get-financial-news, get-market-data, get-ticker-context, get-congress-trades, get-earnings-calendar, get-price-data, stripe-checkout; anon key rejected (tests)
- [x] A2 check-alerts: user JWT or cron secret; service-role client only in cron mode; unset secret = deny; `verify_jwt=false` entry; trigger update guarded by `status='active'`
- [x] A3 server-built system prompt, role allowlist (user/assistant), mode allowlist (registry), whitelisted + clamped + delimited context, sanitized errors
- [x] A4 CORS: APP_URL allowlist (+ localhost dev), never `*`, never reflects unlisted origins
- [x] A5 stripe-checkout return URLs from APP_URL only; Origin ignored; optional safe `returnPath`; null-safe auth
- [x] A6 `ai_usage` + `consume_usage` / `record_usage_tokens`; caps in `limits.ts`; `max_tokens` on every OpenAI call; body caps; upstream timeouts; fail closed (503)
- [x] A7 search_path pins (11 functions) + households INSERT policy replaced
- [x] A8 audit query + negative control as tests
- [x] A9 profiles guard trigger + `access_approved` + one-time backfill
- [x] Frontend: streamInvoke 401/403/429 messages; callers grepped (see notes)
- [x] Tests: auth, validate, usage-db (pglite), handlers, static guard

## Needs Jay (production; the build executed none of this)
Follow ARCHITECTURE.md section 11 in order. Additions from this build:
- [ ] Confirm `APP_URL` is a SINGLE exact production origin (send-household-invite and stripe-checkout use the first entry for links; a comma list works for CORS only).
- [ ] After deploy, check-alerts returns 401 to any scheduler that does not send `x-cron-secret` (existing DESK_CRON_SECRET value).
- [ ] New signups are inert (403) until approved; approve friends with the SQL in CONTEXT.md. Recommended: also disable public signups in the Supabase dashboard.
- [ ] Apply migration BEFORE deploying functions (functions read `profiles.access_approved` and call the RPCs; without the migration every call fails closed).

## Later (max 3)
- supabase.functions.invoke callers (about 20 pages) show a generic non-2xx error for 401/403/429; only streamInvoke callers get the specific messages.
- Pre-existing `no-explicit-any` lint debt in the data functions was left untouched.
- Repo-level ARCHITECTURE.md "Edge function auth" section and `ai_usage` entry (ADR section 12) when the PR lands.

## Engineer notes (decisions taken without asking; most conservative option chosen)
1. **Handler split.** `ai-advisor`, `weekly-briefing`, `check-alerts`, `stripe-checkout` have `handler.ts` exporting `handle(req, deps)`; `index.ts` is a thin `serve(...)`. Reason: `index.ts` imports `https://deno.land/...`, which Vitest cannot resolve. The static test scans every `.ts` in a function directory. Other functions keep logic in `index.ts` (not individually unit-tested; covered by the static guard).
2. **Dispatch seam names.** `authenticate -> validateChat -> resolveMode -> consumeUsage -> buildSystemPrompt -> callOpenAI` (the ADR's `authAndLimit` was split so validation precedes quota consumption, as ADR section 2.4 requires).
3. **Mode `aje`.** AIAdvisor.tsx sends `mode: "aje"` for its default persona; it previously fell through to the default prompt. Registered as an alias of `default` rather than editing the page. Absent mode = default.
4. **No frontend caller sends a `system` role** (AIAdvisor, FinancialAdvisor, Strategy123, Decisions, WeeklyBriefing grepped; RightBar and LandingFooter do not call the function). `raw_context` string sent by AIAdvisor was already ignored server-side and is now dropped by the whitelist.
5. **History trim in streamInvoke.** Chat pages send the whole history; the server rejects more than 20 messages. `streamInvoke` keeps the last 20 so long chats do not start failing. Total-size overflow (24k chars) still returns 400 "Bad request".
6. **weekOf format.** WeeklyBriefing.tsx sends "November 2, 2026", not ISO. Validator accepts ISO or `Month D, YYYY`; anything else is ignored (server date used) rather than 400.
7. **get-price-data timeframe.** Chart.tsx sends `6M`, which the old code silently treated as 1M. Kept: any 1-4 alphanumeric value is accepted and unknown ones fall back to 1M; only malformed values 400.
8. **profiles guard deviations from ADR 2.4** (both keep the app working, neither weakens the user path):
   - Existing admins (`profiles.is_admin`, via new definer helper `is_caller_admin()`) may change protected columns, because Admin.tsx edits other users' plan/admin flag through the existing "Admins can update all profiles" policy. A non-admin cannot self-promote.
   - `stripe_customer_id` can be set once (NULL -> value) by the user, because stripe-checkout writes it with the user's client and the task keeps billing code unchanged. Changing an existing value is blocked.
9. **generate-signals buckets.** One `consume_usage` per request (not per ticker). Macro mode and an empty ticker list make no OpenAI call and count in the `data` bucket; the per-ticker path counts in `ai`. Tickers capped at 25 per call.
10. **No data-GET retry.** ADR 7 lists one retry with backoff as an [A]; not implemented (extra behavior, double spend risk). Timeouts (OpenAI 60s chat / 30s briefing+sentiment, data 20s, webhook 10s) are implemented via `fetchT`.
11. **Upstream 429 -> 429, other upstream failures -> 502.** Both sanitized. The UI shows the "usage limit" text for any 429.
12. **send-household-invite** keeps its own `auth.getUser` + owner check (ADR 3 table). Only shared CORS/preflight (405 for non-POST) were added; it does not call `requireUser`, so unapproved users can still accept household invites. The static test classifies it `own-auth`.
13. **A7 pin test fixture.** The repo's migration history is not replayable in pglite (first profiles migration contains `security modeller`), so `edge-harness.ts` recreates the pre-migration shape (unpinned functions with the real signatures, weak households policy, profiles with policies) and applies the real new migration on top. Concurrency is covered by a 50-call single-statement test; true multi-connection contention is not exercisable in pglite.
14. **check-alerts symbol** is `encodeURIComponent`-escaped into Polygon URLs (user-controlled DB value; cheap path-injection guard).
15. **Environment** `APP_URL` may be a comma list for CORS; return URLs use the first entry.

## Evidence
See CONTEXT.md "Deterministic results".
