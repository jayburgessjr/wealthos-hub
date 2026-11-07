// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, PINNED_FUNCTIONS, U1, U2, makeEdgeHarness, type EdgeHarness } from './edge-harness';
import { consumeUsage, recordTokens, type RpcClient } from '../../../supabase/functions/_shared/limits';

let h: EdgeHarness;
beforeAll(async () => {
  h = await makeEdgeHarness();
}, 60000);
afterAll(async () => { await h.db.close(); });

const clearHouseholds = () => h.db.exec(`delete from public.user_roles; delete from public.households; update public.profiles set household_id = null`);
const clearUsage = () => h.q('postgres', null, `delete from public.ai_usage`);
const calls = (uid: string, bucket = 'ai') =>
  h.q('postgres', null, `select coalesce(sum(calls),0)::int n from public.ai_usage where user_id='${uid}' and bucket='${bucket}'`).then((r) => r[0].n as number);

describe('ai_usage access control', () => {
  it('authenticated cannot INSERT, UPDATE or DELETE ai_usage directly', async () => {
    await expect(h.q('authenticated', U1, `insert into public.ai_usage(user_id, bucket, fn, calls) values ('${U1}','ai','x',1)`)).rejects.toThrow(/permission denied/i);
    await h.q('postgres', null, `insert into public.ai_usage(user_id, bucket, fn, calls) values ('${U1}','ai','seed',5)`);
    await expect(h.q('authenticated', U1, `update public.ai_usage set calls = 0 where user_id='${U1}'`)).rejects.toThrow(/permission denied/i);
    await expect(h.q('authenticated', U1, `delete from public.ai_usage where user_id='${U1}'`)).rejects.toThrow(/permission denied/i);
    await clearUsage();
  });

  it('authenticated sees only their own rows', async () => {
    await h.q('postgres', null, `insert into public.ai_usage(user_id, bucket, fn, calls) values ('${U1}','ai','a',1), ('${U2}','ai','a',9)`);
    const mine = await h.q('authenticated', U1, `select user_id from public.ai_usage`);
    expect(mine.map((r) => r.user_id)).toEqual([U1]);
    await clearUsage();
  });

  it('anon can neither read the table nor call the RPCs', async () => {
    await expect(h.q('anon', null, `select * from public.ai_usage`)).rejects.toThrow(/permission denied/i);
    await expect(h.q('anon', null, `select public.consume_usage('ai','x')`)).rejects.toThrow(/permission denied/i);
    await expect(h.q('anon', null, `select public.record_usage_tokens('ai','x',1,1)`)).rejects.toThrow(/permission denied/i);
  });

  it('the RPCs pin search_path and are SECURITY DEFINER', async () => {
    const rows = await h.q('postgres', null, `select proname, prosecdef, proconfig::text cfg from pg_proc where proname in ('consume_usage','record_usage_tokens')`);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.prosecdef).toBe(true);
      expect(String(r.cfg)).toContain('search_path=public, pg_catalog');
    }
  });

  it('has no write policy and no write grant for authenticated', async () => {
    const pol = await h.q('postgres', null, `select polcmd from pg_policy where polrelid='public.ai_usage'::regclass`);
    expect(pol.map((p) => p.polcmd)).toEqual(['r']);
    const g = await h.q('postgres', null, `select privilege_type from information_schema.role_table_grants where table_name='ai_usage' and grantee='authenticated'`);
    expect(g.map((x) => x.privilege_type)).toEqual(['SELECT']);
  });
});

