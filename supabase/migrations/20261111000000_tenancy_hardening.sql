-- Server-controlled household membership and invite flow (slice TEN).
-- See docs/builds/tenancy-hardening/ARCHITECTURE.md. Findings F1-F8 in the tenancy audit.
--
-- Additive. No table or column is dropped. Policy drops are security tightening (listed in the rollback block).
-- The only data write is the S0 backfill: an additive INSERT of 'member' roles. Product premise: friends and
-- family, no tiers. Independent of the SEC migration 20261109000000 (own triggers, does not replace its functions).
--
-- Contents
--   S0  backfill missing user_roles rows from profiles.household_id (member only, never owner)
--   S1  auth_verified_email()                      (F3: invitations bind to the verified auth.users email)
--   S2  profiles.household_id guards                (F1)
--   S3  user_roles: no client writes                (F2)
--   S4  invitations: verified-email binding         (F3, F6)
--   S5  membership helpers answer only for caller   (F4)
--   S6  households policies TO authenticated        (F8)
--   S7  create_household EXECUTE hygiene            (F6)
--   S8  unique stripe_customer_id, if clean         (F5)
--   S9  RPCs: accept_invitation, switch_active_household, set_member_role, remove_member
--   F7 (members read each other's billing columns) is deferred; see CHECKLIST.md.
--
-- Manual rollback (Needs Jay; not run by the build). Rolling back reopens F1-F3; use only to recover from lockout:
--   drop function if exists public.accept_invitation(text), public.switch_active_household(uuid),
--     public.set_member_role(uuid, uuid, public.app_role), public.remove_member(uuid, uuid), public.auth_verified_email();
--   drop trigger if exists profiles_guard_household on public.profiles;
--   drop trigger if exists profiles_guard_household_insert on public.profiles;
--   drop function if exists public.profiles_guard_household(), public.profiles_guard_household_insert();
--   drop index if exists public.profiles_stripe_customer_id_key;
--   drop policy if exists user_roles_select_own on public.user_roles;
--   drop policy if exists invitations_select_invitee on public.invitations;
--   grant insert, update, delete on public.user_roles to authenticated;
--   -- restore helper bodies from 20260620000000 (keep the SEC search_path pin) and recreate the dropped policies
--   -- from 20260620000000 (user_roles insert/ALL), 20260620000005 (profiles owner update), 20260620000007 (invitations).

-- ═════════════════════════════════════════════════════════════════════════
-- S0. Backfill. Runs first so the stricter household helper (S5) cannot lock anyone out.
--     Least privilege: members only. Households left without an owner are promoted by hand (runbook Q6).
-- ═════════════════════════════════════════════════════════════════════════

insert into public.user_roles (user_id, household_id, role)
select p.id, p.household_id, 'member'
  from public.profiles p
 where p.household_id is not null
   and exists (select 1 from public.households h where h.id = p.household_id)
   and not exists (select 1 from public.user_roles r
                    where r.user_id = p.id and r.household_id = p.household_id)
on conflict do nothing;

-- ═════════════════════════════════════════════════════════════════════════
-- S1. Verified email of the caller. NULL for anonymous callers and unconfirmed emails. Not parameterised: no oracle.
-- ═════════════════════════════════════════════════════════════════════════

create or replace function public.auth_verified_email()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select lower(u.email)
    from auth.users u
   where u.id = (select auth.uid())
     and u.email_confirmed_at is not null
$$;

revoke execute on function public.auth_verified_email() from public, anon;
grant execute on function public.auth_verified_email() to authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- S2. profiles.household_id can only be set by server code (SECURITY DEFINER RPCs, service_role, SQL editor).
-- ═════════════════════════════════════════════════════════════════════════

create or replace function public.profiles_guard_household()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.household_id is distinct from old.household_id then
    raise exception 'insufficient privilege to change household membership' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.profiles_guard_household_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.household_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_household on public.profiles;
create trigger profiles_guard_household
  before update on public.profiles
  for each row execute function public.profiles_guard_household();

drop trigger if exists profiles_guard_household_insert on public.profiles;
create trigger profiles_guard_household_insert
  before insert on public.profiles
  for each row execute function public.profiles_guard_household_insert();

-- Owners edited members' profiles only to remove them; that is now remove_member().
drop policy if exists "Owners can manage profiles in their household" on public.profiles;

-- ═════════════════════════════════════════════════════════════════════════
-- S3. user_roles: no client write path. Membership changes only through the RPCs in S9.
-- ═════════════════════════════════════════════════════════════════════════

drop policy if exists "Users can insert their own role" on public.user_roles;
drop policy if exists "Owners can manage roles" on public.user_roles;
revoke insert, update, delete on public.user_roles from anon, authenticated;
-- TRUNCATE bypasses RLS and earlier hardening did not revoke it from the API roles.
revoke truncate, references, trigger
  on public.user_roles, public.invitations, public.profiles, public.households
  from public, anon, authenticated;

-- The household switcher lists every household the caller belongs to.
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ═════════════════════════════════════════════════════════════════════════
-- S4. invitations: readable by the inviting owners and the VERIFIED invitee; acceptance only via accept_invitation.
-- ═════════════════════════════════════════════════════════════════════════

drop policy if exists "Invited user can view their invitation" on public.invitations;
drop policy if exists "Invited user can accept invitation" on public.invitations;

drop policy if exists invitations_select_invitee on public.invitations;
create policy invitations_select_invitee on public.invitations
  for select to authenticated
  using (lower(email) = (select public.auth_verified_email()));

-- ═════════════════════════════════════════════════════════════════════════
-- S5. Membership helpers answer only for the caller (or service_role). Policies always pass auth.uid(), so every
--     legitimate evaluation is unchanged. Signatures, STABLE, SECURITY DEFINER and the SEC search_path pin are kept.
--     user_roles is the membership source; get_user_household_id additionally requires a matching role row.
-- ═════════════════════════════════════════════════════════════════════════

create or replace function public.get_user_household_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p.household_id
    from public.profiles p
   where p.id = _user_id
     and (_user_id = (select auth.uid()) or (select auth.role()) = 'service_role')
     and exists (select 1 from public.user_roles r
                  where r.user_id = p.id and r.household_id = p.household_id)
$$;

create or replace function public.has_household_role(_user_id uuid, _household_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.user_roles
     where user_id = _user_id
       and household_id = _household_id
       and role = _role
       and (_user_id = (select auth.uid()) or (select auth.role()) = 'service_role')
  )
$$;

create or replace function public.is_household_member(_user_id uuid, _household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.user_roles
     where user_id = _user_id
       and household_id = _household_id
       and (_user_id = (select auth.uid()) or (select auth.role()) = 'service_role')
  )
$$;

revoke execute on function public.get_user_household_id(uuid) from public, anon;
revoke execute on function public.has_household_role(uuid, uuid, public.app_role) from public, anon;
revoke execute on function public.is_household_member(uuid, uuid) from public, anon;
grant execute on function public.get_user_household_id(uuid) to authenticated, service_role;
grant execute on function public.has_household_role(uuid, uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_household_member(uuid, uuid) to authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════
-- S6. households: TO authenticated; read by membership (so the switcher can name every household), update by owner.
--     No INSERT policy (SEC): create_household() is the only creation path.
-- ═════════════════════════════════════════════════════════════════════════

drop policy if exists "Users can view their household" on public.households;
create policy "Users can view their household" on public.households
  for select to authenticated
  using (public.is_household_member((select auth.uid()), id));

drop policy if exists "Owners can update their household" on public.households;
create policy "Owners can update their household" on public.households
  for update to authenticated
  using (public.has_household_role((select auth.uid()), id, 'owner'))
  with check (public.has_household_role((select auth.uid()), id, 'owner'));

-- ═════════════════════════════════════════════════════════════════════════
-- S7. create_household: body unchanged; callable by signed-in users only. A user who already has a household may
--     create another (the switcher supports several); that touches nobody else's data.
-- ═════════════════════════════════════════════════════════════════════════

revoke execute on function public.create_household(text, numeric) from public, anon;
grant execute on function public.create_household(text, numeric) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- S8. One profile per Stripe customer. Skipped (with a notice) when duplicates exist; never fails the migration.
-- ═════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from public.profiles where stripe_customer_id is not null
              group by stripe_customer_id having count(*) > 1) then
    raise notice 'stripe_customer_id duplicates exist; unique index skipped, resolve by hand (runbook Q8)';
  else
    create unique index if not exists profiles_stripe_customer_id_key
      on public.profiles (stripe_customer_id) where stripe_customer_id is not null;
  end if;
end $$;

-- ═════════════════════════════════════════════════════════════════════════
-- S9. Membership RPCs. The caller is always auth.uid(); target user ids are authorised against the caller's
--     ownership. Error messages are fixed codes the client maps: invitation_unavailable, not_a_member,
--     not_owner, last_owner.
-- ═════════════════════════════════════════════════════════════════════════

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_inv   public.invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  v_email := public.auth_verified_email();

  select * into v_inv from public.invitations i where i.token = p_token for update;
  -- Missing token and wrong/unverified email are indistinguishable (no existence oracle).
  if not found or v_email is null or lower(v_inv.email) <> v_email then
    raise exception 'invitation_unavailable' using errcode = 'P0001';
  end if;

  if v_inv.status = 'accepted' then
    if exists (select 1 from public.user_roles r
                where r.user_id = v_uid and r.household_id = v_inv.household_id) then
      return v_inv.household_id;
    end if;
    raise exception 'invitation_unavailable' using errcode = 'P0001';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'invitation_unavailable' using errcode = 'P0001';
  end if;

  insert into public.user_roles (user_id, household_id, role)
  values (v_uid, v_inv.household_id, 'member')
  on conflict (user_id, household_id) do nothing;   -- never downgrades an existing owner

  update public.invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
  update public.profiles set household_id = v_inv.household_id where id = v_uid;
  return v_inv.household_id;
end;
$$;

create or replace function public.switch_active_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.user_roles r
                  where r.user_id = v_uid and r.household_id = p_household_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  update public.profiles set household_id = p_household_id where id = v_uid;
end;
$$;

create or replace function public.set_member_role(p_household_id uuid, p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid       uuid := auth.uid();
  v_owners    integer;
  v_is_owner  boolean;
  v_current   public.app_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_role is null then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  -- Lock the household's owner rows so concurrent demotions serialise (two owners cannot demote each other).
  select count(*)::integer, coalesce(bool_or(o.user_id = v_uid), false)
    into v_owners, v_is_owner
    from (select r.user_id from public.user_roles r
           where r.household_id = p_household_id and r.role = 'owner' for update) o;

  if not v_is_owner then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  select r.role into v_current from public.user_roles r
   where r.user_id = p_user_id and r.household_id = p_household_id;
  if not found then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if v_current = p_role then
    return;
  end if;
  if v_current = 'owner' and p_role = 'member' and v_owners <= 1 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;

  update public.user_roles set role = p_role
   where user_id = p_user_id and household_id = p_household_id;
end;
$$;

create or replace function public.remove_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid       uuid := auth.uid();
  v_owners    integer;
  v_is_owner  boolean;
  v_current   public.app_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select count(*)::integer, coalesce(bool_or(o.user_id = v_uid), false)
    into v_owners, v_is_owner
    from (select r.user_id from public.user_roles r
           where r.household_id = p_household_id and r.role = 'owner' for update) o;

  -- An owner may remove anyone in the household; anyone may remove themselves (leave household).
  if not (v_is_owner or p_user_id = v_uid) then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  select r.role into v_current from public.user_roles r
   where r.user_id = p_user_id and r.household_id = p_household_id;
  if not found then
    return;
  end if;
  if v_current = 'owner' and v_owners <= 1 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;

  delete from public.user_roles
   where user_id = p_user_id and household_id = p_household_id;

  -- Move the active-household pointer to another membership (lowest id) or clear it.
  update public.profiles
     set household_id = (select r.household_id from public.user_roles r
                          where r.user_id = p_user_id order by r.household_id limit 1)
   where id = p_user_id and household_id = p_household_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.switch_active_household(uuid) from public, anon;
revoke all on function public.set_member_role(uuid, uuid, public.app_role) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.switch_active_household(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.app_role) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- S10. Drift guard. Fails the whole migration (it rolls back) if a differently named live policy still gives a
--      client the old paths: invitations bound to profiles.email, a user_roles write policy, or the owner
--      profile-update policy. Resolve by dropping the offending policy (runbook Q1), then re-apply.
-- ═════════════════════════════════════════════════════════════════════════

do $$
declare
  v_bad text;
begin
  select string_agg(tablename || '/' || policyname, ', ') into v_bad
    from pg_policies
   where schemaname = 'public'
     and (
       (tablename = 'invitations'
         and (coalesce(qual, '') ilike '%profiles%' or coalesce(with_check, '') ilike '%profiles%'))
       or (tablename = 'user_roles' and cmd <> 'SELECT')
       or (tablename = 'profiles' and policyname ilike '%Owners can manage profiles%')
     );
  if v_bad is not null then
    raise exception 'tenancy drift guard: unexpected live policies remain: %', v_bad using errcode = 'P0001';
  end if;
end $$;
