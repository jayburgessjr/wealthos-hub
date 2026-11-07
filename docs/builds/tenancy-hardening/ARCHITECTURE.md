# ADR: Server-controlled household membership and invite flow (slice TEN)

Status: proposed. Branch fix/tenancy-hardening (based on fix/edge-auth-hardening). Findings: F1-F8 in TENANCY_FINDINGS.md.
Marks: [A] = assumption to confirm with the runbook read-only checks.

## 1. Context

The household is the tenant. Today membership is two client-writable facts:
- `profiles.household_id` (the "active household"), read by `get_user_household_id()`, which is what ~108 data-table policies call.
- `user_roles` rows, read by `has_household_role()` (owner policies, 47 call sites) and `is_household_member()` (no policy calls it).

Both are writable by the row owner: profiles self-UPDATE policy has no column restriction (F1), and user_roles has "Users can insert their own role" `WITH CHECK (user_id = auth.uid())` (F2), plus "Owners can manage roles" FOR ALL. Invitations bind to `profiles.email`, which the user can edit (F3). The three definer helpers answer for any uid (F4). The client does these writes directly (household-queries.ts: acceptInvitation, switchActiveHousehold, updateMemberRole, removeMemberFromHousehold; setProfileHousehold and upsertOwnerRole have no callers).

Verified in this tree: every one of the 155 policy call sites of the three helpers passes `auth.uid()` or `(select auth.uid())` as the user argument (grep of migrations and functions; no edge function calls them). `create_household` is the only existing definer that mutates membership and already sets both facts atomically.

Side observations that shape the design:
- `listUserHouseholds` selects user_roles with no user filter and relies on RLS. The only SELECT policy is "roles in my ACTIVE household", and households SELECT is also active-only, so the switcher can currently list only the active household. The switch feature is effectively dead today; making it work needs an own-roles SELECT policy and member-based households SELECT (included, below).
- `send-household-invite` authorises the caller against a table `household_members` that no migration creates (service-role client). It likely returns 403 always. Pre-existing, out of scope; recorded under Later, not touched.

## 2. Decision

1. `user_roles` is the single authoritative membership record. `profiles.household_id` becomes a derived "active household" pointer that only server code can set.
2. No client write path to either. All membership mutations go through SECURITY DEFINER RPCs that derive the caller from `auth.uid()`.
3. `get_user_household_id()` additionally requires a matching user_roles row, so even a drifted or forged profile pointer yields no access (defence in depth; needs the backfill in section 4 first).
4. Invitations bind to the verified `auth.users` email via a new definer helper; the invitee loses UPDATE; acceptance is the RPC.
5. Helpers answer only for the caller (or service_role).
6. Frontend calls the RPCs and falls back to the legacy writes only when the RPC does not exist (migration not yet applied).

### Alternatives considered

| Option | Upside | Downside | Best when |
|---|---|---|---|
| A. Column-level UPDATE restriction only (REVOKE UPDATE(household_id)) | Tiny | Does not fix F2/F3; breaks pre-migration frontend with no fallback path; Supabase re-grants on later `GRANT ... ON ALL TABLES` (0523 does this) | Never alone |
| B. Tighten RLS policies only (WITH CHECK that household has an invitation or user is member) | No new functions | Policy has to express "valid invitation consumed once", racy and unreadable; last-owner rule impossible in RLS | Single-column checks |
| C. Definer RPCs + deny-by-default writes + guard triggers (chosen) | Atomic, idempotent, one place for invariants (last owner, invite binding); small client diff | New objects to deploy; needs compatibility fallback | Multi-row invariants like these |
| D. Move membership into a new `memberships` table and drop user_roles/profile pointer | Cleanest model | Destructive/wide: 155 call sites, UI rewrite, production data migration | Greenfield |
| E. Edge function for membership changes with service role | Keeps SQL small | Second trust boundary, JWT forwarding, latency, more secrets exposure | Cross-system side effects |

C is chosen: smallest change that closes every write path and keeps the 155 policies untouched.

## 3. Data model and migration