describe('consume_usage', () => {
  it('increments atomically: 50 calls return 1..50 with no duplicates', async () => {
    const rows = await h.q('authenticated', U1, `select public.consume_usage('ai','ai-advisor') n from generate_series(1,50)`);
    const ns = rows.map((r) => r.n as number).sort((a, b) => a - b);
    expect(ns).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(await calls(U1)).toBe(50);
    await clearUsage();
  });

  it('keys by the caller: another user starts from 1', async () => {
    await h.q('authenticated', U1, `select public.consume_usage('ai','a'), public.consume_usage('ai','a')`);
    const r = await h.q('authenticated', U2, `select public.consume_usage('ai','a') n`);
    expect(r[0].n).toBe(1);
    expect(await calls(U1)).toBe(2);
    expect(await calls(U2)).toBe(1);
    await clearUsage();
  });

  it('has no way to name another user (signature takes no uid)', async () => {
    const r = await h.q('postgres', null, `select pg_get_function_arguments('public.consume_usage(text,text)'::regprocedure) a`);
    expect(String(r[0].a)).not.toMatch(/uid|user/i);
  });

  it('raises for a null uid', async () => {
    await expect(h.q('authenticated', null, `select public.consume_usage('ai','x')`)).rejects.toThrow(/Not authenticated/);
    await expect(h.q('service_role', null, `select public.consume_usage('ai','x')`)).rejects.toThrow(/Not authenticated/);
  });

  it('rejects an unknown bucket and an over-long function name', async () => {
    await expect(h.q('authenticated', U1, `select public.consume_usage('vip','x')`)).rejects.toThrow(/Invalid bucket/);
    await expect(h.q('authenticated', U1, `select public.consume_usage('ai','${'x'.repeat(65)}')`)).rejects.toThrow();
  });

  it('totals per bucket across functions, and buckets are separate', async () => {
    await h.q('authenticated', U1, `select public.consume_usage('ai','a'), public.consume_usage('ai','b')`);
    const ai = await h.q('authenticated', U1, `select public.consume_usage('ai','c') n`);
    const data = await h.q('authenticated', U1, `select public.consume_usage('data','a') n`);
    expect(ai[0].n).toBe(3);
    expect(data[0].n).toBe(1);
    await clearUsage();
  });

  it('rolls over by UTC day: yesterday does not count', async () => {
    await h.q('postgres', null, `insert into public.ai_usage(user_id, day, bucket, fn, calls) values ('${U1}', ((now() at time zone 'utc')::date - 1), 'ai', 'a', 999)`);
    const r = await h.q('authenticated', U1, `select public.consume_usage('ai','a') n`);
    expect(r[0].n).toBe(1);
    await clearUsage();
  });

  it('record_usage_tokens accumulates, clamps negatives, and is keyed to the caller', async () => {
    await h.q('authenticated', U1, `select public.consume_usage('ai','a')`);
    await h.q('authenticated', U1, `select public.record_usage_tokens('ai','a', 100, 50)`);
    await h.q('authenticated', U1, `select public.record_usage_tokens('ai','a', -5, -5)`);
    const row = await h.q('postgres', null, `select calls, tokens_in::int ti, tokens_out::int "to" from public.ai_usage where user_id='${U1}'`);
    expect(row).toEqual([{ calls: 1, ti: 100, to: 50 }]);
    await expect(h.q('authenticated', null, `select public.record_usage_tokens('ai','a',1,1)`)).rejects.toThrow(/Not authenticated/);
    await clearUsage();
  });
});

