# ARCHITECTURE: AI strategy builder (ADR)

Status: proposed. Author: Architect. Authority: CONTEXT.md in this folder. No product code or migrations exist yet.
Items marked **[A]** are Lead-reviewable assumptions (defaults chosen, not decided by Jay).

## 1. Context

Today `/invs/strategy` (`FinancialAdvisor.tsx`) is a stateless markdown chat: it streams `{messages, context, mode:"financial-advisor"}` through `streamInvoke` to `ai-advisor`, which proxies OpenAI SSE straight back. Nothing is saved. `/wealth` and the home panels read other tables and have no strategy concept. Verified facts that shape the design:

- `ai-advisor` is not listed in `supabase/config.toml`, so the platform default `verify_jwt = true` applies. The in-function guard only checks the `Bearer ` prefix, so the function must call `auth.getUser(jwt)` itself before trusting any identity. Existing modes must keep behaving exactly as now.
- Desk precedent (`_shared/desk/*`, `src/test/desk-db/harness.ts`): edge helpers are dependency-free TS importable by vitest as `.ts`; DB behaviour is tested by running the real migration SQL in pglite with `set role authenticated` and `request.jwt.claim.sub`. We reuse that. `zod` is a web dep only; `npm:zod` in a `_shared` file would break vitest, so the validator is hand-written.
- `update_updated_at_column()` exists (migration 20260620000007) and is reused. Supabase is PG15+, so composite FK `ON DELETE SET NULL (col)` is available; pglite is newer.
- Per-user tables elsewhere use `user_id` plus `auth.uid()` policies. Strategy is per user, so tenant = `auth.uid()`; no household or company id is involved.

## 2. Decision summary

1. Four additive tables: `user_strategy`, `strategy_items`, `strategy_actions`, `strategy_messages`, all keyed by `user_id uuid references auth.users on delete cascade`, RLS on with explicit per-command policies for `authenticated` only.
2. A new mode `strategy` on `ai-advisor`. The model emits structure through one OpenAI **tool call** (`update_strategy`) alongside normal streamed prose. The function validates it with a hand-written validator, then applies it through **one invoker-rights Postgres function** `apply_strategy_update(jsonb)` in a single transaction, called with the **user's JWT** (never service role). RLS remains the enforcement point.
3. "AI proposes, never clobbers": every AI-written row carries a stable `ai_key`; user-edited rows are never updated by the AI. The AI's change is stored in `pending_ai_proposal` for the user to accept or dismiss.
4. The server, not the client, owns context: the function loads history and current strategy from the DB for the JWT's user. The client sends only the new message text.
5. Demo mode keeps the canned response and performs no Supabase writes (hooks are disabled in demo).

## 3. Data model (migration `supabase/migrations/20261109000000_ai_strategy.sql`, additive only)

No existing table is altered or dropped. Nothing here is destructive; no Hard Stop.

### 3.1 `user_strategy` (one row per user)

| column | type | constraint |
|---|---|---|
| id | uuid | pk default gen_random_uuid() |
| user_id | uuid | not null, unique, fk auth.users(id) on delete cascade |
| status | text | not null default 'interviewing', check in ('interviewing','active') |
| primary_goal | text | check length <= 300 |
| time_horizon_years | int | check between 1 and 60 |
| risk_tolerance | text | check in ('conservative','moderate','aggressive') |
| profile | jsonb | not null default '{}', check jsonb_typeof = 'object' and pg_column_size <= 8192 (age, annual_income, monthly_savings, net_worth_estimate, notes) |
| profile_locked | text[] | not null default '{}' (profile fields the user edited; AI cannot overwrite) |
| summary | text | check length <= 1500 |
| summary_edited | boolean | not null default false |
| summary_proposal | text | check length <= 1500 (AI revision held back while summary_edited) |
| version | int | not null default 0 (incremented per applied AI update) |
| last_ai_update_at | timestamptz | |
| created_at, updated_at | timestamptz | not null default now(); updated_at trigger |

### 3.2 `strategy_items` (wealth, invest, opportunity, gap sections)

