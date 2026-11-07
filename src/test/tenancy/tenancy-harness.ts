// pglite fixture for the tenancy-hardening migration (slice TEN). Follows src/test/edge/edge-harness.ts.
// The repo's full migration history cannot be replayed, so the fixture replays the REAL migration files that define
// the objects under test (no hand-retyped policies or functions): 20260620000000 (profiles/households/user_roles
// policies, the three helpers), ...05 (owner profile update), ...06 (create_household), ...07 (invitations, bills),
// the section-7 policy rewrite DO block of 20260523120000, then the SEC migration, then the TEN migration.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIG = resolve(__dirname, '../../../supabase/migrations');
export const F = {
  base: '20260620000000_eb78dad0-e829-4506-8ba7-fbe935bd3a76.sql',
  ownerProfiles: '20260620000005_profiles_owner_update.sql',
  createHousehold: '20260620000006_create_household_rpc.sql',
  invitations: '20260620000007_23319747-a48b-462a-96f5-49135b640a70.sql',
  rls0523: '20260523120000_harden_rls_defense_in_depth.sql',
  sec: '20261109000000_edge_auth_hardening.sql',
  ten: '20261111000000_tenancy_hardening.sql',
} as const;

export const TEN_PATH = resolve(MIG, F.ten);
export const readMigration = (name: string): string => readFileSync(resolve(MIG, name), 'utf8');

export const OA = 'a0a0a0a0-0000-0000-0000-00000000000a'; // owner of household A
export const OB = 'b0b0b0b0-0000-0000-0000-00000000000b'; // owner of household B
export const MB = 'b1b1b1b1-0000-0000-0000-00000000000b'; // member of household B
export const DRIFT = 'd0d0d0d0-0000-0000-0000-0000000000d1'; // profile pointer to A, no role row (backfill target)
export const U1 = '11111111-1111-1111-1111-111111111111'; // attacker, no household
export const U2 = '22222222-2222-2222-2222-222222222222'; // legitimate invitee (verified email)
export const U3 = '33333333-3333-3333-3333-333333333333'; // unverified account
export const HA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const HB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const TOKEN = 'tok-for-u2-into-a';

export type Caller = 'postgres' | 'anon' | 'authenticated' | 'service_role';

const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
-- Supabase default privileges: new tables and functions are granted to the API roles
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

// Columns that later migrations add to profiles and the SEC migration relies on (not under test here).
const PROFILE_COLUMNS = `
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists subscription_status text default 'none';
alter table public.profiles add column if not exists subscription_plan text default 'free';
`;

/** The section-7 rewrite loop of 0523 (re-creates policies with (select auth.uid()) and explicit TO clauses). */
export function extract0523PolicyRewrite(): string {
  const sql = readMigration(F.rls0523);
  const m = sql.match(/DO \$migration\$[\s\S]*?\$migration\$;/);
  if (!m) throw new Error('0523 section 7 DO block not found; migration renamed or restructured');
  return m[0];
}

export interface TenancyHarness {
  db: PGlite;
  q: (caller: Caller, uid: string | null, sql: string) => Promise<Record<string, unknown>[]>;
  tenSql: string;
}

const SEED = `
insert into auth.users(id, email, email_confirmed_at) values
  ('${OA}', 'oa@example.test', now()), ('${OB}', 'ob@example.test', now()), ('${MB}', 'mb@example.test', now()),
  ('${DRIFT}', 'drift@example.test', now()), ('${U1}', 'u1@example.test', now()),
  ('${U2}', 'u2@example.test', now()), ('${U3}', 'u3@example.test', null);
insert into public.households(id, name) values ('${HA}', 'House A'), ('${HB}', 'House B');
-- the real on_auth_user_created trigger (0000) already created a bare profile per user above
insert into public.profiles(id, display_name, email, household_id) values
  ('${OA}', 'OA', 'oa@example.test', '${HA}'), ('${OB}', 'OB', 'ob@example.test', '${HB}'),
  ('${MB}', 'MB', 'mb@example.test', '${HB}'), ('${DRIFT}', 'Drift', 'drift@example.test', '${HA}'),
  ('${U1}', 'U1', 'u1@example.test', null), ('${U2}', 'U2', 'u2@example.test', null),
  ('${U3}', 'U3', 'u3@example.test', null)
on conflict (id) do update set display_name = excluded.display_name, household_id = excluded.household_id;
insert into public.user_roles(user_id, household_id, role) values
  ('${OA}', '${HA}', 'owner'), ('${OB}', '${HB}', 'owner'), ('${MB}', '${HB}', 'member');
insert into public.bills(household_id, name, amount, due_date) values
  ('${HA}', 'bill-a', 10, current_date), ('${HB}', 'bill-b', 20, current_date);
insert into public.invitations(token, household_id, email, invited_by) values
  ('${TOKEN}', '${HA}', 'u2@example.test', '${OA}'),
  ('tok-for-u3-into-a', '${HA}', 'u3@example.test', '${OA}');
`;

/** Pre-migration exploitable state is seeded BEFORE SEC/TEN run so the backfill and guards are exercised. */
export async function makeTenancyHarness(opts: { applyTen?: boolean; seed?: string } = {}): Promise<TenancyHarness> {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const f of [F.base, F.ownerProfiles, F.createHousehold, F.invitations]) await db.exec(readMigration(f));
  await db.exec(PROFILE_COLUMNS);
  await db.exec(extract0523PolicyRewrite());
  await db.exec('grant all on all tables in schema public to anon, authenticated, service_role');
  await db.exec(SEED);
  if (opts.seed) await db.exec(opts.seed);
  await db.exec(readMigration(F.sec));
  const tenSql = readMigration(F.ten);
  if (opts.applyTen !== false) await db.exec(tenSql);

  const q: TenancyHarness['q'] = async (caller, uid, sql) => {
    const claimRole = caller === 'postgres' ? '' : caller;
    await db.exec(
      `reset role; set role ${caller}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false), set_config('request.jwt.claim.role', '${claimRole}', false);`,
    );
    try {
      return (await db.query<Record<string, unknown>>(sql)).rows;
    } finally {
      await db.exec('reset role');
    }
  };
  return { db, q, tenSql };
}
