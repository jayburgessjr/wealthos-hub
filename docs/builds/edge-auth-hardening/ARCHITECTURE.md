# ADR: Edge function auth hardening and AI cost controls (slice SEC)

Status: Proposed. Covers audit findings A1-A8 plus A9 (found during design). Product: wealthos-hub, own Supabase project magpawmyuqyzgczewxsl (nothing shared).
Marker: [A] = assumption Jay did not decide. "Needs Jay" = manual production step (no approved RELEASE.md exists).

Product premise (Jay): there are NO tiers. Every user gets everything; the app is for friends and family. Therefore: no subscription lookup anywhere in edge functions, one uniform daily cap, Stripe/billing code untouched (the only stripe-checkout edit is the A5 return-URL fix).

## 1. Context (verified in repo at d59e505)
- ai-advisor, weekly-briefing, generate-signals, screen-assets only test `authHeader.startsWith("Bearer ")`. get-financial-news, get-market-data, get-ticker-context, get-congress-trades, get-earnings-calendar, get-price-data have no check. The anon key (public in the bundle) is a valid JWT, so the gateway default is the only barrier. (A1)
- check-alerts: service-role client over all `alerts` rows, no in-code auth, no config.toml entry. (A2)
- ai-advisor and weekly-briefing interpolate client `context` into the system prompt, spread client `messages` (role "system" allowed) after it, and return raw `e.message`. (A3)
- CORS `*` on all non-desk functions; desk uses an APP_URL allowlist (`_shared/desk-auth.ts`). (A4)
- stripe-checkout builds success/cancel URLs from the caller's Origin header and uses `Authorization!`. (A5)
- No max_tokens, size cap or per-user limit on any OpenAI call. (A6)
- A7, corrected after reading the migrations:
  - 20260331100000 and 20260601000000 define `handle_new_user()` without search_path, but 20260620000000 (later) redefines it WITH `SET search_path = public`, so the effective function is pinned. All other definer functions (create_household, is_household_member, has_household_role, get_user_household_id, sync_debt_from_bill, sync_bill_from_debt, sync_bill_from_goal, sync_goal_from_bill, get_bill_paid_amount, get_bill_status) already carry `SET search_path = public`. 20260620000037 only alters a view. The live DB order may differ from file order (Lovable-generated), so re-pinning is cheap insurance with no behavior change.
  - Real issue: 20260620000000 (dated AFTER the 0523 hardening) re-creates `"Users can create households"` as `WITH CHECK (true)` with no role. By file order the effective policy is the weak one. create_household() is definer, so no client needs direct INSERT.
- A8: the harden migration grants all tables/functions to `authenticated`; safety rests on RLS. Every migration that creates a table also enables RLS (case-insensitive scan). Residual risk is only tables created outside migrations, so an audit query plus test is the control.
- A9 (new): `profiles` has policy "Users can update own profile" with no column restriction and a `profiles.is_admin` column. Any user can PATCH their own row with `{is_admin:true}`, after which "Admins can view all profiles/portfolios/positions" exposes other users' data. Fix: BEFORE UPDATE guard trigger (section 2.4).

## 2. Decision
One shared helper module family, applied to every non-desk function, one additive migration, and static + unit + pglite tests. Desk files are not modified.

### 2.1 `_shared/auth.ts` (Vitest-importable)
No `npm:` specifiers and no `Deno.*` at module scope. Deno-only pieces (supabase client creation, `Deno.env`) live in `_shared/auth-deno.ts` and are injected as `deps`, so tests pass fakes. This mirrors how `_shared/desk/*` is imported by tests via relative paths.