One new file: `supabase/migrations/20261111000000_tenancy_hardening.sql`. Must sort after the SEC file (it does) but has no code dependency on it (own triggers, does not replace the SEC guard functions). All DDL idempotent (`drop ... if exists`, `create or replace`). No table or column dropped; no column added. Destructive items: none. Policy drops are security tightening, listed so they are not mistaken for data loss. Backfill (4.1) is the only data write: additive INSERT, flagged data change.

### 3.1 Sections of the migration (in order)

S0. Backfill (additive, see 4.1). Runs first so S5 cannot lock anyone out.

S1. Verified-email helper.
```sql
create or replace function public.auth_verified_email() returns text
language sql stable security definer set search_path = public, pg_catalog as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null
$$;
```
Returns NULL for unverified or anonymous. Not parameterised, so no oracle.

S2. profiles guards (new triggers; SEC functions untouched).
- `profiles_guard_household` BEFORE UPDATE: if `current_user in ('anon','authenticated')` and `new.household_id is distinct from old.household_id` raise 42501. No admin exemption (the Admin page edits plan/admin flags only; grep confirms no household_id write). Definer RPCs run as the function owner so they pass; SQL editor/service_role pass.
- `profiles_guard_household_insert` BEFORE INSERT: for anon/authenticated force `new.household_id := null` (neutralise, like SEC's insert guard; handle_new_user is definer and unaffected).
- `profiles.email` is not guarded: authorization never reads it after S4 (display value only). Rationale: guarding would break the user's email-change flow, and the auth.users value is the authority.
- Drop policy "Owners can manage profiles in their household" (owners edited members' profiles, used only for member removal; replaced by `remove_member`). Self-update policy stays.

S3. user_roles.
- Drop "Users can insert their own role" and "Owners can manage roles".
- `revoke insert, update, delete on public.user_roles from anon, authenticated` (secondary to policy; default privileges re-grant on future `grant all` runs, policies remain the primary control).
- Keep "Users can view roles in their household"; add `user_roles_select_own` for authenticated `using (user_id = (select auth.uid()))` (needed by the switcher).

S4. invitations.
- Drop "Invited user can view their invitation" and "Invited user can accept invitation" (the latter also fixes F6: invitee could rewrite household_id).
- Create `invitations_select_invitee` for authenticated `using (lower(email) = (select public.auth_verified_email()))`.
- Keep "Owners can manage invitations" (FOR ALL, owner via has_household_role). Safe now that user_roles is closed: an owner can only write rows whose household_id they own (WITH CHECK).
- Result: token readable only by the inviting owner(s) of that household and the verified invitee. Invitee has no UPDATE; status/accepted_at change only in `accept_invitation`.
- Unique index not needed (token already UNIQUE).

S5. Helpers (F4) and membership source.
```sql
create or replace function public.get_user_household_id(_user_id uuid) returns uuid
language sql stable security definer set search_path = public, pg_catalog as $$
  select p.household_id from public.profiles p
  where p.id = _user_id
    and (_user_id = (select auth.uid()) or (select auth.role()) = 'service_role')
    and exists (select 1 from public.user_roles r
                where r.user_id = p.id and r.household_id = p.household_id)
$$;
-- has_household_role: same body as 0000 plus the identical caller predicate
-- is_household_member: now reads user_roles (not profiles) plus the caller predicate
```
`auth.role()` reads the signed JWT claim, which the client cannot forge; inside a definer function `current_user` is the owner, so it cannot be used to detect the caller. Signatures, STABLE, search_path pin (SEC section 2) and ownership unchanged. Keep `grant execute ... to authenticated`; `revoke execute ... from public, anon` (re-asserted). Proof policies still work: all 155 call sites pass `auth.uid()`, so the predicate is true for every legitimate evaluation; verified by test (7.3, "policy sweep").

S6. households (F8).
- Recreate SELECT `to authenticated using (public.is_household_member((select auth.uid()), id))` (membership, not active pointer, so the switcher can name every household the user belongs to).
- Recreate UPDATE `to authenticated using/with check (public.has_household_role((select auth.uid()), id, 'owner'))`.
- Drop-if-exists by the 0000 names ("Users can view their household", "Owners can update their household"); runbook checks for differently named live policies [A U1].
- INSERT stays absent (SEC); `create_household` is the only creation path.

S7. create_household (F6). `revoke execute on function create_household(text, numeric) from public, anon; grant ... to authenticated`. Decision: do NOT refuse when the caller already has a household. The UI supports multiple households (switcher) and HouseholdSetup is the only caller; refusing closes no attack (a user creating their own empty household touches nobody else's data) and would remove a valid capability. Body unchanged.

S8. stripe_customer_id (F5), guarded:
```sql
do $$ begin
  if exists (select 1 from public.profiles where stripe_customer_id is not null
             group by stripe_customer_id having count(*) > 1) then
    raise notice 'stripe_customer_id duplicates exist; unique index skipped, see runbook';
  else
    create unique index if not exists profiles_stripe_customer_id_key
      on public.profiles (stripe_customer_id) where stripe_customer_id is not null;
  end if;
end $$;
```
Never fails the migration; duplicates are recorded, not auto-resolved (data decision for Jay). SEC already makes the value write-once for users.

S9. RPCs (3.2).

F7 (members see each other's billing/admin columns): DEFERRED, recorded. Reason: `useHouseholdFinancialData` and `useSubscription` do `select *` on the own profile; a column REVOKE would break them, and a view/RPC requires touching those hooks and Admin. Exposure is limited to genuine household members after this slice (friends and family). Later: replace member-visible profile SELECT with a `household_member_profiles` security_invoker view of (id, display_name, email, household_id) and narrow the policy.

### 3.2 RPC set

All: `language plpgsql security definer set search_path = public, pg_catalog`; uid from `auth.uid()` only (raise 28000 if null); no caller-supplied user id except `p_user_id` targets, which are authorised against the caller's ownership; `revoke all on function ... from public, anon; grant execute ... to authenticated;` all objects schema-qualified. Errors use fixed codes/messages the client maps (`not_a_member`, `not_owner`, `last_owner`, `invitation_unavailable`).

| RPC | Behaviour |
|---|---|
| `accept_invitation(p_token text) returns uuid` | `select ... from invitations where token = p_token for update`. Row missing OR `lower(email) <> auth_verified_email()` raises the same `invitation_unavailable` (no existence oracle). If status = 'accepted' and caller already has the role: return household id (idempotent). If status <> 'pending': `invitation_unavailable`. Else in one transaction: `insert into user_roles (uid, hid, 'member') on conflict do nothing` (never downgrades an existing owner); set invitation `accepted`, `accepted_at = now()`; `update profiles set household_id = hid where id = uid` (matches legacy behaviour: joining makes it active). Returns household id. |
| `switch_active_household(p_household_id uuid) returns void` | Requires `exists (select 1 from user_roles where user_id = uid and household_id = p)` else `not_a_member` (42501). Sets caller's profiles.household_id. Idempotent. |
| `set_member_role(p_household_id uuid, p_user_id uuid, p_role app_role) returns void` | Caller must be owner of household (direct user_roles read) else `not_owner`. Target must already have a row (no creation; joining is only via invitation). Locks all owner rows of the household `for update`; if target is owner and p_role = 'member' and owner count = 1 raise `last_owner`. Updates the row. Same-role call is a no-op. Self-demotion allowed when another owner exists. |
| `remove_member(p_household_id uuid, p_user_id uuid) returns void` | Allowed if caller is owner of the household OR p_user_id = uid (this is also "leave household"; no separate RPC). Same last-owner lock/check when removing an owner. Deletes the user_roles row. If target's profiles.household_id = p_household_id, set it to another household the target still belongs to (lowest id [A]) or NULL. Missing row: no-op (idempotent). |

Concurrency: owner-row `for update` serialises concurrent demote/remove, so two owners cannot demote each other simultaneously and leave zero owners. Invitation `for update` serialises double-accept.

## 4. Existing data and reconciliation

4.1 Backfill (S0, additive, DATA CHANGE, not destructive):
```sql
insert into public.user_roles (user_id, household_id, role)
select p.id, p.household_id, 'member' from public.profiles p
where p.household_id is not null
  and exists (select 1 from public.households h where h.id = p.household_id)
  and not exists (select 1 from public.user_roles r
                  where r.user_id = p.id and r.household_id = p.household_id)
on conflict do nothing;
```
Least privilege: never grants owner. Users who got a household via the exploitable paths (F1) are legitimately indistinguishable from members here; the runbook's read-only listing lets Jay spot strangers before applying. Households left with zero owners after backfill are reported by check Q6; Jay promotes one owner by hand in the SQL editor (not automated: it is an authority decision).

4.2 Profiles pointing at a household with no role and no household row cannot exist (FK `on delete set null`).

## 5. Tenant model

- Tenant derived server-side from membership: `auth.uid()` -> user_roles (authoritative) -> optional profiles pointer; every data policy keeps resolving through `get_user_household_id(auth.uid())`, which now also needs a role row.
- RLS default deny: no INSERT/UPDATE/DELETE policy or grant on user_roles for any client role; profiles.household_id write blocked by trigger regardless of policy; households has no INSERT policy.
- No client-trusted company/household id: RPC household arguments are checked against membership or an invitation bound to the verified email; the invite token alone is never sufficient.
- Each product keeps its own Supabase project; nothing shared.

## 6. Interfaces and contracts

Must not change: signatures and return types of the three helpers; `create_household(text, numeric) returns uuid`; table shapes; the 155 data-policy expressions; SEC's `consume_usage`/`record_usage_tokens`/guard functions; the invitation row shape (`createInvitation` still inserts with a client-generated 128-bit token; recommend lowercasing email on insert, client-side, optional).

Changed contracts:
- `acceptInvitation(token, userId)` -> internally `rpc('accept_invitation', {p_token})`; `userId` kept in the signature for caller compatibility but unused on the RPC path. Returns `{householdId}`.
- `switchActiveHousehold(userId, hid)` -> `rpc('switch_active_household')`.
- `updateMemberRole(userId, hid, role)` -> `rpc('set_member_role', {p_household_id, p_user_id, p_role})`.
- `removeMemberFromHousehold(userId, hid)` -> `rpc('remove_member')`.
- `listUserHouseholds(userId)` adds `.eq('user_id', userId)` (works before and after migration).
- `setProfileHousehold`, `upsertOwnerRole`: no callers; delete them (they would otherwise be dead code that always fails post-migration).
- `src/integrations/supabase/types.ts`: never hand-edit (repo rule); regenerate with `supabase gen types typescript` after the migration is available locally, or call the RPCs through a small typed wrapper in membership-rpc.ts (`supabase.rpc` with an explicit cast) so the build does not depend on regenerated types.

### 6.1 Deploy compatibility (critical)

New module `src/integrations/supabase/membership-rpc.ts` (pure, unit-testable):
```ts
export function isRpcMissing(err): boolean   // code 'PGRST202' | code '42883' | status 404 | /Could not find the function/i
export async function callMembershipRpc<T>(name, args, legacy: () => Promise<T>): Promise<T>
```
Behaviour: call rpc; if `isRpcMissing(error)` then memoise `rpcAvailable[name] = false` for the session and run `legacy()`; any other error is thrown unchanged (so `last_owner`, `not_a_member`, RLS denials are never masked and never retried through the legacy path). When the RPC exists the legacy branch is unreachable, so after the migration only the RPC path runs and the legacy writes are additionally denied by RLS/triggers. Legacy functions keep exactly today's code (renamed `*Legacy`). A later cleanup PR deletes the legacy branch once production confirms the migration.

Safe order for Jay (recommended): 1) merge frontend (Netlify deploys; works on old DB via fallback), 2) run the read-only checks, 3) apply the migration, 4) smoke test (section 9). Wrong order, migration before frontend deploy: the still-live old frontend's accept-invite, switch-household, change-role and remove-member calls start failing (RLS/trigger 42501) until Netlify finishes; reads, bills, dashboards unaffected; fix is simply finishing the deploy. Frontend first has no breakage window. Applying this migration before the SEC migration is harmless (independent) but the combined order should stay SEC then TEN.