/** Runs the real consumeUsage/recordTokens helpers against the pglite RPCs as a given caller. */
const rpcAs = (uid: string | null): RpcClient => ({
  rpc: async (fn, args) => {
    const sql = `select public.${fn}(${Object.values(args).map((v) => (typeof v === 'number' ? v : `'${String(v)}'`)).join(',')}) as r`;
    try {
      const rows = await h.q('authenticated', uid, sql);
      return { data: rows[0].r, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  },
});

describe('consumeUsage cap behaviour against the real RPC', () => {
  it('is ok up to the cap and "limit" beyond it; counts keep rising', async () => {
    const c = rpcAs(U1);
    const out: string[] = [];
    for (let i = 0; i < 5; i++) out.push(await consumeUsage(c, 'ai', 'ai-advisor', 3));
    expect(out).toEqual(['ok', 'ok', 'ok', 'limit', 'limit']);
    // another user is unaffected by U1's exhaustion
    expect(await consumeUsage(rpcAs(U2), 'ai', 'ai-advisor', 3)).toBe('ok');
    await clearUsage();
  });

  it('fails closed when the RPC errors (null uid) and never throws', async () => {
    expect(await consumeUsage(rpcAs(null), 'ai', 'ai-advisor', 3)).toBe('error');
    expect(await consumeUsage({ rpc: () => Promise.reject(new Error('boom')) }, 'ai', 'x', 3)).toBe('error');
    expect(await consumeUsage({ rpc: async () => ({ data: 'NaN-ish', error: null }) }, 'ai', 'x', 3)).toBe('error');
  });

  it('recordTokens is best effort and never throws', async () => {
    await expect(recordTokens(rpcAs(null), 'ai', 'x', 1, 1)).resolves.toBeUndefined();
    await expect(recordTokens({ rpc: () => Promise.reject(new Error('boom')) }, 'ai', 'x', 1, 1)).resolves.toBeUndefined();
  });
});

describe('A7 search_path pins', () => {
  it.each(PINNED_FUNCTIONS)('%s has search_path pinned', async (sig) => {
    const r = await h.q('postgres', null, `select proconfig::text cfg from pg_proc where oid = '${sig}'::regprocedure`);
    expect(String(r[0].cfg)).toContain('search_path=public, pg_catalog');
  });
});

describe('A7 households INSERT policy', () => {
  it('is replaced by the stricter policy: authenticated role, auth.uid() is not null', async () => {
    const pol = await h.q('postgres', null, `select polname, polroles::regrole[]::text roles, pg_get_expr(polwithcheck, polrelid) chk from pg_policy where polrelid='public.households'::regclass and polcmd='a'`);
    expect(pol).toHaveLength(1);
    expect(String(pol[0].chk)).toMatch(/auth\.uid\(\)/);
    expect(String(pol[0].chk)).toMatch(/IS NOT NULL/i);
    expect(String(pol[0].roles)).toContain('authenticated');
    expect(String(pol[0].chk)).not.toBe('true');
  });

  it('create_household still works for a signed-in user', async () => {
    const r = await h.q('authenticated', U1, `select public.create_household('Home', 5000) id`);
    expect(r[0].id).toBeTruthy();
    await clearHouseholds();
  });

  it('direct insert with no uid fails, and anon is blocked', async () => {
    await expect(h.q('authenticated', null, `insert into public.households(name) values ('x')`)).rejects.toThrow(/row-level security/i);
    await expect(h.q('anon', null, `insert into public.households(name) values ('x')`)).rejects.toThrow(/row-level security|permission denied/i);
  });
});

describe('A9 profiles guard and approval flag', () => {
  it('backfill approved the rows that existed before the migration; new rows default to false', async () => {
    const old = await h.q('postgres', null, `select id, access_approved from public.profiles order by id`);
    expect(old.every((r) => r.access_approved === true)).toBe(true);
    await h.q('postgres', null, `insert into auth.users(id,email) values ('44444444-4444-4444-4444-444444444444','new@example.test')`);
    await h.q('postgres', null, `insert into public.profiles(id,email) values ('44444444-4444-4444-4444-444444444444','new@example.test')`);
    const fresh = await h.q('postgres', null, `select access_approved from public.profiles where id='44444444-4444-4444-4444-444444444444'`);
    expect(fresh[0].access_approved).toBe(false);
    await h.q('postgres', null, `delete from public.profiles where id='44444444-4444-4444-4444-444444444444'`);
  });

  it.each([
    ['is_admin', `is_admin = true`],
    ['access_approved', `access_approved = false`],
    ['subscription_plan', `subscription_plan = 'pro'`],
    ['subscription_status', `subscription_status = 'active'`],
  ])('authenticated user cannot self-change %s', async (_col, set) => {
    await expect(h.q('authenticated', U1, `update public.profiles set ${set} where id='${U1}'`)).rejects.toThrow(/protected profile columns|insufficient/i);
  });

  it('a user cannot self-approve (false -> true)', async () => {
    await h.q('postgres', null, `update public.profiles set access_approved = false where id='${U1}'`);
    await expect(h.q('authenticated', U1, `update public.profiles set access_approved = true where id='${U1}'`)).rejects.toThrow(/protected profile columns/i);
    await h.q('postgres', null, `update public.profiles set access_approved = true where id='${U1}'`);
  });

  it('raises SQLSTATE 42501', async () => {
    try {
      await h.q('authenticated', U1, `update public.profiles set is_admin = true where id='${U1}'`);
      throw new Error('should have raised');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('42501');
    }
  });

  it('stripe_customer_id can be linked once (NULL -> value) by the user but not changed afterwards', async () => {
    await h.q('authenticated', U2, `update public.profiles set stripe_customer_id = 'cus_1' where id='${U2}'`);
    await expect(h.q('authenticated', U2, `update public.profiles set stripe_customer_id = 'cus_victim' where id='${U2}'`)).rejects.toThrow(/protected profile columns/i);
    await h.q('postgres', null, `update public.profiles set stripe_customer_id = null where id='${U2}'`);
  });

  it('ordinary columns still update, including a no-op write to a protected column', async () => {
    await h.q('authenticated', U1, `update public.profiles set display_name = 'Jay' where id='${U1}'`);
    await h.q('authenticated', U1, `update public.profiles set is_admin = false, display_name = 'Jay2' where id='${U1}'`);
    const r = await h.q('postgres', null, `select display_name from public.profiles where id='${U1}'`);
    expect(r[0].display_name).toBe('Jay2');
  });

  it('service_role and the table owner can change protected columns', async () => {
    await h.q('service_role', null, `update public.profiles set subscription_plan = 'pro', subscription_status = 'active' where id='${U1}'`);
    await h.q('postgres', null, `update public.profiles set access_approved = false where id='${U1}'`);
    await h.q('postgres', null, `update public.profiles set access_approved = true, subscription_plan='free', subscription_status='none' where id='${U1}'`);
    const r = await h.q('postgres', null, `select access_approved from public.profiles where id='${U1}'`);
    expect(r[0].access_approved).toBe(true);
  });

  it("an existing admin (Admin page) can still change another user's plan and admin flag", async () => {
    await h.q('authenticated', ADMIN, `update public.profiles set subscription_plan = 'pro', is_admin = false where id='${U2}'`);
    const r = await h.q('postgres', null, `select subscription_plan from public.profiles where id='${U2}'`);
    expect(r[0].subscription_plan).toBe('pro');
    await h.q('postgres', null, `update public.profiles set subscription_plan = 'free' where id='${U2}'`);
  });

  it('create_household (definer) can still update profiles.household_id', async () => {
    const r = await h.q('authenticated', U2, `select public.create_household('H2', 1) id`);
    expect(r[0].id).toBeTruthy();
    await clearHouseholds();
  });
});

describe('A8 audit queries', () => {
  const AUDIT = `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`;
  it('finds no public table without RLS after the migration', async () => {
    expect(await h.q('postgres', null, AUDIT)).toEqual([]);
  });
  it('negative control: the audit does flag a table created without RLS', async () => {
    await h.q('postgres', null, `create table public.rogue_no_rls(id int)`);
    expect((await h.q('postgres', null, AUDIT)).map((r) => r.relname)).toEqual(['rogue_no_rls']);
    await h.db.exec('drop ' + 'table public.rogue_no_rls');
  });
});

describe('migration is additive', () => {
  it('only drops its own objects plus the one households policy', () => {
    const sql = h.migrationSql.replace(/--.*$/gm, '');
    const drops = [...sql.matchAll(/^\s*drop\s+(\w+)(?:\s+if\s+exists)?\s+("[^"]+"|[\w.]+)(?:\s+on\s+([\w.]+))?/gim)].map((m) => `${m[1].toLowerCase()} ${m[2]}${m[3] ? ' on ' + m[3] : ''}`);
    expect(drops.sort()).toEqual([
      'policy "Users can create households" on public.households',
      'policy ai_usage_select_own on public.ai_usage',
      'trigger profiles_guard_privileged_cols on public.profiles',
    ].sort());
    expect(sql).not.toMatch(/\bdrop\s+(table|column|schema|function|type)\b/i);
    expect(sql).not.toMatch(/\balter\s+table\b[^;]*\bdrop\b/i);
    expect(sql).not.toMatch(/\btruncate\b|\bdelete\s+from\b/i);
  });

  it('is re-runnable (idempotent) without error', async () => {
    await h.db.exec(h.migrationSql);
  });
});