| column | type | constraint |
|---|---|---|
| id | uuid | pk default gen_random_uuid() |
| user_id | uuid | not null, fk auth.users on delete cascade |
| section | text | not null, check in ('wealth','invest','opportunity','gap') |
| ai_key | text | nullable; check `~ '^[a-z0-9][a-z0-9_-]{0,63}$'`; null for user-created rows |
| title | text | not null, check length 1..160 |
| body | text | not null default '', check length <= 1200 |
| metrics | jsonb | not null default '{}', object, pg_column_size <= 2048 (e.g. {"target_pct":60,"amount":25000}) |
| impact | smallint | check between 1 and 5 (used by opportunity and gap) |
| position | int | not null default 0 |
| source | text | not null default 'user', check in ('ai','user'); check (source='user' or ai_key is not null) |
| edited_by_user | boolean | not null default false |
| pending_ai_proposal | jsonb | object with keys title, body, metrics, impact, pg_column_size <= 4096 |
| archived_at | timestamptz | tombstone for user-removed AI rows (see 4.4) |
| created_at, updated_at | timestamptz | default now(); updated_at trigger |

Indexes: `unique (id, user_id)` (target for composite FK); partial `unique (user_id, section, ai_key) where ai_key is not null`; `(user_id, section, position) where archived_at is null`.
Cap enforced in the RPC: at most 25 live rows per user per section.

### 3.3 `strategy_actions`

| column | type | constraint |
|---|---|---|
| id | uuid | pk |
| user_id | uuid | not null, fk auth.users on delete cascade |
| ai_key | text | same check as items; partial unique `(user_id, ai_key) where ai_key is not null` |
| title | text | not null, 1..160 |
| detail | text | not null default '', <= 800 |
| priority | smallint | not null, check between 1 and 5 (1 = highest) |
| status | text | not null default 'todo', check in ('todo','done','dismissed') |
| due_hint | text | <= 80 |
| linked_item_id | uuid | composite fk `(linked_item_id, user_id)` references strategy_items(id, user_id) on delete set null (linked_item_id); guarantees a link never crosses tenants |
| source, edited_by_user, pending_ai_proposal, archived_at | | same semantics as items |
| completed_at | timestamptz | set by client when status becomes 'done' |
| created_at, updated_at | timestamptz | |

Indexes: `(user_id, status, priority, created_at)`; cap 40 live actions per user in the RPC. `status` is user-owned state: the AI never writes it (not a content field, does not set `edited_by_user`).

### 3.4 `strategy_messages` (resumable interview)

`id uuid pk`, `user_id uuid not null fk cascade`, `role text check in ('user','assistant')`, `content text not null check length 1..8000`, `client_msg_id uuid` (idempotency key supplied by client for user messages), `created_at timestamptz default now()`. Indexes: `(user_id, created_at desc)`; `unique (user_id, client_msg_id)` (nulls never collide). Rows are immutable: no UPDATE policy and `revoke update`.

### 3.5 RLS (default deny)

For each of the four tables: `alter table ... enable row level security;` `revoke all ... from anon, public;` `grant select, insert, update, delete ... to authenticated` (messages: no update). Policies, all `to authenticated`:

- select: `using (user_id = (select auth.uid()))`
- insert: `with check (user_id = (select auth.uid()))`
- update: `using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))` (cannot reassign a row to another user)
- delete: `using (user_id = (select auth.uid()))`

`service_role` bypasses RLS by platform design and is deliberately not used by this feature. No policy or code path accepts a client-supplied user id: tables default nothing, the RPC has no `user_id` parameter and reads `auth.uid()`, and the edge function derives the user from `auth.getUser(jwt)`.
**[A]** A user can insert rows labelled `source='ai'` or forge `assistant` messages in their own tenant. This is self-only and cosmetic (the label "AI draft"); it has no cross-tenant effect, so we do not add GUC-gated policies (the desk build showed GUC gates are spoofable and add complexity for no gain here). Messages are bounded by length checks and prompt-treated as untrusted data.

### 3.6 Triggers and functions