## 7. Test plan (pglite, no remote access)

Files: `src/test/tenancy/tenancy-harness.ts`, `tenancy-db.test.ts`, `membership-rpc.test.ts` (plus handler-level test for AcceptInvitation error mapping if cheap).

7.1 Harness. Reuse the edge-harness bootstrap (export `BOOTSTRAP` from edge-harness.ts; one-word change) and extend: `auth.users.email_confirmed_at`, `auth.role()`, the `invitations`, `bills` (one representative data table with the real "household_id = get_user_household_id(auth.uid())" policy) tables. Real policies are NOT retyped: the harness extracts `CREATE POLICY` and `CREATE FUNCTION` statements by name from the real migrations (0000 for profiles/households/user_roles/helpers, 0007 for invitations, 0006 for create_household, 0523 section 5 for the `(select auth.uid())` style) with a regex, executes them, then runs the SEC migration, then the TEN migration. A drift test asserts every extracted statement was found (fails loudly if a migration is renamed). Seed pre-migration state with exploitable rows to exercise the backfill.

7.2 Negative (each against the real policies; roles via `set role` + jwt sub as in edge-harness):
- F1: U1 `update profiles set household_id = <HB>` fails 42501; as owner of A same; insert profile with household_id forced null; owner A cannot change B-member household_id.
- F1 end-to-end: U1 (no membership) after failed attempt reads zero rows from `bills` of household B.
- F2: U1 `insert into user_roles (U1, HA, 'owner')` fails; upsert fails; update/delete role fails; owner of A cannot insert/update roles for B.
- F2 cascade: forged pointer without role row (set as postgres to simulate drift) returns NULL from `get_user_household_id` and zero bill rows.
- F3: U2 sets `profiles.email` to the invitee address then selects invitations: zero rows; `accept_invitation` raises `invitation_unavailable`; unverified email (confirmed_at null) with matching address also fails; invitee direct `update invitations` is denied (no policy); owner of A cannot read B's invitations.
- F4: as U1, `get_user_household_id(U2)`, `is_household_member(U2, HB)`, `has_household_role(U2, HB, 'owner')` return NULL/false while the same calls with U1 return truth; `service_role` calling for U2 returns truth; anon has no EXECUTE.
- F6: anon cannot execute create_household; invitation household_id rewrite by invitee impossible.
- F8: households SELECT/UPDATE policies have `roles = {authenticated}` in pg_policies; non-owner member UPDATE affects 0 rows.
- F5: unique index created on clean data; with seeded duplicates the migration completes with the index absent; second unique violation on live insert.
- RPC authz: `switch_active_household(HB)` as non-member fails `not_a_member`; `set_member_role` by non-owner and by owner of another household fails `not_owner`; demote last owner fails `last_owner`; `remove_member` by a plain member for another user fails.

