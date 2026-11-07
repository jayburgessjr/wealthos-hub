import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const MIGRATION_PATH = resolve(__dirname, '../../../supabase/migrations/20261107000000_desk_core.sql');
export const HARDENING_PATH = resolve(__dirname, '../../../supabase/migrations/20261110000000_desk_hardening.sql');
export const MULTI_OWNER_PATH = resolve(__dirname, '../../../supabase/migrations/20261108000000_desk_multi_owner.sql');
export const OWNER = '11111111-1111-1111-1111-111111111111';
export const OTHER = '22222222-2222-2222-2222-222222222222';

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
`;

export interface Harness {
  db: PGlite;
  /** run SQL as an API-style caller; uid simulates request.jwt.claim.sub (null = service role style) */
  q: (caller: Caller, uid: string | null, sql: string) => Promise<Record<string, unknown>[]>;
  seedProposal: (over?: Record<string, string>) => Promise<string>;
  approve: (poId: string, over?: Record<string, string>, uid?: string, opts?: { marker?: boolean }) => Promise<string>;
  /** Writes the server-side 'check_passed' marker the approval guard requires (what desk-approve-order does after the engine passes). */
  writeRiskMarker: (poId: string, over?: { inputHash?: string; qty?: string }) => Promise<void>;
  insertOrder: (approvalId: string, poId: string, over?: Record<string, string>) => Promise<Record<string, unknown>[]>;
  instrumentId: string;
}

export async function makeHarness(): Promise<Harness> {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  await db.exec(readFileSync(MIGRATION_PATH, 'utf8'));
  await db.exec(readFileSync(MULTI_OWNER_PATH, 'utf8'));
  await db.exec(readFileSync(HARDENING_PATH, 'utf8'));
  await db.exec(`
    insert into auth.users(id, email) values ('${OWNER}', 'owner@example.test'), ('${OTHER}', 'other@example.test');
    insert into public.desk_owner(user_id) values ('${OWNER}');
    insert into public.desk_instruments(symbol, asset_class) values ('AAPL', 'equity');
  `);
  const instrumentId = (await db.query<{ id: string }>(`select id from public.desk_instruments`)).rows[0].id;

  const q: Harness['q'] = async (caller, uid, sql) => {
    await db.exec(`reset role; set role ${caller}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
    try {
      return (await db.query<Record<string, unknown>>(sql)).rows;
    } finally {
      await db.exec('reset role');
    }
  };

  const seedProposal: Harness['seedProposal'] = async (over = {}) => {
    const c = {
      side: "'buy'", qty: '10', order_type: "'limit'", limit_price: '100', stop_price: '95', target_price: '110',
      ...over,
    };
    const rows = await q('service_role', null,
      `insert into public.desk_proposed_orders(instrument_id, agent_name, side, qty, order_type, limit_price, stop_price, target_price)
       values ('${instrumentId}', 'momentum', ${c.side}, ${c.qty}, ${c.order_type}, ${c.limit_price}, ${c.stop_price}, ${c.target_price})
       returning id`);
    return rows[0].id as string;
  };

  const writeRiskMarker: Harness['writeRiskMarker'] = async (poId, over = {}) => {
    await db.exec(
      `insert into public.desk_risk_events(event_type, proposed_order_id, actor, details)
       select 'check_passed', id, 'system:desk-approve-order',
              jsonb_build_object('inputHash', '${over.inputHash ?? 'hash'}', 'qty', ${over.qty ?? 'qty'}, 'stopPrice', stop_price,
                                 'limitPrice', limit_price, 'targetPrice', target_price)
         from public.desk_proposed_orders where id = '${poId}'`);
  };

  const approve: Harness['approve'] = async (poId, over = {}, uid = OWNER, opts = {}) => {
    if (opts.marker !== false) await writeRiskMarker(poId);
    const c = {
      decision: "'approved'", risk_passed: 'true', mode: "'paper'", decided_at: 'now()', ...over,
    };
    const rows = await q('authenticated', uid,
      `insert into public.desk_approvals(proposed_order_id, decision, risk_passed, risk_decision, risk_input_hash, mode, decided_by, decided_at)
       values ('${poId}', ${c.decision}, ${c.risk_passed}, '{}', 'hash', ${c.mode}, '${uid}', ${c.decided_at})
       returning id`);
    return rows[0].id as string;
  };

  const insertOrder: Harness['insertOrder'] = async (approvalId, poId, over = {}) => {
    const c = {
      qty: '10', stop_price: '95', side: "'buy'", intent: "'open'", mode: "'paper'", ...over,
    };
    return q('service_role', null,
      `insert into public.desk_orders(approval_id, proposed_order_id, instrument_id, mode, broker, client_order_id,
         intent, structure, side, qty, order_type, limit_price, stop_price, target_price)
       values ('${approvalId}', '${poId}', '${instrumentId}', ${c.mode}, 'paper', '${approvalId}',
         ${c.intent}, 'stock', ${c.side}, ${c.qty}, 'limit', 100, ${c.stop_price}, 110)
       returning id`);
  };

  return { db, q, seedProposal, approve, writeRiskMarker, insertOrder, instrumentId };
}