- `update_updated_at_column` on the four tables (reuse).
- `strategy_mark_edited()` BEFORE UPDATE on items and actions: if `current_setting('strategy.ai_apply', true)` is not `'1'` and a content column (title, body, metrics, impact, detail, priority) changed, set `edited_by_user = true` and clear `pending_ai_proposal` only when the user explicitly resolves (via RPC below). Same on `user_strategy` for profile columns (append the field name to `profile_locked`) and `summary` (`summary_edited = true`). Spoofing the GUC only lets a user skip the edit flag on their own rows (self-only).
- `apply_strategy_update(p_update jsonb) returns jsonb`, `language plpgsql`, **security invoker**, `set search_path = public`. Sets `strategy.ai_apply='1'` with `set_config(..., true)` (transaction local). Raises if `auth.uid()` is null. Steps: upsert `user_strategy` (merge profile skipping `profile_locked`; summary goes to `summary_proposal` if `summary_edited`; version +1; status -> 'active' once primary_goal, time_horizon_years and risk_tolerance are all present); for each item/action: insert new, update only where `source='ai' and edited_by_user=false and archived_at is null`, else write `pending_ai_proposal` when edited, else skip when tombstoned; honour `remove_keys` only for unedited AI rows (edited rows get a proposal note instead). Enforces the section caps. Returns `{version, applied, proposed, skipped, removed}`. `revoke execute ... from public, anon; grant execute to authenticated`.
- `resolve_strategy_proposal(p_kind text, p_id uuid, p_accept boolean) returns void`, security invoker, same GUC pattern. Accept copies the proposal into the row and sets `edited_by_user=false` (row is AI-owned again); reject clears the proposal and keeps `edited_by_user=true`. Both filter by `user_id = auth.uid()` implicitly through RLS.

All SQL is static (no dynamic string building). Rollback: `drop` the four tables and two functions (additive migration, safe to revert while empty).

## 4. AI output contract

### 4.1 Mechanism

Tool call, not fenced JSON. Rationale: schema-constrained by the API, cleanly separable from prose, no regex scraping of markdown. The request sets `tools:[{type:"function", function:{name:"update_strategy", strict:true, parameters: STRATEGY_UPDATE_JSON_SCHEMA}}]`, `tool_choice:"auto"`, `stream:true`, `max_tokens:3000`, `model:"gpt-4o"` (same as today).

### 4.2 Schema (`update_strategy` arguments)

```
{
  "change_reason": string (1..300, required),
  "profile":  { primary_goal?: string<=300, time_horizon_years?: int 1..60,
                risk_tolerance?: "conservative"|"moderate"|"aggressive",
                age?: int 16..110, annual_income?: number 0..1e12,
                monthly_savings?: number 0..1e12, net_worth_estimate?: number 0..1e12,
                notes?: string<=1000 },
  "summary":  string<=1500,
  "items":    [ { key: /^[a-z0-9][a-z0-9_-]{0,63}$/, section: "wealth"|"invest"|"opportunity"|"gap",
                  title: string 1..160, body: string<=1200,
                  metrics?: { [k: string]: string<=80 | number } (<=8 keys),
                  impact?: int 1..5 } ]   (<=30),
  "actions":  [ { key: same regex, title: string 1..160, detail?: string<=800,
                  priority: int 1..5, due_hint?: string<=80, item_key?: string } ] (<=20),
  "remove_keys": [ { kind: "item"|"action", section?: section, key: string } ] (<=20)
}
```

All objects are strict (unknown keys rejected, including any `user_id`, `id`, `status`, `source`, `edited_by_user`). At least one of profile, summary, items, actions, remove_keys must be present. Duplicate keys within one payload are rejected. `item_key` must resolve to a key in the payload or an existing live item of that user (checked in the RPC; unresolved becomes null, not an error).

### 4.3 Validation and rejection

`supabase/functions/_shared/strategy/validate.ts` (dependency-free, exports `validateStrategyUpdate(raw: unknown): {ok:true, value} | {ok:false, errors:string[]}`; also exports the JSON schema constant used in the tool definition so there is a single source). Flow in the function:

1. Accumulate streamed `delta.tool_calls[].function.arguments` server-side per call index; never forward them to the client.
2. At `finish_reason === "tool_calls"` run `JSON.parse` (try/catch), then the validator, then check profile completeness (merged profile needs goal, horizon, risk before any `items` or `actions` are accepted; a profile-only update is allowed during the interview).
3. Only a fully valid payload reaches the RPC. Any parse, validation, completeness or RPC error means **zero writes** (the RPC is one transaction) and the function emits SSE `{"strategy_event":{"type":"rejected","reason":"invalid_output"}}`. The assistant prose is still saved and shown; the user can say "try again". The raw bad payload is logged server-side with user id hash only, never returned to the client. No automatic repair re-prompt (**[A]**, keeps cost and loop risk bounded).
4. Success emits `{"strategy_event":{"type":"applied","version":n,"applied":a,"proposed":p,"skipped":s}}`; the client invalidates the strategy queries.
5. At most one `update_strategy` call per turn is honoured; extra calls are ignored and logged.

### 4.4 Protecting user edits

- Row identity is `(user_id, section, ai_key)`; the model is told the existing keys in the prompt so revisions reuse them instead of inventing new rows.
- Unedited AI rows are updated in place. Edited rows (`edited_by_user=true`) are never touched; the new AI content lands in `pending_ai_proposal`, shown in the UI as "AI suggests a change" with Accept / Dismiss (`resolve_strategy_proposal`). User-created rows (`ai_key` null) are invisible to AI writes.
- User removal of an AI row sets `archived_at` (tombstone) rather than deleting, so the next revision cannot resurrect it; user-created rows are hard-deleted. Un-archive is a user action.
- Profile fields the user edited are in `profile_locked`; summary uses `summary_edited` / `summary_proposal`. Action `status` and `completed_at` are never AI-writable.
- The prompt also lists locked fields and edited rows so the model proposes instead of repeating itself.

## 5. Edge function design (`supabase/functions/ai-advisor/index.ts`)

Existing code paths are untouched: the new branch is entered only when `mode === "strategy"`, placed after the existing auth-prefix guard; the old `{messages, context, mode}` handling remains byte-identical for all other modes. New logic lives in `_shared/strategy/` (`validate.ts`, `prompt.ts`, `context.ts`) so `index.ts` grows by a small dispatch only.

Request (strategy mode): `{ mode:"strategy", message: string (1..4000), client_msg_id: uuid }`. Any `messages`, `context`, `user_id` fields are ignored.

Flow:
1. Guard preserved (401 without Bearer). Then `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {global:{headers:{Authorization: authHeader}}})`; `auth.getUser()` verifies the JWT server-side (401 on failure). All DB access uses this client, so RLS applies. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are auto-injected into edge functions; no new secret. `OPENAI_API_KEY` already exists.
2. Rate limit from the DB (no new infra): count the user's `strategy_messages` with role 'user' in the last minute (limit 8) and last 24 h (limit 150); exceed returns 429 JSON in the existing error shape. **[A]** limits.
3. Idempotency: insert the user message with `client_msg_id`; on unique violation treat as retry: skip the insert; if an assistant message already exists after it, return JSON `{replayed:true}` (client refetches history) instead of generating again.
4. Load context: last 30 messages (capped at 24 000 chars total, newest kept), the user's `user_strategy` + live items/actions (with keys, `edited_by_user`, locked fields), and a compact portfolio summary read from `portfolios` (RLS) when present. Fields are rendered as delimited data in the system prompt, labelled untrusted.
5. Call OpenAI with `AbortController` timeout 60 s. Before any bytes are streamed, retry once on 429/5xx/network error with backoff 500 ms then 1500 ms (jitter); after streaming starts no retry (non-idempotent). Map 429/402/other to the same user-facing errors as today.
6. Stream: rebuild a pass-through SSE where content deltas are re-emitted in the same OpenAI chunk shape (`choices[0].delta.content`), so `streamInvoke` works unchanged; tool-call deltas are buffered. After the stream ends: persist the assistant message (full text), run section 4.3, emit the `strategy_event`, then `data: [DONE]`. If the client disconnects mid-stream the assistant text is still persisted best-effort and the tool call is still validated and applied (a half-delivered turn must not leave history without its reply).
7. Prompt (`strategy` system prompt) behaviour:
   - Role: CFP-style interviewer building a personal strategy; reuse the disclosure wording from `FINANCIAL_ADVISOR_PROMPT` (not financial advice, consult a licensed professional) once per strategy emission, not every turn. No trade execution, no guarantees, illustrative numbers only, never invent market prices or the user's holdings.
   - Interview: ask at most two questions per turn, conversational; cover goal, time horizon, risk tolerance, income and monthly savings, assets and debts, existing accounts, tax situation, liquidity needs. Record facts with `profile`-only tool calls as they are learned.
   - Emit rule: once goal, horizon and risk are known and at least three of the other topics are covered, it must call `update_strategy` with wealth and invest items, at least two opportunities, at least two gaps, and a prioritized action list (priority 1 = do first, each action tied to a gap or opportunity via `item_key`). Afterwards, any stated goal, income, risk or asset change triggers a revision call with a `change_reason`; unchanged facts never trigger a call.
   - Revision: reuse existing keys; for edited rows or locked fields, propose by reusing the key (the server converts to proposals); use `remove_keys` only when something is obsolete.