Exports (pure; take `env` getter and client factory as parameters):
- `corsHeaders(req, env)`: allowlist = comma-separated `APP_URL` (existing secret) plus `http://localhost:8080|5173|3000` and `http://127.0.0.1` same ports [A: always allowed; they carry no cookies and auth is the bearer JWT, so no escalation]. Never `*`, never reflect an unlisted origin (unlisted gets the first APP_URL, which browsers reject). Allows the `x-supabase-client-*` headers ai-advisor uses today plus `x-cron-secret`. `Vary: Origin`.
- `jsonResponse`, `optionsResponse`, and `errorResponse(req, status, publicMsg, internal?)`: logs `internal` with console.error and returns only a fixed public message (Unauthorized, Forbidden, Bad request, Payload too large, Rate limit reached, Upstream error, Server error). Raw `e.message` is never returned.
- `readJsonBody(req, maxBytes)`: rejects on `content-length` over the cap and also counts streamed bytes (the header can lie or be absent). 413 / 400.
- `requireUser(req, deps)` returns `{user:{id,email}, client}` or a Response:
  1. Missing or non-Bearer header -> 401.
  2. `deps.makeUserClient(authHeader)` (anon key + caller header, `persistSession:false`).
  3. `client.auth.getUser()` with a 5s timeout. Error, timeout, or no `data.user` -> 401. The anon key is a valid JWT with role anon and no `sub`; getUser returns no user, so it is rejected. Also reject `user.is_anonymous === true`.
  4. Approved-user gate (section 5): read `profiles.access_approved` for the caller through the user client (RLS lets a user read their own row). Not `true` -> 403.
- `requireCronOrUser(req, deps)`: if `x-cron-secret` is present, constant-time compare with `DESK_CRON_SECRET` (the existing secret; reused so no new secret is created; the desk-flavored name is the only cron secret that exists [A]). Secret unset/empty or mismatch -> 401 (deny). Otherwise falls through to `requireUser`.
- `safeEqual` (copied; desk-auth.ts is not edited) and `isAllowedReturnUrl` (section 3.1).

### 2.2 `_shared/limits.ts` (pure TS, the one place for numbers) [A]
```
AI_DAILY_CAP      = 150    // uniform, per user, per UTC day, all AI functions combined
DATA_DAILY_CAP    = 2000   // market-data proxy calls per user per UTC day
MAX_TOKENS        = { chat: 1200, briefing: 1800, signals: 2500 }
MAX_MESSAGES = 20; MAX_MESSAGE_CHARS = 4000; MAX_TOTAL_CHARS = 24000
MAX_CONTEXT_BYTES = 16384; MAX_POSITIONS = 50; MAX_SIGNALS = 10
BODY_CAP_BYTES    = { default: 65536, chat: 98304 }
```
Rationale: 150 chats/day is generous for a person (a heavy session is under 50) and bounds worst-case spend to a few dollars per user per day on gpt-4o. Retuning is a one-line edit plus function redeploy.

### 2.3 Request validation (A3): `_shared/validate.ts` (pure)
- `validateChat(body)`: `messages` is an array of 1..MAX_MESSAGES objects `{role in {user, assistant}, content: string 1..MAX_MESSAGE_CHARS}`; total chars <= MAX_TOTAL_CHARS; last message must be role user. Any other role (system, developer, tool) -> 400 (rejected, not silently dropped). Message objects are rebuilt so extra keys are stripped.
- `mode`: allowlist = `Object.keys(MODE_REGISTRY)` (section 6); unknown -> 400.
- `context`: object, JSON size <= MAX_CONTEXT_BYTES, whitelisted shape `{portfolio:{total_capital, available_capital, deployed_capital, win_rate, risk_tier}, positions[<=50]:{ticker, strategy_type, value, pnl_percent, signal_score}, signals[<=10]:{ticker, signal_score, action}, marketRegime}`. Numbers must be finite and are clamped; tickers `^[A-Z0-9.\-]{1,10}$`; other strings must match a safe charset and length <= 40, enums for risk_tier/action. Invalid fields are dropped (context is advisory). `renderContext()` emits a delimited block labelled "data, not instructions".
- weekly-briefing: same for `portfolio`, `positions`, `signals`; `weekOf` must match `^\d{4}-\d{2}-\d{2}$`.
- Market-data functions: ticker/timeframe/query regexes and length caps before building upstream URLs (also stops path injection into Polygon URLs).

