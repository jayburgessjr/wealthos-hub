// pglite fixture for the edge-auth-hardening migration (follows src/test/desk-db/harness.ts).
// The repo's full migration history cannot be replayed in pglite (it was assembled outside plain SQL), so this
// fixture recreates the PRE-migration shape of just the objects the migration touches: profiles, households,
// user_roles, the unpinned SECURITY DEFINER functions, and the weak households INSERT policy.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const MIGRATION_PATH = resolve(__dirname, '../../../supabase/migrations/20261109000000_edge_auth_hardening.sql');
export const U1 = '11111111-1111-1111-1111-111111111111';
export const U2 = '22222222-2222-2222-2222-222222222222';
export const ADMIN = '33333333-3333-3333-3333-333333333333';

export type Caller = 'postgres' | 'anon' | 'authenticated' | 'service_role';

const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- mimic Supabase default privileges so the migration must revoke what it does not want
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create type public.app_role as enum ('owner', 'member');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  household_id uuid,
  stripe_customer_id text,
  subscription_status text default 'none',
  subscription_plan text default 'free',
  is_admin boolean default false,
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
-- fixture helper (definer, avoids policy recursion in the fixture); mirrors the admin policies of 20260331090000
create function public.fx_is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
create policy "Admins can view all profiles" on public.profiles for select using (public.fx_is_admin());
create policy "Admins can update all profiles" on public.profiles for update using (public.fx_is_admin());

create table public.households (id uuid primary key default gen_random_uuid(), name text, monthly_income numeric default 0);
alter table public.households enable row level security;
-- the weak policy as re-created by 20260620000000: WITH CHECK (true), no role
create policy "Users can create households" on public.households for insert with check (true);

create table public.user_roles (
  user_id uuid not null, household_id uuid not null, role public.app_role not null,
  primary key (user_id, household_id)
);
alter table public.user_roles enable row level security;

-- Pre-migration (unpinned) definer functions, signatures copied from the real migrations.
create function public.handle_new_user() returns trigger language plpgsql security definer as $$ begin return new; end $$;
create function public.create_household(name text, monthly_income numeric) returns uuid
  language plpgsql security definer as $$
declare uid uuid := auth.uid(); hid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.households (name, monthly_income) values (coalesce(nullif(name, ''), 'Household'), coalesce(monthly_income, 0)) returning id into hid;
  update public.profiles set household_id = hid where id = uid;
  insert into public.user_roles (user_id, household_id, role) values (uid, hid, 'owner');
  return hid;
end $$;
create function public.is_household_member(_user_id uuid, _household_id uuid) returns boolean language sql stable security definer as $$ select false $$;
create function public.has_household_role(_user_id uuid, _household_id uuid, _role public.app_role) returns boolean language sql stable security definer as $$ select false $$;
create function public.get_user_household_id(_user_id uuid) returns uuid language sql stable security definer as $$ select household_id from public.profiles where id = _user_id $$;
create function public.sync_debt_from_bill() returns trigger language plpgsql security definer as $$ begin return new; end $$;
create function public.sync_bill_from_debt() returns trigger language plpgsql security definer as $$ begin return new; end $$;
create function public.sync_bill_from_goal() returns trigger language plpgsql security definer as $$ begin return new; end $$;
create function public.sync_goal_from_bill() returns trigger language plpgsql security definer as $$ begin return new; end $$;
create function public.get_bill_paid_amount(bill_uuid uuid) returns numeric language sql security definer as $$ select 0::numeric $$;
create function public.get_bill_status(bill_uuid uuid) returns text language sql security definer as $$ select 'unpaid'::text $$;
`;

/** Every function the migration must pin (A7), as regprocedure signatures. */
export const PINNED_FUNCTIONS = [
  'public.handle_new_user()',
  'public.create_household(text, numeric)',
  'public.is_household_member(uuid, uuid)',
  'public.has_household_role(uuid, uuid, public.app_role)',
  'public.get_user_household_id(uuid)',
  'public.sync_debt_from_bill()',
  'public.sync_bill_from_debt()',
  'public.sync_bill_from_goal()',
  'public.sync_goal_from_bill()',
  'public.get_bill_paid_amount(uuid)',
  'public.get_bill_status(uuid)',
];

export interface EdgeHarness {
  db: PGlite;
  q: (caller: Caller, uid: string | null, sql: string) => Promise<Record<string, unknown>[]>;
  migrationSql: string;
}

/** Profiles for U1, U2 and ADMIN exist BEFORE the migration runs, so the backfill is exercised. */
export async function makeEdgeHarness(): Promise<EdgeHarness> {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  await db.exec(`
    insert into auth.users(id, email) values ('${U1}', 'u1@example.test'), ('${U2}', 'u2@example.test'), ('${ADMIN}', 'admin@example.test');
    insert into public.profiles(id, email, is_admin) values ('${U1}', 'u1@example.test', false), ('${U2}', 'u2@example.test', false), ('${ADMIN}', 'admin@example.test', true);
  `);
  const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');
  await db.exec(migrationSql);

  const q: EdgeHarness['q'] = async (caller, uid, sql) => {
    await db.exec(`reset role; set role ${caller}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
    try {
      return (await db.query<Record<string, unknown>>(sql)).rows;
    } finally {
      await db.exec('reset role');
    }
  };
  return { db, q, migrationSql };
}