8. Output limits: `max_tokens` 3000; payload caps in the validator (30 items, 20 actions, 20 removals); live-row caps in the RPC.

Contract that must not change: existing modes' request/response, SSE chunk shape, 401/429/402/500 error bodies `{error: string}`, `streamInvoke` signature (only an optional callback is added).

## 6. UI surface map

Existing files that change:

| File | Change |
|---|---|
| `src/pages/FinancialAdvisor.tsx` | Non-demo path: history from `useStrategyChat`, send `{mode:"strategy", message, client_msg_id}`; hydrate messages on load (resumes interview); shadcn `Tabs` "Chat" / "My strategy"; handle `strategy_event`. Demo path unchanged (canned stream, no DB). `DisclaimerBanner` is extracted to a component and reused. |
| `src/lib/streamInvoke.ts` | Add optional `onEvent?: (e: unknown) => void` to `StreamCallbacks`; invoked for `parsed.strategy_event`. Existing callers unaffected. |
| `src/pages/WealthDashboard.tsx` | Add a `StrategySection` ("Your strategy", wealth items plus gaps/opportunities teaser) above the existing asset cards. |
| `src/components/home/WealthPanel.tsx`, `InvestPanel.tsx` | Add a compact strategy block (top wealth/invest item, open action count, link to `/invs/strategy` or `/wealth`); empty state links to the interview. Existing content stays. |
| `src/integrations/supabase/types.ts` | Regenerated with `supabase gen types` after the migration, never hand-edited. |

New files:

- `src/components/strategy/StrategyDisclaimer.tsx` (extracted banner).
- `src/components/strategy/StrategyPanel.tsx` (tabs: Wealth, Invest, Opportunities, Gaps, Actions), `StrategyItemCard.tsx` (AI draft badge, Edited badge, inline edit, remove), `ProposalBanner.tsx` (accept/dismiss), `ActionList.tsx` (sorted by priority then created_at, done toggle), `ProfileCard.tsx` (editable profile and summary).
- `src/hooks/useStrategy.ts` (react-query: `useStrategy`, `useStrategyItems(section)`, `useStrategyActions`, mutations `useUpdateItem`, `useCreateItem`, `useRemoveItem`, `useToggleAction`, `useResolveProposal`), `src/hooks/useStrategyChat.ts` (history query plus send/stream mutation). Query keys include `user.id` and `"demo"|"live"` to match `FinancialAdvisor.tsx` conventions. All hooks use `enabled: !!user && !isDemoMode`; in demo mode `useStrategy` returns static sandbox strategy from `src/data/sandboxStrategy.ts` and mutations are no-ops that toast "Demo mode: changes are not saved". No `user_id` is sent on reads beyond filters; inserts set `user_id: user.id` for the RLS check and the server rejects any mismatch anyway.
- `src/lib/strategyTypes.ts` (row and update types).

Untouched: household module, desk module, billing, routes (`/invs/strategy`, `/wealth` already exist; no new route). Rendering uses React text nodes and `ReactMarkdown` for chat only; no `dangerouslySetInnerHTML`.