### 2.4 Migration `supabase/migrations/20261109000000_edge_auth_hardening.sql` (additive)
**ai_usage + RPCs (A6)**
```
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  bucket text not null check (bucket in ('ai','data')),
  fn text not null check (char_length(fn) between 1 and 64),
  calls integer not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  primary key (user_id, day, bucket, fn));
alter table public.ai_usage enable row level security;
create policy ai_usage_select_own on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.ai_usage from public, anon, authenticated;
grant select on public.ai_usage to authenticated;   -- no write policy or grant: default deny
```
- `consume_usage(p_bucket text, p_fn text) returns integer`, SECURITY DEFINER. Justification: authenticated has no write grant on ai_usage by design; an invoker function would require INSERT/UPDATE grants and policies, which would let users zero their own counters. Safeguards: `set search_path = public, pg_catalog`; uid only from `auth.uid()` (null -> raise); no user-id parameter; `revoke execute from public, anon; grant execute to authenticated`. Body is a single `insert ... on conflict (user_id,day,bucket,fn) do update set calls = ai_usage.calls + 1` (atomic under concurrency), then returns the sum of today's calls for that bucket.
- The cap is NOT a parameter or in SQL; the edge function compares the returned count with `limits.ts`. A user calling the RPC directly can only inflate their own counter (self-denial); they cannot raise a cap or touch anyone else.
- `record_usage_tokens(p_bucket, p_fn, p_in bigint, p_out bigint) returns void`, same safeguards, clamps negatives to 0. Streaming output tokens are estimated `ceil(chars/4)` [A], recorded best effort after the stream; its failure never fails the request.
- Over-cap: the call that sees `count > cap` gets 429 "Rate limit reached" with `Retry-After` to next UTC midnight.
- Handler order: auth -> approval -> body read/validate -> consume_usage -> upstream. Validation precedes consume so bad requests do not burn quota.
- If `consume_usage` errors, AI and data functions FAIL CLOSED (503). Cost safety over availability for a small app.

**A7 search_path pinning:** `ALTER FUNCTION <signature> SET search_path = public, pg_catalog` (no body change, no grant change, so 0523 REVOKEs are preserved) for: `handle_new_user()`, `create_household(text, numeric)`, `is_household_member(uuid, uuid)`, `has_household_role(uuid, uuid, public.app_role)`, `get_user_household_id(uuid)`, `sync_debt_from_bill()`, `sync_bill_from_debt()`, `sync_bill_from_goal()`, `sync_goal_from_bill()`, `get_bill_paid_amount(uuid)`, `get_bill_status(uuid)`. Each in a `do $$ ... exception when undefined_function then null; end $$` block so it is re-runnable if prod differs. Behavior is unchanged.

**A7 households policy (policy replacement with a stricter one, stated explicitly):** `drop policy if exists "Users can create households" on public.households;` then `create policy "Users can create households" on public.households for insert to authenticated with check ((select auth.uid()) is not null);`. This is the only DROP in the migration. No table or column is dropped.