7.3 Positive (whole legitimate flow): U1 `create_household` -> owner role + pointer + categories seeded; owner inserts invitation for U2's verified email; U2 reads it via policy; `accept_invitation` returns hid, role 'member', status accepted, pointer set; second call returns same hid (idempotent) and no duplicate; `switch_active_household` between two memberships changes `get_user_household_id`; `set_member_role` promote then demote with a second owner present succeeds, demote of sole owner fails; `remove_member` self-leave and owner-removes-member, pointer moved/nulled; `listUserHouseholds`-shaped query returns all memberships with names (own-roles + member households policies). Policy sweep: iterate every policy in the fixture whose qual calls a helper and assert `pg_get_expr` contains `auth.uid()` as first argument (regex over the real migration files in the repo too, so a future policy passing another uid fails CI). Migration idempotence: apply twice, no error. Backfill: seeded profile-pointer-without-role user gains a 'member' role, never 'owner'; second run inserts zero.

7.4 Frontend unit (`membership-rpc.test.ts`, mocked supabase client): PGRST202 / 404 / 42883 / message form each trigger the legacy path once and memoise; a `last_owner` or 42501 error is rethrown and legacy NOT called; success returns RPC result and never calls legacy; per-RPC memo independent. A static test asserts no source file outside `*Legacy` functions writes `profiles.household_id` or `user_roles` through `.from(...)`.