## 7. Test plan

Unit (vitest, node env where DB):
1. `src/test/strategy/validate.test.ts`: accepts a full valid payload; rejects unknown keys (`user_id`, `status`, `source`), wrong enums, out-of-range numbers, oversize arrays, duplicate keys, bad key regex, empty payload, non-object, truncated JSON string; profile-completeness rule.
2. `src/test/strategy/stream.test.ts`: tool-call delta accumulation across chunks, content passthrough shape, malformed arguments produce `rejected` event and no RPC call (injected fake supabase client), `applied` event on success, retry/backoff only before first byte, replay on duplicate `client_msg_id`.
3. `src/test/strategy/prompt.test.ts`: prompt includes existing keys and locked fields, escapes/delimits untrusted text.
4. `src/test/strategy/ui.test.tsx`: demo mode makes zero `supabase.from`/`rpc`/`functions` calls; actions sort by priority; done toggle fires mutation; edited badge and proposal banner render; `streamInvoke` forwards `strategy_event` and stays compatible with plain chunks.

DB / RLS (pglite, `src/test/strategy-db/`, reusing the `BOOTSTRAP` + `q()` pattern from `src/test/desk-db/harness.ts`; extend harness minimally or add a sibling harness that loads `update_updated_at_column` plus the new migration):
5. Cross-tenant: seed rows as user A; as user B (`authenticated`, uid B) select returns 0 rows on all four tables; insert with `user_id=A` fails; update/delete of A's row affects 0 rows; update `user_id` to A fails WITH CHECK; `apply_strategy_update` as B never alters A's rows; `anon` has no access; composite FK rejects `linked_item_id` pointing at A's item from B's action.
6. `apply_strategy_update`: creates rows; second call updates unedited rows in place; edited row gets `pending_ai_proposal` and is unchanged; `profile_locked` field not overwritten; tombstoned key not resurrected; action `status` untouched by AI; atomicity (payload with one bad row, e.g. cap exceeded or constraint violation, leaves zero changes and version unchanged); null `auth.uid()` raises; section cap enforced.
7. Edited trigger: user content update sets `edited_by_user`; status toggle does not; `resolve_strategy_proposal` accept resets ownership, reject keeps it; messages cannot be updated.

Verifier checklist (maps to CONTEXT acceptance 1-7): run `vitest run`, `eslint .`, `vite build`; confirm migration is additive (`grep -iE "drop|alter table .* (drop|rename)"` finds none), RLS enabled on all four tables with the four policies, no `service_role` use in the strategy path, no `user_id` read from the request body, existing modes unchanged (diff of non-strategy branch is empty), validator is the only path into the RPC, demo mode has zero writes, disclaimer visible on `/invs/strategy` strategy tab. Security gate applies (RLS plus auth in an edge function).

## 8. Alternatives considered