**A9 + approval flag:** `alter table public.profiles add column if not exists access_approved boolean not null default false;` followed in the same migration by `update public.profiles set access_approved = true where access_approved = false;` to grandfather every existing user once (data backfill of existing rows: idempotent, non-destructive, reversible by setting false; called out in the runbook, not a Hard Stop). Guard trigger `profiles_guard_privileged_cols` BEFORE UPDATE (security invoker, `set search_path = public, pg_catalog`): when `current_user in ('anon','authenticated')` and `is_admin`, `access_approved`, `stripe_customer_id`, `subscription_plan` or `subscription_status` changes, raise 42501. service_role/postgres (webhook, Jay's SQL editor) pass. The billing columns are protected without editing any billing code.

**A8 audit (test and runbook query, not a prod object):**
```
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;      -- expect 0 rows
select polname, pg_get_expr(polwithcheck, polrelid) from pg_policy
 where polrelid='public.households'::regclass and polcmd='a';              -- expect auth.uid() is not null
```
Any table returned gets a follow-up migration (enable RLS plus policies); never fixed blind.

Destructive check: no table/column drops; one policy replacement (above). No Hard Stop.

## 3. Per-function plan
Common to all: shared CORS/OPTIONS, non-POST -> 405, sanitized errors, body cap, upstream timeouts.

| Function | Auth | Changes |
|---|---|---|
| ai-advisor | user JWT + approved | requireUser; readJsonBody; validateChat; consume_usage('ai','ai-advisor') vs AI_DAILY_CAP; `max_tokens: MAX_TOKENS.chat`; system prompt built server-side only; 60s AbortController; sanitized errors; stream passthrough with CORS; token estimate recorded. Prompt TEXT is not edited (slice AI owns D1). |
| weekly-briefing | user JWT + approved | same; validateBriefing; bucket ai; max_tokens briefing; 30s timeout. |
| generate-signals | user JWT + approved | same; bucket ai; max_tokens signals; max 25 tickers per call [A]; logic otherwise unchanged. |
| screen-assets | user JWT + approved | requireUser; bucket data; filter validation; 20s upstream timeout. |
| get-financial-news, get-market-data, get-ticker-context, get-congress-trades, get-earnings-calendar, get-price-data | user JWT + approved | requireUser; bucket data vs DATA_DAILY_CAP; input regexes; no raw errors. |
| check-alerts | user JWT or cron secret | see 3.2. |
| send-household-invite | user JWT (already getUser) | shared CORS and sanitized errors only; its membership/owner logic untouched. |
| stripe-checkout | user JWT + approved | null-safe auth header, allowlisted return URLs (3.1), shared CORS; price/plan logic untouched. |
| stripe-webhook | Stripe signature | UNCHANGED. Needs `verify_jwt = false` in config.toml (Stripe cannot send a JWT); verify live setting and add the entry. |
| desk-* | existing | UNCHANGED. |

### 3.1 A5 return URL
`base` comes only from the `APP_URL` allowlist (first entry); the Origin header is ignored. Optional body `returnPath` accepted only if it starts with `/` and not `//` and has no scheme/backslash. success_url = `${base}/dashboard?session_id={CHECKOUT_SESSION_ID}`, cancel_url = `${base}/dashboard`. APP_URL unset -> 500 sanitized (fail closed).

### 3.2 check-alerts
The service-role scan of all users' alerts is the dangerous pattern. Two modes via `requireCronOrUser`:
- User mode (user JWT): user-scoped client; the select of active alerts is RLS-filtered to the caller's rows and updates go through the same client. No service-role key in this path.
- Cron mode (`x-cron-secret` equals `DESK_CRON_SECRET`): only then build the service-role client and scan all active alerts. Secret unset/empty/mismatch -> 401 (deny, tested).
- config.toml: `verify_jwt = false` for check-alerts (like the desk cron functions) because schedulers carry no user JWT; user mode still validates in code via getUser, so nothing weakens.
- The scheduler that triggers check-alerts is not in the repo [A: manual or dashboard cron]. If a dashboard cron sends the anon key as Authorization, it will return 401 until `x-cron-secret` is added (Needs Jay, runbook step 6). Failing closed is chosen over leaving it open.
- Add `.eq('status','active')` to the trigger update so overlapping runs cannot double-fire webhooks. Existing SSRF hostname check kept as is.

## 4. Alternatives considered (usage limiter)
| Option | Upside | Downside | Best When |
|---|---|---|---|
| A. Definer RPC upsert, cap in TS (chosen) | Atomic, no client write grants, cap in one TS file | One DB round trip per call | Small app, single backend |
| B. Invoker RPC plus write policies | No definer | Users can edit/zero their own counters | Never for a quota |
| C. In-memory counter in the isolate | No DB | Isolates are ephemeral and parallel; unenforceable | Not acceptable |
| D. Cap enforced inside SQL | Unbypassable by edge bugs | Needs a migration to retune; a cap param would be client-controllable | If caps must live in DB |

## 5. Remaining abuse exposure for an invite-only app
A valid user JWT is not an access boundary while public signup is open: a stranger can create an account, get a JWT, and call every function up to the per-user cap. The cap is per user, so N throwaway accounts = N x cap of OpenAI/Polygon spend.

| Option | Upside | Downside | Best When |
|---|---|---|---|
| 1. Disable public signups in the Supabase dashboard | Zero code; blocks account creation at the source | Dashboard change (Needs Jay); in-app Signup page stops working; not testable in repo; can be re-enabled by accident | Jay is happy inviting by hand |
| 2. App-level check in `requireUser` backed by `profiles.access_approved` | Code-enforced and tested on every function; signup still works but is inert until approved; survives dashboard drift | Strangers still get auth rows; one indexed query per call; Jay flips a flag per friend | Want a guarantee in code |
| 3. `allowed_emails` table checked in a signup trigger | Pre-authorizes before signup | New table, touches the auth signup path, more moving parts | Larger invite flows |

Recommendation: Option 2 in this slice (decisive, testable, no secrets). Jay should also do Option 1 when convenient (Needs Jay) as defense in depth. Approve a friend in the SQL editor: `update public.profiles set access_approved = true where email = 'friend@example.com';`. The trigger prevents self-approval. A "waiting for approval" notice for 403 is out of scope here (note for UX slice). Data-bucket functions check approval too, so Polygon/FRED spend is covered.

## 6. Interfaces and contracts; what must not change
- Success response shapes unchanged. Error bodies stay `{error: string}` but the strings become the fixed public set. Statuses: 401, 403 (not approved), 400, 405, 413, 429, 503 (usage backend down), 500/502.
- Request contract tightened: `messages[].role` must be user|assistant. Callers (AIAdvisor.tsx, RightBar.tsx, Strategy123.tsx, LandingFooter.tsx) are grepped before merge; if one sends a system message, move that text server-side as a mode. Frontend edits limited to that.
- Must not change: desk-* and `_shared/desk*`; stripe-webhook signature logic; Stripe price/plan logic; RLS on household tables; `create_household` signature.
- Tenant model: identity comes only from `auth.getUser()` on the verified JWT; usage rows keyed by `auth.uid()` inside the RPC; no client-trusted user/household/company id; RLS default deny on `ai_usage`; service role only in check-alerts cron mode and where it already exists (send-household-invite lookups, stripe-webhook).
- **ai-advisor dispatch seam (for the later AI-coach slice).** Structure as `handle -> authAndLimit() -> validateChat() -> resolveMode(mode) -> buildSystemPrompt(mode, safeContext) -> callOpenAI()`. `resolveMode` reads one `MODE_REGISTRY: Record<string, {systemPrompt: string; contextSchema?: Validator; maxTokens?: number}>` in `ai-advisor/modes.ts`. This slice registers the existing prompts (default, financial-advisor, buffett, graham, lynch, munger, clarman) moved verbatim. The AI-coach slice adds a mode by adding one registry entry plus its context validator and must not touch auth, limits or validation code. Handlers are exported as `handle(req, deps)` with `serve((req) => handle(req, realDeps()))` so they are testable without Deno.

## 7. Failure modes
- Auth backend slow/down: 5s timeout then 401; never allow on error.
- OpenAI/Polygon: AbortController timeouts (OpenAI 60s, data 20s); 429/5xx mapped to 429/502 sanitized. No automatic retry for AI calls; idempotent data GETs get one retry with 300ms backoff [A], without a second consume_usage.
- Idempotency: usage counts per attempt (conservative). check-alerts updates are guarded by status='active'.
- Usage upsert contention: single-row, microsecond lock.
- Client disconnect on a stream aborts upstream; token record skipped.
- Config drift: APP_URL unset -> only localhost CORS and stripe-checkout fails closed. Cron secret unset -> cron path denies.

## 8. Test plan (Vitest under `src/test/edge/`, existing include glob)
1. `auth.test.ts` (fake deps): missing header 401; non-Bearer 401; anon-key JWT (fake getUser returns no user) 401; forged/expired token 401; getUser throws or times out 401; valid but unapproved 403; valid approved ok; CORS allowed origin echoed, localhost allowed, evil origin not echoed, never `*`, `Vary: Origin`; `readJsonBody` oversize via header 413, oversize streamed with no header 413, bad JSON 400; `errorResponse` never contains the internal sentinel string; `requireCronOrUser` correct secret ok, wrong 401, header present with env unset 401, empty/empty 401; `safeEqual` cases; `isAllowedReturnUrl`.
2. `validate.test.ts`: system/developer/tool roles rejected, too many or too long messages, non-string content, last message not user, unknown mode, context reduced to whitelist, injection strings charset-filtered and delimited, NaN/Infinity clamped, ticker regex.
3. `usage-db.test.ts` (pglite, following `src/test/desk-db/harness.ts`, with a small `edge-harness.ts` fixture of profiles/households/user_roles plus the new migration): authenticated cannot INSERT/UPDATE/DELETE ai_usage; sees only own rows; anon cannot call or select; `consume_usage` atomic (50 concurrent calls give 1..50 with no duplicates); per-uid isolation; null uid raises; `proconfig` has search_path on both RPCs; day rollover; profile guard (self `is_admin`/`access_approved`/`subscription_plan` update raises 42501, `display_name` update works, postgres/service_role can); households: `create_household` works, direct insert without uid fails, anon fails; A7 `proconfig` check for every function in the list (fails if a signature is wrong); A8 audit query returns 0 rows plus a negative control.
4. `handlers.test.ts` (injected fakes): ai-advisor, weekly-briefing, check-alerts, stripe-checkout. Anon key -> 401 and upstream fetch fake never called; over cap -> 429 and upstream never called; OpenAI body has `max_tokens` and a server-built system message first with no client system role; upstream error sanitized; check-alerts user mode never constructs the admin client, cron mode bad/unset secret 401; stripe-checkout ignores hostile Origin.
5. `static-auth.test.ts` (regression guard): for every `supabase/functions/*/index.ts` excluding `_shared`, `desk-*`, `stripe-webhook`: must import `_shared/auth` and call `requireUser(` or `requireCronOrUser(`; fail on `"Access-Control-Allow-Origin": "*"`; fail on `.message` inside a Response body; fail on an OpenAI call without `max_tokens` or without `consume_usage`; `config.toml` `verify_jwt = false` only for an explicit allowlist (desk cron three, check-alerts, stripe-webhook); a new function directory fails until classified in the test's allowlist; `_shared/auth.ts` must contain no `npm:` or `Deno.`.
Gates: `npm test`, typecheck, lint, build; independent verifier; Security gate (auth/tenancy/RLS).

## 9. Blast radius
Touched: the 13 non-desk, non-webhook function entry points, new `_shared/{auth,auth-deno,limits,validate}.ts`, `ai-advisor/modes.ts`, one migration, `config.toml` (two entries), tests. Untouched: desk-*, `_shared/desk/**`, stripe-webhook, frontend except a possible system-role fix. If caps change: `limits.ts` only. If tiers ever return: `limits.ts` and an extra step in `requireUser`. If approval policy changes: the approval step and the column.

## 10. Rollback
Code: revert the PR and redeploy previous function versions (`supabase functions deploy <name>` from the prior commit). Migration is additive; the reverse script is kept as comments in the migration header and is a manual Needs Jay action (remove the RPCs, the ai_usage relation, the guard trigger and the `access_approved` column; restoring the old `WITH CHECK (true)` households policy is not recommended). Fast unlock without redeploy: approve users in SQL.

## 11. Runbook (Needs Jay, production; the build executes none of this)
Pre-checks (confirm existing, do not create or rotate): `supabase secrets list --project-ref magpawmyuqyzgczewxsl` shows `APP_URL` (exact production site origin), `DESK_CRON_SECRET`, `OPENAI_API_KEY`, `POLYGON_KEY` and the other provider keys. `SUPABASE_URL`/`SUPABASE_ANON_KEY`/service role are auto-provided.
Order (migration first, because new function code calls the RPCs and reads `access_approved`):
1. `supabase db diff --linked`; read the migration; if desk migrations 20261107/20261108 are also unapplied they go first, in order.
2. `supabase db push --project-ref magpawmyuqyzgczewxsl` (backfill grandfathers all current users).
3. Run the two A8 audit queries in the SQL editor: zero RLS-less tables; households insert check is `auth.uid() IS NOT NULL`.
4. config.toml (in the PR): `verify_jwt = false` for check-alerts and stripe-webhook beside the desk three; all other functions keep gateway verification ON as a second layer.
5. `supabase functions deploy ai-advisor weekly-briefing generate-signals screen-assets get-financial-news get-market-data get-ticker-context get-congress-trades get-earnings-calendar get-price-data check-alerts send-household-invite stripe-checkout --project-ref magpawmyuqyzgczewxsl`. Redeploy stripe-webhook only if config changed (keep `verify_jwt=false`).
6. If check-alerts has a scheduler, add header `x-cron-secret` with the existing DESK_CRON_SECRET value (kept in the scheduler's secret store). Until then it returns 401 by design.
7. Approve friends: `update public.profiles set access_approved = true where email = '...';`
8. Recommended: Dashboard > Authentication > disable new user signups (Option 1).
Post-deploy verification, anon key only (`URL=https://magpawmyuqyzgczewxsl.supabase.co`, `ANON` = public anon key):
```
for f in ai-advisor weekly-briefing generate-signals screen-assets get-financial-news get-market-data \
         get-ticker-context get-congress-trades get-earnings-calendar get-price-data check-alerts stripe-checkout; do
  printf "%s " $f; curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/functions/v1/$f" \
    -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'
done                                   # expect 401 on every line
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/functions/v1/check-alerts" -H "x-cron-secret: wrong"   # 401
curl -s -D- -o /dev/null -X OPTIONS "$URL/functions/v1/ai-advisor" -H "Origin: https://evil.example" | grep -i allow-origin   # no evil.example, no *
curl -s "$URL/rest/v1/ai_usage?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"   # 401/permission denied or []
```
Then, signed in as an approved account, confirm AI chat, briefing and a market-data page return 200, and an unapproved test account gets 403.

## 12. Risks and assumptions
- [A] caps 150 AI / 2000 data per user-day; max_tokens 1200/1800/2500; 64 KiB body cap; localhost CORS always allowed; DESK_CRON_SECRET reused for check-alerts; backfill approves everyone existing; 25-ticker cap on generate-signals; one retry on data GETs.
- Unknown check-alerts scheduler will break until the header is added (intentional).
- A frontend caller may send a system role or unlisted mode; the engineer greps callers and fixes the caller or registers the mode.
- Live DB state may differ from file order; the migration converges (single policy replace, ALTER FUNCTION by signature in exception-guarded blocks). Run the audit queries read-only on prod before applying.
- Repo-level ARCHITECTURE.md gets a short "Edge function auth" section and the `ai_usage` table when the PR lands.
