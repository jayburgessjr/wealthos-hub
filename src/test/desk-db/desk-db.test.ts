// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeHarness, MIGRATION_PATH, OTHER, OWNER, type Harness } from './harness';

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
}, 60_000);
afterEach(async () => {
  await h.db.close();
});

const DESK_TABLES = [
  'desk_owner', 'desk_state', 'desk_instruments', 'desk_agent_runs', 'desk_signals', 'desk_theses',
  'desk_proposed_orders', 'desk_approvals', 'desk_orders', 'desk_positions', 'desk_journal',
  'desk_scorecard', 'desk_risk_events',
];

async function backdate(approvalId: string, interval: string) {
  // decided_at is server-set now, so a stale approval can only be simulated by a superuser bypassing the guard trigger.
  await h.q('postgres', null, `alter table public.desk_approvals disable trigger trg_desk_approvals_guard`);
  await h.q('postgres', null, `update public.desk_approvals set decided_at = now() - interval '${interval}' where id = '${approvalId}'`);
  await h.q('postgres', null, `alter table public.desk_approvals enable trigger trg_desk_approvals_guard`);
}

describe('migration', () => {
  it('applies cleanly on an empty database and creates all 13 tables with RLS enabled and forced', async () => {
    const rows = await h.db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
        where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'desk\\_%'`);
    expect(rows.rows.map((r) => r.relname).sort()).toEqual([...DESK_TABLES].sort());
    for (const r of rows.rows) {
      expect(r.relrowsecurity, r.relname).toBe(true);
      expect(r.relforcerowsecurity, r.relname).toBe(true);
    }
  });

  it('is additive: no destructive statements and no reference to non-desk public objects', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8').replace(/--.*$/gm, '').toLowerCase();
    expect(sql).not.toMatch(/\bdrop\s+(table|column|schema|policy|trigger|function|view)\b/);
    expect(sql).not.toMatch(/(^|;)\s*truncate\s/m); // only the protection triggers and revokes may mention truncate
    expect(sql).not.toMatch(/\bdelete\s+from\b/);
    expect(sql).not.toMatch(/\balter\s+(role|system|database)\b/);
    const refs = [...sql.matchAll(/public\.([a-z_%]+)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(20);
    for (const r of refs) expect(r, r).toMatch(/^(desk_|is_desk_owner|%i)/);
    // DDL/DML targets
    for (const m of sql.matchAll(/\b(?:alter table|create table(?: if not exists)?|insert into|update(?=\s+public\.))\s+(?:only\s+)?([a-z_.%]+)/g)) {
      expect(m[1], m[0]).toMatch(/^(public\.(desk_|%i)|auth\.)/);
    }
  });

  it('does not grant anything to anon on desk tables, functions or the view', async () => {
    const grants = await h.db.query(
      `select table_name from information_schema.role_table_grants
        where grantee = 'anon' and table_schema = 'public' and table_name like 'desk\\_%'`);
    expect(grants.rows).toEqual([]);
    const fn = await h.db.query(
      `select has_function_privilege('anon', 'public.desk_reset_kill_switch(text)', 'execute') as a,
              has_function_privilege('anon', 'public.is_desk_owner()', 'execute') as b`);
    expect(fn.rows[0]).toEqual({ a: false, b: false });
  });
});

describe('approvals guard', () => {
  it('rejects an approval with a null uid (service role)', async () => {
    const po = await h.seedProposal();
    await expect(
      h.q('service_role', null,
        `insert into public.desk_approvals(proposed_order_id, decision, risk_passed, risk_decision, risk_input_hash, mode, decided_by)
         values ('${po}', 'approved', true, '{}', 'h', 'paper', '${OWNER}')`),
    ).rejects.toThrow(/owner session/);
    await expect(
      h.q('postgres', null,
        `insert into public.desk_approvals(proposed_order_id, decision, risk_passed, risk_decision, risk_input_hash, mode, decided_by)
         values ('${po}', 'approved', true, '{}', 'h', 'paper', '${OWNER}')`),
    ).rejects.toThrow(/owner session/);
  });

  it('rejects an approval from a non-owner, and one claiming another decided_by', async () => {
    const po = await h.seedProposal();
    await expect(h.approve(po, {}, OTHER)).rejects.toThrow();
    await expect(
      h.q('authenticated', OWNER,
        `insert into public.desk_approvals(proposed_order_id, decision, risk_passed, risk_decision, risk_input_hash, mode, decided_by)
         values ('${po}', 'approved', true, '{}', 'h', 'paper', '${OTHER}')`),
    ).rejects.toThrow();
  });

  it('owner approval moves the proposal to approved without tripping the proposal trigger', async () => {
    const po = await h.seedProposal();
    await h.approve(po);
    const r = await h.q('authenticated', OWNER, `select status from public.desk_proposed_orders where id = '${po}'`);
    expect(r[0].status).toBe('approved');
  });

  it('a failed-risk or rejected approval marks the proposal rejected and can never produce an order', async () => {
    const po = await h.seedProposal();
    const ap = await h.approve(po, { risk_passed: 'false' });
    const r = await h.q('authenticated', OWNER, `select status from public.desk_proposed_orders where id = '${po}'`);
    expect(r[0].status).toBe('rejected');
    await expect(h.insertOrder(ap, po)).rejects.toThrow(/no valid approval/);
  });

  it('only one decision per proposal', async () => {
    const po = await h.seedProposal();
    await h.approve(po);
    await expect(h.approve(po)).rejects.toThrow();
  });

  it('approvals are immutable (update, delete, even as postgres) and cannot be forged consumed', async () => {
    const po = await h.seedProposal();
    const ap = await h.approve(po);
    await expect(h.q('postgres', null, `update public.desk_approvals set decision = 'rejected' where id = '${ap}'`)).rejects.toThrow(/immutable/);
    await expect(h.q('postgres', null, `delete from public.desk_approvals where id = '${ap}'`)).rejects.toThrow(/immutable/);
    await expect(h.q('service_role', null, `update public.desk_approvals set consumed_at = now() where id = '${ap}'`)).rejects.toThrow(/immutable/);
    // forging the internal GUC from top level gains nothing (trigger depth check)
    await h.q('service_role', null, `select set_config('desk.internal','1',false)`);
    await expect(h.q('service_role', null,
      `update public.desk_approvals set consumed_at = now() where id = '${ap}'`)).rejects.toThrow(/immutable/);
  });

  it('service role cannot forge a proposal approval via the internal GUC', async () => {
    const po = await h.seedProposal();
    await h.q('service_role', null, `select set_config('desk.internal','1',false)`);
    await expect(h.q('service_role', null,
      `update public.desk_proposed_orders set status = 'approved' where id = '${po}'`)).rejects.toThrow(/illegal/);
    await expect(h.q('service_role', null, `update public.desk_proposed_orders set status = 'approved' where id = '${po}'`)).rejects.toThrow(/illegal/);
  });
});

describe('orders guard', () => {
  it('rejects an order with no approval, even as service role and postgres', async () => {
    const po = await h.seedProposal();
    const bogus = '33333333-3333-3333-3333-333333333333';
    await expect(h.insertOrder(bogus, po)).rejects.toThrow(/no valid approval/);
    await expect(
      h.q('postgres', null,
        `insert into public.desk_orders(approval_id, proposed_order_id, instrument_id, mode, broker, client_order_id, intent, structure, side, qty, order_type, stop_price)
         values ('${bogus}', '${po}', '${h.instrumentId}', 'paper', 'paper', 'x', 'open', 'stock', 'buy', 10, 'market', 95)`),
    ).rejects.toThrow();
  });

  it('owner approval then matching order succeeds once; a second order for the same approval fails', async () => {
    const po = await h.seedProposal();
    const ap = await h.approve(po);
    const first = await h.insertOrder(ap, po);
    expect(first).toHaveLength(1);
    const a = await h.q('authenticated', OWNER, `select consumed_at from public.desk_approvals where id = '${ap}'`);
    expect(a[0].consumed_at).not.toBeNull();
    await expect(h.insertOrder(ap, po)).rejects.toThrow();
    await expect(h.insertOrder(ap, po, { qty: '10' })).rejects.toThrow();
  });

  it('a second order against a consumed approval fails on the guard, not only on uniqueness', async () => {
    const po = await h.seedProposal();
    const ap = await h.approve(po);
    await h.insertOrder(ap, po);
    await expect(
      h.q('service_role', null,
        `insert into public.desk_orders(approval_id, proposed_order_id, instrument_id, mode, broker, client_order_id, intent, structure, side, qty, order_type, limit_price, stop_price, target_price)
         values ('${ap}', '${po}', '${h.instrumentId}', 'paper', 'paper', '${ap}', 'open', 'stock', 'buy', 10, 'limit', 100, 95, 110)`),
    ).rejects.toThrow(/no valid approval/);
  });

  it('rejects an order that differs from the proposal (qty, stop, side, intent)', async () => {
    for (const over of [{ qty: '11' }, { stop_price: '90' }, { side: "'sell'" }, { intent: "'close'" }]) {
      const po = await h.seedProposal();
      const ap = await h.approve(po);
      await expect(h.insertOrder(ap, po, over), JSON.stringify(over)).rejects.toThrow(/does not match/);
    }
  });

  it('rejects an order whose approval is older than 5 minutes', async () => {
    const po = await h.seedProposal();
    const ap = await h.approve(po);
    await backdate(ap, '6 minutes');
    await expect(h.insertOrder(ap, po)).rejects.toThrow(/no valid approval/);
    const po2 = await h.seedProposal();
    const ap2 = await h.approve(po2);
    await backdate(ap2, '4 minutes');
    await expect(h.insertOrder(ap2, po2)).resolves.toHaveLength(1);
  });

  it('rejects an approval that belongs to a different proposal', async () => {
    const po1 = await h.seedProposal();
    const po2 = await h.seedProposal();
    const ap1 = await h.approve(po1);
    await h.approve(po2);
    await expect(h.insertOrder(ap1, po2)).rejects.toThrow(/no valid approval/);
  });

  it('order economics are immutable but status/fill fields can change; orders are never deleted', async () => {
    const po = await h.seedProposal();
    const ap = await h.approve(po);
    const [{ id }] = await h.insertOrder(ap, po);
    await expect(h.q('service_role', null, `update public.desk_orders set qty = 1 where id = '${id}'`)).rejects.toThrow(/immutable/);
    await expect(h.q('service_role', null, `update public.desk_orders set stop_price = 1 where id = '${id}'`)).rejects.toThrow(/immutable/);
    await h.q('service_role', null, `update public.desk_orders set status = 'filled', filled_qty = 10, avg_fill_price = 100 where id = '${id}'`);
    await expect(h.q('service_role', null, `delete from public.desk_orders where id = '${id}'`)).rejects.toThrow(/never deleted/);
  });

  it('proposals cannot be created non-pending, deleted or have economics changed by the service role', async () => {
    await expect(h.seedProposal().then(() => h.q('service_role', null,
      `insert into public.desk_proposed_orders(instrument_id, agent_name, side, qty, order_type, stop_price, status)
       values ('${h.instrumentId}', 'a', 'buy', 1, 'market', 1, 'approved')`))).rejects.toThrow(/pending/);
    const po = await h.seedProposal();
    await expect(h.q('service_role', null, `update public.desk_proposed_orders set qty = 999 where id = '${po}'`)).rejects.toThrow(/immutable/);
    await expect(h.q('service_role', null, `delete from public.desk_proposed_orders where id = '${po}'`)).rejects.toThrow();
  });

  it('proposals require a positive stop price (null and 0 both fail)', async () => {
    const base = `insert into public.desk_proposed_orders(instrument_id, agent_name, side, qty, order_type, stop_price)
                  values ('${h.instrumentId}', 'a', 'buy', 1, 'market', `;
    await expect(h.q('service_role', null, `${base} null)`)).rejects.toThrow(/null value|not-null/i);
    await expect(h.q('service_role', null, `${base} 0)`)).rejects.toThrow(/check/i);
  });

  it('crypto proposals need no legs; option structures without legs are rejected', async () => {
    const ins = (structure: string) =>
      `insert into public.desk_proposed_orders(instrument_id, agent_name, structure, side, qty, order_type, stop_price)
       values ('${h.instrumentId}', 'a', '${structure}', 'buy', 1, 'market', 1)`;
    await h.q('service_role', null, ins('crypto'));
    await h.q('service_role', null, ins('stock'));
    await expect(h.q('service_role', null, ins('long_call'))).rejects.toThrow(/check/i);
    await expect(h.q('service_role', null, ins('iron_condor'))).rejects.toThrow(/check/i);
  });

  it('live orders need a live-confirmed approval', async () => {
    const po = await h.seedProposal();
    await expect(h.approve(po, { mode: "'live'" })).rejects.toThrow(/check/i);
  });
});

describe('owner edits to pending proposals', () => {
  it('owner can edit qty/limit/stop/target and reject, but not other columns or non-pending rows', async () => {
    const po = await h.seedProposal();
    await h.q('authenticated', OWNER, `update public.desk_proposed_orders set qty = 5, stop_price = 96 where id = '${po}'`);
    const r = await h.q('authenticated', OWNER, `select qty, stop_price from public.desk_proposed_orders where id = '${po}'`);
    expect(Number(r[0].qty)).toBe(5);
    await expect(h.q('authenticated', OWNER, `update public.desk_proposed_orders set side = 'sell' where id = '${po}'`)).rejects.toThrow(/permission denied/);
    await expect(h.q('authenticated', OWNER, `update public.desk_proposed_orders set status = 'approved' where id = '${po}'`)).rejects.toThrow();
    await expect(h.q('authenticated', OWNER, `update public.desk_proposed_orders set stop_price = null where id = '${po}'`)).rejects.toThrow();
    await h.q('authenticated', OWNER, `update public.desk_proposed_orders set status = 'rejected' where id = '${po}'`);
    // no longer pending: no further edits (RLS hides the row so nothing updates)
    const upd = await h.q('authenticated', OWNER, `update public.desk_proposed_orders set qty = 7 where id = '${po}' returning id`);
    expect(upd).toHaveLength(0);
  });

  it('non-owner cannot edit proposals', async () => {
    const po = await h.seedProposal();
    const upd = await h.q('authenticated', OTHER, `update public.desk_proposed_orders set qty = 7 where id = '${po}' returning id`);
    expect(upd).toHaveLength(0);
  });
});

describe('kill switch', () => {
  async function approvedAndHalted() {
    const po = await h.seedProposal();
    const ap = await h.approve(po);
    await h.q('service_role', null, `update public.desk_state set halted = true, halted_reason = 'dd', last_equity = 90000, high_water_mark = 100000`);
    return { po, ap };
  }

  it('halted state blocks an open order', async () => {
    const { po, ap } = await approvedAndHalted();
    await expect(h.insertOrder(ap, po)).rejects.toThrow(/kill switch/);
  });

  it('halted state blocks new open approvals', async () => {
    await h.q('service_role', null, `update public.desk_state set halted = true`);
    const po = await h.seedProposal();
    await expect(h.approve(po)).rejects.toThrow(/kill switch/);
  });

  it('service role can trip it but cannot clear it or lower the high-water mark', async () => {
    await approvedAndHalted();
    await expect(h.q('service_role', null, `update public.desk_state set halted = false`)).rejects.toThrow(/desk_reset_kill_switch/);
    await expect(h.q('postgres', null, `update public.desk_state set halted = false`)).rejects.toThrow(/desk_reset_kill_switch/);
    await expect(h.q('service_role', null, `update public.desk_state set high_water_mark = 1`)).rejects.toThrow(/high-water/);
    // forging the reset GUC from an API role does not work
    await h.q('service_role', null, `select set_config('desk.reset','1',false)`);
    await expect(h.q('service_role', null,
      `update public.desk_state set halted = false`)).rejects.toThrow(/desk_reset_kill_switch/);
    await expect(h.q('service_role', null,
      `update public.desk_state set high_water_mark = 1`)).rejects.toThrow(/high-water/);
    await expect(h.q('service_role', null, `delete from public.desk_state`)).rejects.toThrow(/permanent/);
  });

  it('authenticated users (even the owner) cannot write desk_state or set halted', async () => {
    await expect(h.q('authenticated', OWNER, `update public.desk_state set halted = true`)).rejects.toThrow(/permission denied/);
    await expect(h.q('authenticated', OWNER, `update public.desk_state set halted = false`)).rejects.toThrow(/permission denied/);
  });

  it('owner reset clears the halt, rebases the high-water mark and logs a risk event', async () => {
    await approvedAndHalted();
    await h.q('authenticated', OWNER, `select public.desk_reset_kill_switch('reviewed after drawdown')`);
    const s = await h.q('authenticated', OWNER, `select halted, high_water_mark, reset_by from public.desk_state`);
    expect(s[0].halted).toBe(false);
    expect(Number(s[0].high_water_mark)).toBe(90000);
    expect(s[0].reset_by).toBe(OWNER);
    const ev = await h.q('authenticated', OWNER, `select details from public.desk_risk_events where event_type = 'kill_switch_reset'`);
    expect(ev).toHaveLength(1);
    expect((ev[0].details as { note: string }).note).toBe('reviewed after drawdown');
    // and it stays one-way afterwards
    await expect(h.q('service_role', null, `update public.desk_state set high_water_mark = 1`)).rejects.toThrow(/high-water/);
  });

  it('non-owner and anon cannot reset', async () => {
    await approvedAndHalted();
    await expect(h.q('authenticated', OTHER, `select public.desk_reset_kill_switch('x')`)).rejects.toThrow(/owner only/);
    await expect(h.q('anon', null, `select public.desk_reset_kill_switch('x')`)).rejects.toThrow(/permission denied/);
    const s = await h.db.query<{ halted: boolean }>(`select halted from public.desk_state`);
    expect(s.rows[0].halted).toBe(true);
  });
});

describe('RLS', () => {
  beforeEach(async () => {
    const po = await h.seedProposal();
    const ap = await h.approve(po);
    await h.insertOrder(ap, po);
    await h.db.exec(`
      insert into public.desk_risk_events(event_type, actor) values ('owner_claimed', 'system:test');
      insert into public.desk_agent_runs(agent_name, trigger, idempotency_key) values ('momentum', 'manual', 'k1');
      insert into public.desk_journal(author, entry_type, body) values ('owner', 'note', 'hi');
    `);
  });

  it('non-owner authenticated sees zero rows in every desk table and can read the view as empty', async () => {
    for (const t of DESK_TABLES) {
      const r = await h.q('authenticated', OTHER, `select count(*)::int as n from public.${t}`);
      expect(r[0].n, t).toBe(0);
    }
    const v = await h.q('authenticated', OTHER, `select count(*)::int as n from public.desk_scorecard_by_agent`);
    expect(v[0].n).toBe(0);
  });

  it('owner can read the seeded tables', async () => {
    for (const t of ['desk_owner', 'desk_state', 'desk_instruments', 'desk_proposed_orders', 'desk_approvals', 'desk_orders', 'desk_risk_events', 'desk_agent_runs', 'desk_journal']) {
      const r = await h.q('authenticated', OWNER, `select count(*)::int as n from public.${t}`);
      expect(r[0].n, t).toBeGreaterThan(0);
    }
  });

  it('non-owner cannot insert anywhere; owner cannot insert into service-only tables', async () => {
    await expect(h.q('authenticated', OTHER,
      `insert into public.desk_journal(author, entry_type, body) values ('owner', 'note', 'x')`)).rejects.toThrow(/row-level security/);
    await expect(h.q('authenticated', OTHER,
      `insert into public.desk_instruments(symbol, asset_class) values ('MSFT', 'equity')`)).rejects.toThrow(/permission denied/);
    await expect(h.q('authenticated', OWNER,
      `insert into public.desk_orders(approval_id, proposed_order_id, instrument_id, mode, broker, client_order_id, intent, structure, side, qty, order_type, stop_price)
       values (gen_random_uuid(), gen_random_uuid(), '${h.instrumentId}', 'paper', 'paper', 'z', 'open', 'stock', 'buy', 1, 'market', 1)`)).rejects.toThrow(/permission denied/);
    await expect(h.q('authenticated', OWNER,
      `insert into public.desk_risk_events(event_type, actor) values ('owner_claimed', 'owner')`)).rejects.toThrow(/permission denied/);
  });

  it('owner journal: can add own notes but not impersonate agents', async () => {
    await h.q('authenticated', OWNER, `insert into public.desk_journal(author, entry_type, body) values ('owner', 'note', 'mine')`);
    await expect(h.q('authenticated', OWNER,
      `insert into public.desk_journal(author, entry_type, body) values ('momentum', 'note', 'fake')`)).rejects.toThrow(/row-level security/);
  });

  it('anon is denied on every desk table, the view and the helper functions', async () => {
    for (const t of [...DESK_TABLES, 'desk_scorecard_by_agent']) {
      await expect(h.q('anon', null, `select 1 from public.${t} limit 1`), t).rejects.toThrow(/permission denied/);
    }
    await expect(h.q('anon', null, `select public.is_desk_owner()`)).rejects.toThrow(/permission denied/);
  });

  it('before an owner is claimed, nobody (including a would-be owner) has access', async () => {
    await h.db.exec(`alter table public.desk_owner disable trigger all; delete from public.desk_owner;`);
    const r = await h.q('authenticated', OWNER, `select count(*)::int as n from public.desk_instruments`);
    expect(r[0].n).toBe(0);
  });

  it('a second owner is allowed, gains access, and a third is rejected by the cap', async () => {
    await h.db.exec(`insert into public.desk_owner(user_id) values ('${OTHER}')`);
    expect((await h.q('authenticated', OTHER, `select public.is_desk_owner() as o`))[0].o).toBe(true);
    await h.db.exec(`insert into auth.users(id, email) values ('33333333-3333-3333-3333-333333333333', 'third@example.test')`);
    await expect(h.db.exec(`insert into public.desk_owner(user_id) values ('33333333-3333-3333-3333-333333333333')`)).rejects.toThrow(/cap/);
  });
  it('the same user cannot be inserted as owner twice', async () => {
    await expect(h.db.exec(`insert into public.desk_owner(user_id) values ('${OWNER}')`)).rejects.toThrow();
  });

  const score = (kind: string, id: string, h5 = 5) =>
    `insert into public.desk_scorecard(subject_kind, subject_id, agent_name, horizon_days, t0_date, t0_price, tn_date, tn_price, return_pct, benchmark_return_pct, alpha_pct)
     values ('${kind}', '${id}', 'momentum', ${h5}, '2026-11-02', 100, '2026-11-09', 104, 4, 1, 3)`;
  const ID = '44444444-4444-4444-4444-444444444444';

  it('scorecard: signal and trade rows coexist for the same horizon; duplicate (kind,id,horizon) is rejected', async () => {
    await h.db.exec(score('signal', ID));
    await h.db.exec(score('trade', ID));
    await h.db.exec(score('thesis', ID));
    await h.db.exec(score('signal', ID, 1));
    await expect(h.db.exec(score('signal', ID))).rejects.toThrow(/unique|duplicate/i);
    await expect(h.db.exec(score('bogus', ID))).rejects.toThrow(/check/i);
    const r = await h.db.query<{ target_hit: boolean; stop_hit: boolean; first_touch: string }>(
      `select target_hit, stop_hit, first_touch from public.desk_scorecard limit 1`);
    expect(r.rows[0]).toEqual({ target_hit: false, stop_hit: false, first_touch: 'none' });
  });

  it('scorecard rows are immutable for every role', async () => {
    await h.db.exec(score('trade', ID));
    await expect(h.q('service_role', null, `update public.desk_scorecard set return_pct = 99`)).rejects.toThrow(/append-only/);
    await expect(h.q('postgres', null, `delete from public.desk_scorecard`)).rejects.toThrow(/append-only/);
  });

  it('scorecard view rolls up per agent, subject kind and horizon for the owner only', async () => {
    await h.db.exec(score('signal', ID));
    await h.db.exec(score('trade', ID));
    const own = await h.q('authenticated', OWNER,
      `select subject_kind, n, hit_rate, mean_alpha_pct from public.desk_scorecard_by_agent order by subject_kind`);
    expect(own.map((r) => r.subject_kind)).toEqual(['signal', 'trade']);
    expect(own[0].n).toBe(1);
    expect(Number(own[0].hit_rate)).toBe(1);
    const other = await h.q('authenticated', OTHER, `select * from public.desk_scorecard_by_agent`);
    expect(other).toHaveLength(0);
  });
});

describe('watchlist, signal dedupe and agent-written tables', () => {
  const sig = (key: string) =>
    `insert into public.desk_signals(instrument_id, agent_name, kind, direction, strength, summary, dedupe_key)
     values ('${h.instrumentId}', 'momentum', 'momentum', 'long', 0.5, 's', ${key})`;

  it('signal dedupe_key is unique when set, and nulls never collide', async () => {
    await h.q('service_role', null, sig("'momentum:AAPL:2026-11-07'"));
    await expect(h.q('service_role', null, sig("'momentum:AAPL:2026-11-07'"))).rejects.toThrow(/unique|duplicate/i);
    await h.q('service_role', null, sig('null'));
    await h.q('service_role', null, sig('null'));
    await h.q('service_role', null, sig("'other'"));
  });

  it('on_watchlist defaults false; owner can toggle it but not other instrument columns; non-owner cannot', async () => {
    const d = await h.q('authenticated', OWNER, `select on_watchlist from public.desk_instruments`);
    expect(d[0].on_watchlist).toBe(false);
    const on = await h.q('authenticated', OWNER,
      `update public.desk_instruments set on_watchlist = true where id = '${h.instrumentId}' returning on_watchlist`);
    expect(on[0].on_watchlist).toBe(true);
    await expect(h.q('authenticated', OWNER, `update public.desk_instruments set symbol = 'X'`)).rejects.toThrow(/permission denied/);
    await expect(h.q('authenticated', OWNER, `update public.desk_instruments set active = false`)).rejects.toThrow(/permission denied/);
    const other = await h.q('authenticated', OTHER,
      `update public.desk_instruments set on_watchlist = false returning id`);
    expect(other).toHaveLength(0);
    await expect(h.q('anon', null, `update public.desk_instruments set on_watchlist = true`)).rejects.toThrow(/permission denied/);
  });

  it('asset_class allows crypto; agent_runs trigger allows cron and manual and nothing else', async () => {
    await h.q('service_role', null, `insert into public.desk_instruments(symbol, asset_class) values ('BTC/USD', 'crypto')`);
    await h.q('service_role', null, `insert into public.desk_agent_runs(agent_name, trigger, idempotency_key) values ('a', 'cron', 'k1')`);
    await h.q('service_role', null, `insert into public.desk_agent_runs(agent_name, trigger, idempotency_key) values ('a', 'manual', 'k2')`);
    await expect(h.q('service_role', null,
      `insert into public.desk_agent_runs(agent_name, trigger, idempotency_key) values ('a', 'webhook', 'k3')`)).rejects.toThrow(/check/i);
  });

  it('agent-written tables: service role inserts; owner session cannot write them', async () => {
    const thesis = `insert into public.desk_theses(instrument_id, agent_name, direction, bull_case, bear_case, entry_price, stop_price, target_price, confidence, invalidation)
      values ('${h.instrumentId}', 'momentum', 'long', 'b', 'r', 100, 95, 110, 0.6, 'inv')`;
    await h.q('service_role', null, thesis);
    await h.seedProposal();
    for (const sql of [thesis, sig('null'),
      `insert into public.desk_agent_runs(agent_name, trigger, idempotency_key) values ('a', 'cron', 'o1')`,
      `insert into public.desk_instruments(symbol, asset_class) values ('ZZZ', 'equity')`,
      `insert into public.desk_proposed_orders(instrument_id, agent_name, side, qty, order_type, stop_price) values ('${h.instrumentId}', 'a', 'buy', 1, 'market', 1)`]) {
      await expect(h.q('authenticated', OWNER, sql)).rejects.toThrow(/permission denied/);
    }
  });
});

describe('risk events', () => {
  it('are append-only for every role', async () => {
    await h.db.exec(`insert into public.desk_risk_events(event_type, actor) values ('owner_claimed', 'system:test')`);
    await expect(h.q('postgres', null, `update public.desk_risk_events set actor = 'x'`)).rejects.toThrow(/append-only/);
    await expect(h.q('service_role', null, `delete from public.desk_risk_events`)).rejects.toThrow(/append-only/);
    await expect(h.q('service_role', null, `update public.desk_risk_events set actor = 'x'`)).rejects.toThrow(/append-only/);
  });
});
