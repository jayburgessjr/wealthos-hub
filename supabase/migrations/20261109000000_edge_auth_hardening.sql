-- Edge function auth hardening and AI cost controls (slice SEC). See docs/builds/edge-auth-hardening/ARCHITECTURE.md.
--
-- Additive. The ONLY drop of existing objects is the households INSERT policy (section 3, tightening to default deny).
-- No table or column is dropped. Product premise: no tiers, friends and family only.
--
-- Contents
--   1. ai_usage table + consume_usage / record_usage_tokens RPCs (per-user daily usage counters, A6)
--   2. search_path pins on SECURITY DEFINER functions (A7); ALTER only, no body or grant change
--   3. households INSERT policy removal (A7): authenticated gets no direct insert path
--   4. profiles: access_approved flag (one-time backfill) + guard trigger (A9)
--
-- Manual rollback (Needs Jay; not run by the build):
--   drop trigger if exists profiles_guard_insert on public.profiles;
--   drop function if exists public.profiles_guard_insert();
--   drop trigger if exists profiles_guard_privileged_cols on public.profiles;
--   drop function if exists public.profiles_guard_privileged_cols();
--   drop function if exists public.is_caller_admin();
--   alter table public.profiles drop column if exists access_approved;
--   drop function if exists public.record_usage_tokens(text, text, bigint, bigint);
--   drop function if exists public.consume_usage(text, text);
--   drop table if exists public.ai_usage;
--   (Restoring the old WITH CHECK (true) households policy is not recommended; create_household() needs no policy.)
--
-- Audit queries (A8), read-only, expect zero rows for the first:
--   select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
--   select polname from pg_policy
--    where polrelid = 'public.households'::regclass and polcmd = 'a';   -- expect: zero rows (no direct insert path)

-- ═════════════════════════════════════════════════════════════════════════
-- 1. Per-user usage counters (A6)
--    Authenticated users can READ their own rows and have NO write grant or policy. Counting happens only
--    through the two SECURITY DEFINER RPCs below, which key every row on auth.uid(). The cap itself lives in
--    the edge function (_shared/limits.ts), never in a client-controllable parameter.
-- ═════════════════════════════════════════════════════════════════════════

create table if not exists public.ai_usage (
  user_id    uuid    not null references auth.users(id) on delete cascade,
  day        date    not null default ((now() at time zone 'utc')::date),
  bucket     text    not null check (bucket in ('ai', 'data')),
  fn         text    not null check (char_length(fn) between 1 and 64),
  calls      integer not null default 0,
  tokens_in  bigint  not null default 0,
  tokens_out bigint  not null default 0,
  primary key (user_id, day, bucket, fn)
);

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.ai_usage from public, anon, authenticated;
grant select on public.ai_usage to authenticated;

-- Counts one call for the caller and returns today's total for the bucket (all functions combined).
-- SECURITY DEFINER because authenticated has no write grant on ai_usage; an invoker function would need
-- INSERT/UPDATE grants and policies, which would let users zero their own counters.
create or replace function public.consume_usage(p_bucket text, p_fn text)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  uid   uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  total integer;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_bucket is null or p_bucket not in ('ai', 'data') then
    raise exception 'Invalid bucket' using errcode = '22023';
  end if;

  insert into public.ai_usage as u (user_id, day, bucket, fn, calls)
  values (uid, today, p_bucket, p_fn, 1)
  on conflict (user_id, day, bucket, fn) do update set calls = u.calls + 1;

  select coalesce(sum(calls), 0)::integer into total
    from public.ai_usage
   where user_id = uid and day = today and bucket = p_bucket;
  return total;
end;
$$;