Deterministic gate: `npx vitest run src/test/tenancy src/test/edge` then repo typecheck, lint, build.

## 8. Failure modes

| Failure | Behaviour |
|---|---|
| RPC timeout / network | Client throws; toast; no partial state since each RPC is one transaction. Retrying is safe (all four idempotent). Client retry: at most one automatic retry with 500 ms backoff on network error only, never on 4xx/42501. |
| Double click / double accept | Row lock + `on conflict do nothing` + accepted-and-member short circuit return the same household. |
| Concurrent demotion of two owners | Serialised by owner-row lock; second fails `last_owner`. |
| Migration applied, frontend old | Section 6.1 breakage window for invite flow only. |
| Backfill skipped / user without role row | `get_user_household_id` returns NULL: user sees an empty app (fail closed). Runbook Q4/Q5 prevent it; fix is the backfill INSERT. |
| Invitee's account email unconfirmed | `invitation_unavailable`; resolved by confirming the email. [A] production accounts are confirmed (Q7). |
| Fallback misfires | Fallback fires only on "function not found" signals; after migration those never occur. |
| Policy name drift in live DB (U1) | `drop policy if exists` leaves an unknown-named permissive policy standing; runbook Q1 enumerates live policies, and a post-apply check proves each negative test live. |

## 9. Blast radius

