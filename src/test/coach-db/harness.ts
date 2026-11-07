// pglite fixture for the ai_coach migration (pattern of src/test/desk-db/harness.ts). Loads the REAL migration SQL.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const COACH_MIGRATION_PATH = resolve(__dirname, '../../../supabase/migrations/20261112000000_ai_coach.sql');
export const A = '11111111-1111-1111-1111-111111111111';
export const B = '22222222-2222-2222-2222-222222222222';

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
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create function public.update_updated_at_column() returns trigger language plpgsql as
  $$ begin new.updated_at = now(); return new; end $$;
`;

export interface CoachHarness {
  db: PGlite;
  q: (caller: Caller, uid: string | null, sql: string) => Promise<Record<string, unknown>[]>;
  migrationSql: string;
  /** call apply_strategy_update as uid with a JS payload */
  apply: (uid: string, payload: unknown) => Promise<Record<string, unknown>>;
}

export async function makeCoachHarness(): Promise<CoachHarness> {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  const migrationSql = readFileSync(COACH_MIGRATION_PATH, 'utf8');
  await db.exec(migrationSql);
  await db.exec(`insert into auth.users(id, email) values ('${A}', 'a@example.test'), ('${B}', 'b@example.test');`);
  const q: CoachHarness['q'] = async (caller, uid, sql) => {
    await db.exec(`reset role; set role ${caller}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
    try {
      return (await db.query<Record<string, unknown>>(sql)).rows;
    } finally {
      await db.exec('reset role');
    }
  };
  const apply: CoachHarness['apply'] = async (uid, payload) => {
    const json = JSON.stringify(payload).replace(/'/g, "''");
    const rows = await q('authenticated', uid, `select public.apply_strategy_update('${json}'::jsonb) r`);
    return rows[0].r as Record<string, unknown>;
  };
  return { db, q, migrationSql, apply };
}
