# CONTEXT: edge-auth-hardening (slice SEC)

Authoritative packet for downstream agents. Design: `ARCHITECTURE.md` (frozen). Status: built on `fix/edge-auth-hardening`, uncommitted, awaiting independent verifier and Security gate.

## Objective
Close audit findings A1-A9: real JWT verification plus approved-user gate on every non-desk edge function, shared strict CORS, sanitized errors, input validation, per-user daily usage caps with `max_tokens`, check-alerts cron/user split, stripe-checkout return-URL fix, migration for usage counters, search_path pins, households policy, profiles guard. Premise (Jay): NO tiers, friends and family only, no subscription lookups, Stripe/billing logic untouched.

## Scope (files)
- New shared: `supabase/functions/_shared/{auth,auth-deno,limits,validate}.ts`
- Handlers split for testability (`index.ts` is a thin `serve(...)` wrapper): `ai-advisor/{handler,modes}.ts`, `weekly-briefing/handler.ts`, `check-alerts/handler.ts`, `stripe-checkout/handler.ts`
- Edited in place: generate-signals, screen-assets, get-financial-news, get-market-data, get-ticker-context, get-congress-trades, get-earnings-calendar, get-price-data (index.ts), send-household-invite (CORS/405 only)
- Migration: `supabase/migrations/20261109000000_edge_auth_hardening.sql`
- Config: `supabase/config.toml` (check-alerts, stripe-webhook `verify_jwt = false`)
- Frontend (minimum): `src/lib/streamInvoke.ts` (401/403/429 messages, history trimmed to 20 messages; callback signature unchanged)
- Tests: `src/test/edge/*` (auth, validate, usage-db, handlers, static-auth, fakes, edge-harness)
- NOT touched: desk-*, `_shared/desk*`, stripe-webhook, any prompt TEXT (moved verbatim into `ai-advisor/modes.ts`)

## Contracts
- Handler order: preflight (OPTIONS/405) -> requireUser (JWT via `auth.getUser`, then `profiles.access_approved`) -> readJsonBody (byte cap) -> validate -> `consume_usage` RPC vs cap in `limits.ts` -> upstream. Validation precedes consume.
- Statuses: 401 (no/bad token, anon key), 403 (not approved), 400, 405, 413, 429 (+Retry-After to UTC midnight), 503 (usage/approval backend failure, fail closed), 500/502 sanitized. Bodies `{error: <fixed string>}`.
- Cron: `x-cron-secret` vs `DESK_CRON_SECRET`, constant time, unset/empty/mismatch = 401. Service-role client is built only in check-alerts cron mode.
- Usage: `ai` bucket 150/day (AI functions combined), `data` bucket 2000/day. Tune only in `_shared/limits.ts`.
- ai-advisor seam: add a mode = add one entry to `MODE_REGISTRY` in `ai-advisor/modes.ts` (optional `contextSchema`, `maxTokens`). Do not touch auth, limits or validation. `resolveMode` falls back to `default`; `validateChat` rejects names not in the registry.
- Approve a friend: `update public.profiles set access_approved = true where email = '...';` (the migration backfills everyone who exists at apply time).

## Deterministic results (this worktree)
- `npx vitest run`: 23 files, 651 tests pass (new: 5 files in `src/test/edge`).
- `npx tsc -p tsconfig.app.json --noEmit`: 614 errors, identical to origin/main (0 new).
- `npx vite build`: OK.
- eslint on touched files: no new errors; remaining are pre-existing `no-explicit-any`/`no-unused-expressions` in untouched code of the data functions.

## Unresolved blocking findings
None known. Items needing Jay (production, not executed here): see CHECKLIST.md "Needs Jay".