Untouched: all ~108 data-table policies and their tables, edge functions (service role bypasses RLS; stripe-webhook, ai functions, SEC `_shared`), UI components other than the two call sites' error handling, `create_household` body, Stripe/billing, desk module. Touched: `household-queries.ts` (membership functions only), HouseholdSettings and AcceptInvitation (error message mapping only), `types.ts`, new migration, new tests. If requirements change: swapping the membership source (e.g. to a `memberships` table) is confined to the three helper bodies plus the RPC bodies. Known limitations left: fetchHouseholdMembers lists members by active pointer (a member whose active household is another one is not listed), invitations never expire (no `expires_at` column) [A, Later], F7, `send-household-invite` bug.

## 10. Rollback

Manual, Jay-run, reverse order; no data lost because only policies/functions/triggers/one index change and the backfilled rows are harmless:
```sql
drop function if exists public.accept_invitation(text), public.switch_active_household(uuid),
  public.set_member_role(uuid, uuid, public.app_role), public.remove_member(uuid, uuid), public.auth_verified_email();
drop trigger if exists profiles_guard_household on public.profiles;
drop trigger if exists profiles_guard_household_insert on public.profiles;
drop index if exists public.profiles_stripe_customer_id_key;
-- restore helper bodies from 20260620000000 lines 83-121 (re-apply create or replace; keep the SEC search_path pin)
-- recreate the dropped policies from 20260620000000 (user_roles insert/ALL, profiles owner update) and 20260620000007 (invitations invitee)
```
Frontend rollback: revert the PR; legacy writes work again once policies are restored. Rolling back policies reopens F1-F3; do it only to recover from lockout, then re-apply after fixing data.

## 11. Production runbook for Jay (read-only first)

MANDATORY pre-apply read-only checks (do all four before applying; stop on any surprise):

T1. Forged-membership review. The backfill (S0) turns every profile pointer into a member role, so a forged pointer would be legitimised unless removed first.
  a) `select r.user_id, u.email, r.household_id, h.name, r.role, r.created_at, exists (select 1 from invitations i where i.household_id = r.household_id and lower(i.email) = lower(u.email) and i.status = 'accepted') as has_accepted_invite from user_roles r join auth.users u on u.id = r.user_id join households h on h.id = r.household_id order by r.household_id, r.created_at;`
  b) `select p.id, p.email, p.household_id from profiles p where p.household_id is not null and not exists (select 1 from invitations i where i.household_id = p.household_id and lower(i.email) = lower(p.email) and i.status = 'accepted') and p.id is distinct from (select r.user_id from user_roles r where r.household_id = p.household_id and r.role = 'owner' order by r.created_at limit 1);`
  Every row must be a person you know. Delete suspect rows in the SQL editor BEFORE applying (a forged user_roles row: `delete from user_roles where user_id='<uuid>' and household_id='<uuid>';` and clear the pointer: `update profiles set household_id = null where id='<uuid>';`). Do not apply until the lists are clean.