| Option | Upside | Downside | Best when |
|---|---|---|---|
| A. Tool call + validator + invoker RPC with user JWT (chosen) | Schema enforced by API, atomic apply, RLS stays the gate, no service role | More SQL (one function), slightly more edge code | Per-user data where isolation is the priority |
| B. Fenced JSON in prose (repo's current style for trade recs) | No tool plumbing; trivial to stream | Fragile regex parse, model may omit or split the block, mixes prose and data | Throwaway display-only output |
| C. Service-role writes from the edge function | Simplest write path, can bypass policy quirks | One bug in user_id handling becomes a cross-tenant write; weakens non-negotiable 4 | Cron or system jobs with no end-user identity |
| D. Client parses model output and writes tables itself | No edge changes | Untrusted model text drives client writes; no server validation; breaks on page close | Never for this feature |
| E. Single `jsonb` blob per user | One table, trivial schema | No per-field edit tracking, hard to protect edits, no priority querying or indexes | Prototype with no edit requirement |
| F. New separate chat function/page | No risk to existing modes | Duplicates auth, streaming and UI; violates "extend, never build parallel" | Not applicable |
| G. SECURITY DEFINER RPC | Can write regardless of grants | Bypasses RLS, so the RPC becomes the sole control | Cross-user admin operations |
| H. Auto-repair re-prompt on invalid output | Fewer user-visible failures | Cost and loop risk, hides model drift | After measured failure rate justifies it |

## 9. Consequences

- Positive: isolation enforced by Postgres on every path; malformed output cannot partially write; user edits durable across revisions; interview resumable; old modes unaffected.
- Costs: one new migration, one SQL function pair, a streaming adapter in the edge function, regenerated types, and a new `strategy_events` channel the client must tolerate.
- Edge function cold start and per-turn DB reads add latency (a few queries); acceptable for chat.
- Revision history is not stored (only `version` counter). Deferred; recorded under Later.

## 10. Failure modes

| Failure | Behaviour |
|---|---|
| OpenAI 429/5xx/network before first byte | Retry once or twice with 500 ms / 1500 ms jittered backoff, then user-facing error (same bodies as today) |
| OpenAI stall | 60 s abort; user message already saved, no assistant row; client may resend same `client_msg_id` to regenerate |
| Mid-stream failure | No retry; partial prose saved only if the stream ended cleanly, otherwise not persisted; no tool call applied |
| Malformed or invalid tool args | Rejected, zero writes, `rejected` event, prose kept |
| RPC error or constraint violation | Whole transaction rolls back; same as rejected |
| Client retries or double-click | `client_msg_id` unique key; replay returns `{replayed:true}`; RPC is idempotent by `ai_key` upsert (re-applying the same payload yields the same rows; only `version` increments) |
| Concurrent turns by one user | Per-minute limit plus `ai_key` upserts make last-writer-wins safe; no lost user edits because edited rows are never overwritten |
| Prompt injection via user text or profile notes | Treated as data in delimited blocks; the model can only call one schema-bound tool, validated and RLS-scoped to the caller; worst case is garbage in the caller's own tenant |
| JWT invalid or expired | 401, nothing read or written |

## 11. Blast radius

Untouched if requirements change: `desk-*` functions and `_shared/desk`, household pages and hooks, billing/Stripe, the other `ai-advisor` personas and system prompts, `compoundEngine`, existing wealth tables and their pages. Isolated change points: a new item section means one check-constraint value plus a tab; a different model or provider touches only the OpenAI call in `ai-advisor` plus `prompt.ts`; schema fields change only `validate.ts` and the RPC. Reverting the feature is removing the strategy branch, the hooks/components, and (optional) the four tables.

## 12. Needs Jay (true Hard Stops only)

- **Applying the migration to production project `magpawmyuqyzgczewxsl`** and deploying the `ai-advisor` edge function: additive and non-destructive, so autonomous if `RELEASE.md` with `approved: true` exists for this build; otherwise it follows the repo Release Profile (repo CLAUDE.md requires human approval for remote Supabase operations and `supabase functions deploy`). Treat as Needs Jay only if no approved release file exists at ship time.
- No new credentials: `OPENAI_API_KEY` exists; `SUPABASE_URL` and `SUPABASE_ANON_KEY` are platform-injected. No billing change. No destructive migration. No external communications.

## 13. Assumptions for Lead review

1. Hand-written validator (no zod in the edge path) to match desk precedent and vitest importability.
2. Rate limits 8/min and 150/day per user, derived from `strategy_messages`.
3. No auto-repair re-prompt; context window 30 messages / 24 000 chars; `max_tokens` 3000; `gpt-4o` retained.
4. Users can forge `source='ai'` labels and assistant messages in their own tenant (cosmetic, self-only).
5. Tombstone (`archived_at`) for user-removed AI rows; hard delete for user rows.
6. Strategy `status` becomes 'active' automatically when goal, horizon and risk are all present.
7. Migration filename `20261109000000_ai_strategy.sql` (after the latest `20261108000000`); rename if another build lands first.
8. `FinancialAdvisor` moves real users to the `strategy` mode; the `financial-advisor` mode stays available in the function but is no longer called from the page.
9. Root `ARCHITECTURE.md` was not found at the repo root or `docs/`; per-build ADRs live in `docs/builds/*/ARCHITECTURE.md`, so no root file update is made.
