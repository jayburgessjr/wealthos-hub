// @vitest-environment node
// Desk hardening (audit B1, B4, B8) against a real Postgres (pglite), with the hardening migration applied last.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HARDENING_PATH, makeHarness, OTHER, OWNER, type Harness } from './harness';

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
}, 60_000);
afterEach(async () => {
  await h.db.close();
});

const directApproval = (po: string, uid = OWNER, hash = 'hash', extra = "'approved', true") =>
  h.q('authenticated', uid,
    `insert into public.desk_approvals(proposed_order_id, decision, risk_passed, risk_decision, risk_input_hash, mode, decided_by)
     values ('${po}', ${extra}, '{"approved":true}', '${hash}', 'paper', '${uid}') returning id`);

describe('hardening migration', () => {
  it('is additive: no table, column, schema, policy, function or view is dropped; nothing is truncated or deleted', () => {
    const sql = readFileSync(HARDENING_PATH, 'utf8').replace(/--.*$/gm, '').toLowerCase();
    expect(sql).not.toMatch(/\bdrop\s+(table|column|schema|policy|function|view)\b/);
    expect(sql).not.toMatch(/\btruncate\b/);
    expect(sql).not.toMatch(/\bdelete\s+from\b/);
    expect(sql).not.toMatch(/disable\s+row\s+level|no\s+force\s+row/);
    // the only drops allowed: the one event-type CHECK being widened, and re-creating its own trigger
    const drops = [...sql.matchAll(/\bdrop\s+(constraint|trigger)\b[^;]*/g)].map((m) => m[0].replace(/\s+/g, ' '));
    expect(drops).toEqual([
      'drop constraint if exists desk_risk_events_event_type_check',
      'drop trigger if exists trg_desk_journal_guard on public.desk_journal',
    ]);
    for (const m of sql.matchAll(/public\.([a-z_]+)/g)) expect(m[1]).toMatch(/^(desk_|is_desk_owner)/);
  });

  it('keeps RLS enabled and forced on every desk table and grants nothing new to anon', async () => {
    const r = await h.db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'desk\\_%'`);
    expect(r.rows.length).toBe(13);
    for (const t of r.rows) { expect(t.relrowsecurity).toBe(true); expect(t.relforcerowsecurity).toBe(true); }
    const anon = await h.db.query(`select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and table_name like 'desk\\_%'`);
    expect(anon.rows).toEqual([]);
    const fn = await h.db.query<{ a: boolean }>(`select has_function_privilege('anon', 'public.desk_reset_kill_switch(text)', 'execute') as a`);
    expect(fn.rows[0].a).toBe(false);
  });
});

describe('B1 direct approval inserts are refused without a server risk marker', () => {
  it('an owner posting risk_passed=true directly (PostgREST style) is refused and the proposal stays pending', async () => {
    const po = await h.seedProposal();
    await expect(directApproval(po)).rejects.toThrow(/no server risk check/);
    expect((await h.q('postgres', null, `select status from public.desk_proposed_orders where id='${po}'`))[0].status).toBe('pending');
    expect((await h.q('postgres', null, `select count(*)::int c from public.desk_approvals`))[0].c).toBe(0);
  });

  it('the owner cannot forge the marker: no API role can insert risk events', async () => {
    const po = await h.seedProposal();
    for (const role of ['authenticated', 'anon'] as const) {
      await expect(h.q(role, role === 'anon' ? null : OWNER,
        `insert into public.desk_risk_events(event_type, proposed_order_id, actor, details) values ('check_passed', '${po}', 'x', '{}')`)).rejects.toThrow();
    }
    await expect(directApproval(po)).rejects.toThrow(/no server risk check/);
  });

  it('with a matching server marker the approval is accepted and an order can follow (normal path unchanged)', async () => {
    const po = await h.seedProposal();
    const ap = await h.approve(po);
    const o = await h.insertOrder(ap, po);
    expect(o).toHaveLength(1);
  });

  it('the marker is bound to the risk input hash', async () => {
    const po = await h.seedProposal();
    await h.writeRiskMarker(po, { inputHash: 'good' });
    await expect(directApproval(po, OWNER, 'other-hash')).rejects.toThrow(/no server risk check/);
    await expect(directApproval(po, OWNER, 'good')).resolves.toHaveLength(1);
  });

  it('editing the proposal after the check invalidates the marker', async () => {
    const po = await h.seedProposal();
    await h.writeRiskMarker(po);
    await h.q('authenticated', OWNER, `update public.desk_proposed_orders set qty = 1000 where id = '${po}'`);
    await expect(directApproval(po)).rejects.toThrow(/no server risk check/);
    const po2 = await h.seedProposal();
    await h.writeRiskMarker(po2);
    await h.q('authenticated', OWNER, `update public.desk_proposed_orders set stop_price = 50 where id = '${po2}'`);
    await expect(directApproval(po2)).rejects.toThrow(/no server risk check/);
  });

  it('a marker for another proposal, or an older than 5 minute marker, does not count', async () => {
    const a = await h.seedProposal();
    const b = await h.seedProposal();
    await h.writeRiskMarker(a);
    await expect(directApproval(b)).rejects.toThrow(/no server risk check/);
    const c = await h.seedProposal();
    await h.writeRiskMarker(c);
    await h.q('postgres', null, `alter table public.desk_risk_events disable trigger trg_desk_risk_events_append_only`);
    await h.q('postgres', null, `update public.desk_risk_events set created_at = now() - interval '6 minutes' where proposed_order_id = '${c}'`);
    await h.q('postgres', null, `alter table public.desk_risk_events enable trigger trg_desk_risk_events_append_only`);
    await expect(directApproval(c)).rejects.toThrow(/no server risk check/);
  });

  it('a different check type (check_failed) is not a marker', async () => {
    const po = await h.seedProposal();
    await h.db.exec(`insert into public.desk_risk_events(event_type, proposed_order_id, actor, details)
      select 'check_failed', id, 'system', jsonb_build_object('inputHash','hash','qty',qty,'stopPrice',stop_price,'limitPrice',limit_price,'targetPrice',target_price) from public.desk_proposed_orders where id='${po}'`);
    await expect(directApproval(po)).rejects.toThrow(/no server risk check/);
  });

  it('rejections need no marker, and an approved-but-risk-failed row only ever rejects', async () => {
    const p1 = await h.seedProposal();
    await h.approve(p1, { decision: "'rejected'", risk_passed: 'false' }, OWNER, { marker: false });
    expect((await h.q('postgres', null, `select status from public.desk_proposed_orders where id='${p1}'`))[0].status).toBe('rejected');
    const p2 = await h.seedProposal();
    await h.approve(p2, { risk_passed: 'false' }, OWNER, { marker: false });
    expect((await h.q('postgres', null, `select status from public.desk_proposed_orders where id='${p2}'`))[0].status).toBe('rejected');
  });

  it('the kill switch still blocks an approved open decision even with a marker', async () => {
    const po = await h.seedProposal();
    await h.q('postgres', null, `update public.desk_state set halted = true, last_equity = 1`);
    await expect(h.approve(po)).rejects.toThrow(/kill switch/);
  });

  it('a replayed marker cannot produce a second approval for the same proposal', async () => {
    const po = await h.seedProposal();
    await h.approve(po);
    await expect(directApproval(po)).rejects.toThrow();
  });
});

describe('B4 kill switch reset', () => {
  const halt = () => h.q('postgres', null, `update public.desk_state set halted = true, halted_reason = 'drawdown', high_water_mark = 100000, last_equity = 88000`);

  it('refuses an empty, whitespace or null note, and does not reset', async () => {
    await halt();
    for (const note of [`''`, `'   '`, `null`]) {
      await expect(h.q('authenticated', OWNER, `select public.desk_reset_kill_switch(${note})`)).rejects.toThrow(/note is required/);
    }
    expect((await h.q('postgres', null, `select halted from public.desk_state`))[0].halted).toBe(true);
  });

  it('requires a trimmed note of at least 10 characters: 9 rejected, 10 accepted', async () => {
    await halt();
    for (const note of ['x', 'abcdefghi', '   abcdefghi   ']) {
      await expect(h.q('authenticated', OWNER, `select public.desk_reset_kill_switch('${note}')`)).rejects.toThrow(/note is required/);
    }
    expect((await h.q('postgres', null, `select halted from public.desk_state`))[0].halted).toBe(true);
    await h.q('authenticated', OWNER, `select public.desk_reset_kill_switch('  abcdefghij  ')`);
    expect((await h.q('postgres', null, `select halted from public.desk_state`))[0].halted).toBe(false);
  });

  it('refuses when the kill switch is not halted, and writes no event', async () => {
    await expect(h.q('authenticated', OWNER, `select public.desk_reset_kill_switch('reviewed the drawdown')`)).rejects.toThrow(/not engaged/);
    expect((await h.q('postgres', null, `select count(*)::int c from public.desk_risk_events where event_type='kill_switch_reset'`))[0].c).toBe(0);
  });

  it('a successful reset records the prior high-water mark, the user, the reason and the note; HWM is rebased', async () => {
    await halt();
    await h.q('authenticated', OWNER, `select public.desk_reset_kill_switch('  reviewed the drawdown  ')`);
    const e = (await h.q('postgres', null, `select actor, details from public.desk_risk_events where event_type='kill_switch_reset'`))[0];
    const d = e.details as Record<string, unknown>;
    expect(e.actor).toBe('owner');
    expect(d.note).toBe('reviewed the drawdown');
    expect(d.reset_by).toBe(OWNER);
    expect(Number(d.prior_high_water_mark)).toBe(100000);
    expect(Number(d.rebased_hwm)).toBe(88000);
    expect(d.prior_halted_reason).toBe('drawdown');
    const s = (await h.q('postgres', null, `select halted, high_water_mark, reset_by from public.desk_state`))[0];
    expect(s.halted).toBe(false);
    expect(Number(s.high_water_mark)).toBe(88000);
    expect(s.reset_by).toBe(OWNER);
  });

  it('a second reset right after is refused (not halted any more)', async () => {
    await halt();
    await h.q('authenticated', OWNER, `select public.desk_reset_kill_switch('first reset note')`);
    await expect(h.q('authenticated', OWNER, `select public.desk_reset_kill_switch('second reset note')`)).rejects.toThrow(/not engaged/);
  });

  it('ownership is still checked first: non-owner, service role and anon get no information', async () => {
    await halt();
    await expect(h.q('authenticated', OTHER, `select public.desk_reset_kill_switch('a note')`)).rejects.toThrow(/owner only/);
    await expect(h.q('service_role', null, `select public.desk_reset_kill_switch('a note')`)).rejects.toThrow(/owner only/);
    await expect(h.q('anon', null, `select public.desk_reset_kill_switch('a note')`)).rejects.toThrow();
  });

  it('caps the stored note at 500 characters', async () => {
    await halt();
    await h.q('authenticated', OWNER, `select public.desk_reset_kill_switch('${'n'.repeat(900)}')`);
    const e = (await h.q('postgres', null, `select details->>'note' as n from public.desk_risk_events where event_type='kill_switch_reset'`))[0];
    expect((e.n as string).length).toBe(500);
  });
});

describe('B8 journal author and editor are recorded', () => {
  beforeEach(async () => {
    await h.db.exec(`insert into public.desk_owner(user_id) values ('${OTHER}')`);
  });
  const note = (uid: string, extra = '') =>
    h.q('authenticated', uid, `insert into public.desk_journal(author, entry_type, body${extra ? ', author_user_id' : ''}) values ('owner', 'note', 'hello'${extra ? `, ${extra}` : ''}) returning id, author_user_id`);

  it('records the writing owner and ignores a spoofed author_user_id', async () => {
    const r = await note(OWNER);
    expect(r[0].author_user_id).toBe(OWNER);
    const spoof = await note(OWNER, `'${OTHER}'`);
    expect(spoof[0].author_user_id).toBe(OWNER);
  });

  it('the other owner editing records last_edited_by but cannot change the author', async () => {
    const id = (await note(OWNER))[0].id as string;
    await h.q('authenticated', OTHER, `update public.desk_journal set body = 'edited' where id = '${id}'`);
    const row = (await h.q('postgres', null, `select author_user_id, last_edited_by, body from public.desk_journal where id = '${id}'`))[0];
    expect(row).toMatchObject({ author_user_id: OWNER, last_edited_by: OTHER, body: 'edited' });
    await expect(h.q('authenticated', OTHER, `update public.desk_journal set author_user_id = '${OTHER}' where id = '${id}'`)).rejects.toThrow();
    await expect(h.q('postgres', null, `update public.desk_journal set author_user_id = '${OTHER}' where id = '${id}'`)).rejects.toThrow(/author cannot be changed/);
  });

  it('agent (service role) entries carry no user id; owner policy still requires author = owner', async () => {
    const r = await h.q('service_role', null, `insert into public.desk_journal(author, entry_type, body) values ('momentum', 'note', 'agent note') returning author_user_id`);
    expect(r[0].author_user_id).toBeNull();
    await expect(h.q('authenticated', OWNER, `insert into public.desk_journal(author, entry_type, body) values ('momentum', 'note', 'x')`)).rejects.toThrow();
  });
});