T2. Run Q1 and compare the policy names exactly with those named in section 3.1. The migration ends with a drift guard that fails (and rolls back) if a differently named policy still binds invitations to profiles, writes user_roles, or matches "Owners can manage profiles"; drop the named offender and re-apply.
T3. Supabase Dashboard, Authentication, Providers, Email: confirm "Confirm email" is ON. Invitations bind to the verified email; with it OFF an attacker can sign up with someone else's address.
T6. Run Q8 (stripe duplicates). After applying, confirm the index exists: `select indexname from pg_indexes where indexname = 'profiles_stripe_customer_id_key';` (absent means duplicates were skipped; resolve by hand).

Q1. Policies: `select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_policies where tablename in ('profiles','households','user_roles','invitations') order by 2,3;` Confirm no other write policy on user_roles/invitations than those named above (U1).
Q2. Grants: `select grantee, privilege_type from information_schema.role_table_grants where table_name='user_roles' and grantee in ('anon','authenticated');`
Q3. Function config and ownership: `select p.proname, pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig from pg_proc p where p.proname in ('get_user_household_id','is_household_member','has_household_role','create_household','is_admin');` Expect owner postgres, secdef true, proconfig search_path set (SEC). Also `select pg_get_functiondef('public.is_admin()'::regprocedure);` (U3: body never in migrations).
Q4. Pointer without role (would be locked out without backfill): `select p.id, p.email, p.household_id from profiles p where p.household_id is not null and not exists (select 1 from user_roles r where r.user_id=p.id and r.household_id=p.household_id);` Review the list: every row should be a person you know; unknown emails mean F1 may have been exploited, handle before applying.
Q5. Role without household / orphan: `select r.* from user_roles r left join households h on h.id=r.household_id where h.id is null;` (expect none, FK).
Q6. Ownerless households: `select h.id, h.name from households h where not exists (select 1 from user_roles r where r.household_id=h.id and r.role='owner');` After applying, promote an owner by hand for any returned household: `update user_roles set role='owner' where user_id='<uuid>' and household_id='<uuid>';`
Q7. Unconfirmed emails among real users: `select id, email from auth.users where email_confirmed_at is null;` Confirm each before they need to accept an invite.
Q8. Stripe duplicates: `select stripe_customer_id, count(*) from profiles where stripe_customer_id is not null group by 1 having count(*)>1;` Resolve by hand if any; migration then creates the index on a later re-run of section S8 only.
Q9. Cross-tenant surprises (F1 evidence): `select household_id, count(*) from profiles group by 1 order by 2 desc;` look for households with unexpected members.

Apply order: frontend merged and deployed -> Q1-Q9 -> apply SEC migration if not yet applied -> apply TEN migration (backfill runs inside, section S0) -> smoke: (a) log in, dashboard shows data; (b) invite a second test account, accept it; (c) switch household; (d) change role, try demoting the sole owner (must refuse); (e) in SQL editor impersonating a non-member `select count(*) from bills` returns 0. Stop and run rollback only if (a) fails for real users.

## 12. Hard Stops and risks

Hard Stops: none triggered by the build (all additive; no destructive migration; no credential changes). Applying to production, the backfill data write, and any owner promotion are Jay-run actions.
Risks: R1 live policy names differ from migrations (mitigated by Q1); R2 users with pointer but no role are locked out if backfill is skipped (S0 inside migration); R3 migration chain not replayable so verification is on pglite fixtures plus live smoke; R4 unconfirmed-email invitees; R5 `auth.role()` availability: Supabase provides it, the harness defines it.