-- Best-effort token bookkeeping. Negative values are clamped to 0.
create or replace function public.record_usage_tokens(p_bucket text, p_fn text, p_in bigint, p_out bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  uid   uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  v_in  bigint := least(greatest(coalesce(p_in, 0), 0), 1000000000);
  v_out bigint := least(greatest(coalesce(p_out, 0), 0), 1000000000);
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_bucket is null or p_bucket not in ('ai', 'data') then
    raise exception 'Invalid bucket' using errcode = '22023';
  end if;

  insert into public.ai_usage as u (user_id, day, bucket, fn, calls, tokens_in, tokens_out)
  values (uid, today, p_bucket, p_fn, 0, v_in, v_out)
  on conflict (user_id, day, bucket, fn)
  do update set tokens_in = u.tokens_in + v_in, tokens_out = u.tokens_out + v_out;
end;
$$;

revoke execute on function public.consume_usage(text, text) from public, anon, authenticated;
revoke execute on function public.record_usage_tokens(text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.consume_usage(text, text) to authenticated;
grant execute on function public.record_usage_tokens(text, text, bigint, bigint) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- 2. Pin search_path on SECURITY DEFINER functions (A7)
--    ALTER FUNCTION ... SET only: no body change and no grant change, so the 0523 REVOKEs are preserved.
--    Each block is skipped when a function or type is absent, so the migration converges on drifted databases.
-- ═════════════════════════════════════════════════════════════════════════

do $$ begin alter function public.handle_new_user() set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.create_household(text, numeric) set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.is_household_member(uuid, uuid) set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.has_household_role(uuid, uuid, public.app_role) set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.get_user_household_id(uuid) set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.sync_debt_from_bill() set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.sync_bill_from_debt() set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.sync_bill_from_goal() set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.sync_goal_from_bill() set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.get_bill_paid_amount(uuid) set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;
do $$ begin alter function public.get_bill_status(uuid) set search_path = public, pg_catalog;
exception when undefined_function or undefined_object then null; end $$;

-- ═════════════════════════════════════════════════════════════════════════
-- 3. households INSERT policy (A7)
--    20260620000000 (dated after the 0523 hardening) re-created this policy as WITH CHECK (true) with no role,
--    so by file order any signed-in user could insert households directly. Remove it: with RLS enabled and no
--    INSERT policy, authenticated has no direct insert path (default deny). create_household() is SECURITY
--    DEFINER and runs as its owner (postgres, which bypasses RLS), and no client inserts into households directly.
--    This is the only DROP of an existing object here.
-- ═════════════════════════════════════════════════════════════════════════

drop policy if exists "Users can create households" on public.households;

-- ═════════════════════════════════════════════════════════════════════════
-- 4. profiles: approval flag (invite-only gate) and privileged-column guard (A9)
--    Any user could PATCH their own profile row (policy has no column restriction), including is_admin.
--    The guard blocks anon/authenticated callers from changing privileged columns; service_role and the
--    table owner (SQL editor, SECURITY DEFINER functions, webhook) pass. Existing admins pass too, because
--    the Admin page legitimately edits other users' plan and admin flags.
-- ═════════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists access_approved boolean not null default false;

-- One-time grandfathering: every account that exists when this migration runs keeps working.
-- New signups after this point default to false until approved:
--   update public.profiles set access_approved = true where email = 'friend@example.com';
update public.profiles set access_approved = true where access_approved = false;

-- Reports whether the calling user is an admin. SECURITY DEFINER so it reads profiles without RLS recursion.
create or replace function public.is_caller_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

revoke execute on function public.is_caller_admin() from public, anon, authenticated;
grant execute on function public.is_caller_admin() to authenticated;

create or replace function public.profiles_guard_privileged_cols()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.is_admin is distinct from old.is_admin
       or new.access_approved is distinct from old.access_approved
       or new.subscription_plan is distinct from old.subscription_plan
       or new.subscription_status is distinct from old.subscription_status
       -- stripe-checkout links the Stripe customer once (NULL -> value) as the user; changing it later is blocked.
       or (new.stripe_customer_id is distinct from old.stripe_customer_id and old.stripe_customer_id is not null)
    then
      if not public.is_caller_admin() then
        raise exception 'insufficient privilege to change protected profile columns' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- INSERT path: the existing "Users can insert their own profile" policy lets a user with no profile row post
-- {id: self, is_admin: true, access_approved: true}. For anon/authenticated callers, force every privileged
-- column to its safe default (neutralize rather than raise, so a legitimate client-side profile insert still
-- works). service_role / table owner (handle_new_user, SQL editor) are unaffected. For INSERT ... ON CONFLICT
-- DO UPDATE the neutralized row then flows through the UPDATE guard above, which rejects any change.
create or replace function public.profiles_guard_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.is_admin := false;
    new.access_approved := false;
    new.stripe_customer_id := null;
    new.subscription_plan := 'free';
    new.subscription_status := 'none';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_insert on public.profiles;
create trigger profiles_guard_insert
  before insert on public.profiles
  for each row execute function public.profiles_guard_insert();

drop trigger if exists profiles_guard_privileged_cols on public.profiles;
create trigger profiles_guard_privileged_cols
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_cols();
