// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, B, makeCoachHarness, type CoachHarness } from './harness';

let h: CoachHarness;
beforeAll(async () => {
  h = await makeCoachHarness();
}, 60_000);
afterAll(async () => {
  await h.db.close();
});

const good = {
  change_reason: 'first plan',
  profile: { primary_goal: 'Build savings', risk_tolerance: 'conservative', monthly_income: 2000 },
  summary: 'A starter plan.',
  items: [
    { key: 'cushion', section: 'wealth', title: 'Starter cushion', body: 'Save $500', metrics: { amount: 500 }, impact: 4 },
    { key: 'side-gig', section: 'income', title: 'Weekend side work', body: 'First step: list one skill', impact: 3 },
  ],
  actions: [{ key: 'open-sav', title: 'Open a savings account', priority: 1, track: 'save', item_key: 'cushion' }],
};

describe('tenant isolation', () => {
  it('seeds as A; B sees nothing and cannot write across tenants', async () => {
    await h.apply(A, good);
    await h.q('authenticated', A, `select public.coach_begin_turn(gen_random_uuid(), 'hi')`);
    for (const t of ['user_strategy', 'strategy_items', 'strategy_actions', 'strategy_messages']) {
      expect((await h.q('authenticated', B, `select * from public.${t}`)).length).toBe(0);
      expect((await h.q('authenticated', A, `select * from public.${t}`)).length).toBeGreaterThan(0);
    }
    await expect(h.q('authenticated', B, `insert into public.strategy_items(user_id, section, title) values ('${A}','wealth','x')`)).rejects.toThrow(/row-level security/i);
    // with the RPC flag set (as the RPCs do), the RLS policy itself still blocks writing into A's tenant
    await expect(
      h.db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${B}',false); select set_config('strategy.ai_apply','1',false); insert into public.strategy_messages(user_id, role, content) values ('${A}','user','x')`),
    ).rejects.toThrow(/row-level security/i);
    await h.db.exec(`reset role; select set_config('strategy.ai_apply','',false)`);
    expect(await h.q('authenticated', B, `update public.strategy_items set title='hacked' returning id`)).toHaveLength(0);
    expect(await h.q('authenticated', B, `delete from public.strategy_items returning id`)).toHaveLength(0);
    expect(await h.q('authenticated', B, `delete from public.user_strategy returning id`)).toHaveLength(0);
    const own = await h.q('authenticated', A, `select count(*)::int n from public.strategy_items where title='hacked'`);
    expect(own[0].n).toBe(0);
  });

  it('reassigning user_id fails WITH CHECK', async () => {
    await expect(h.q('authenticated', A, `update public.strategy_items set user_id='${B}'`)).rejects.toThrow(/row-level security/i);
  });

  it('anon has no access', async () => {
    await expect(h.q('anon', null, `select * from public.strategy_items`)).rejects.toThrow(/permission denied/i);
    await expect(h.q('anon', null, `select public.coach_begin_turn(gen_random_uuid(), 'x')`)).rejects.toThrow(/permission denied/i);
    await expect(h.q('anon', null, `select public.apply_strategy_update('{}'::jsonb)`)).rejects.toThrow(/permission denied/i);
  });

  it('composite FK rejects an action linked to another user item', async () => {
    const item = (await h.q('authenticated', A, `select id from public.strategy_items limit 1`))[0].id;
    await h.apply(B, good);
    await expect(
      h.q('authenticated', B, `insert into public.strategy_actions(user_id, title, priority, linked_item_id) values ('${B}','x',1,'${item}')`),
    ).rejects.toThrow(/foreign key/i);
  });

  it('apply_strategy_update and coach_begin_turn as B never touch A', async () => {
    const before = await h.q('authenticated', A, `select title, version from public.strategy_items i, public.user_strategy s order by title`);
    await h.apply(B, { change_reason: 'again', summary: 'B only', items: [{ key: 'cushion', section: 'wealth', title: 'B title' }] });
    await h.q('authenticated', B, `select public.coach_begin_turn(gen_random_uuid(), 'hello') r`);
    const after = await h.q('authenticated', A, `select title, version from public.strategy_items i, public.user_strategy s order by title`);
    expect(after).toEqual(before);
  });
});

describe('apply_strategy_update', () => {
  it('stores track, income section and derives status', async () => {
    const act = await h.q('authenticated', A, `select track from public.strategy_actions where ai_key='open-sav'`);
    expect(act[0].track).toBe('save');
    const inc = await h.q('authenticated', A, `select 1 from public.strategy_items where section='income'`);
    expect(inc).toHaveLength(1);
    const st = await h.q('authenticated', A, `select status, version, primary_goal from public.user_strategy`);
    expect(st[0].status).toBe('active');
  });

  it('updates unedited AI rows in place and is idempotent by key', async () => {
    const r = await h.apply(A, { change_reason: 'rev', items: [{ key: 'cushion', section: 'wealth', title: 'Bigger cushion' }] });
    expect(r.applied).toBe(1);
    const rows = await h.q('authenticated', A, `select title from public.strategy_items where ai_key='cushion'`);
    expect(rows).toEqual([{ title: 'Bigger cushion' }]);
  });

  it('edited row becomes a proposal, content unchanged; user edit sets the flag; accept resets it', async () => {
    await h.q('authenticated', A, `update public.strategy_items set title='My title' where ai_key='cushion'`);
    expect((await h.q('authenticated', A, `select edited_by_user e from public.strategy_items where ai_key='cushion'`))[0].e).toBe(true);
    const r = await h.apply(A, { change_reason: 'rev', items: [{ key: 'cushion', section: 'wealth', title: 'AI title' }] });
    expect(r.proposed).toBe(1);
    const row = (await h.q('authenticated', A, `select id, title, pending_ai_proposal p from public.strategy_items where ai_key='cushion'`))[0];
    expect(row.title).toBe('My title');
    expect((row.p as Record<string, unknown>).title).toBe('AI title');
    await h.q('authenticated', A, `select public.resolve_strategy_proposal('item','${row.id}',false)`);
    let after = (await h.q('authenticated', A, `select title, edited_by_user e, pending_ai_proposal p from public.strategy_items where ai_key='cushion'`))[0];
    expect(after).toEqual({ title: 'My title', e: true, p: null });
    await h.apply(A, { change_reason: 'rev', items: [{ key: 'cushion', section: 'wealth', title: 'AI title 2' }] });
    await h.q('authenticated', A, `select public.resolve_strategy_proposal('item','${row.id}',true)`);
    after = (await h.q('authenticated', A, `select title, edited_by_user e, pending_ai_proposal p from public.strategy_items where ai_key='cushion'`))[0];
    expect(after).toEqual({ title: 'AI title 2', e: false, p: null });
  });

  it('action status toggle is not an edit and AI never writes status', async () => {
    await h.q('authenticated', A, `update public.strategy_actions set status='done' where ai_key='open-sav'`);
    expect((await h.q('authenticated', A, `select edited_by_user e from public.strategy_actions where ai_key='open-sav'`))[0].e).toBe(false);
    await h.apply(A, { change_reason: 'rev', actions: [{ key: 'open-sav', title: 'Open savings', priority: 2 }] });
    const r = (await h.q('authenticated', A, `select status, title from public.strategy_actions where ai_key='open-sav'`))[0];
    expect(r).toEqual({ status: 'done', title: 'Open savings' });
  });

  it('locked profile field is preserved; user profile edit locks the field', async () => {
    await h.q('authenticated', A, `update public.user_strategy set primary_goal='My goal'`);
    const s = (await h.q('authenticated', A, `select profile_locked l from public.user_strategy`))[0].l as string[];
    expect(s).toContain('primary_goal');
    await h.apply(A, { change_reason: 'rev', profile: { primary_goal: 'AI goal', age: 30 } });
    const row = (await h.q('authenticated', A, `select primary_goal, profile from public.user_strategy`))[0];
    expect(row.primary_goal).toBe('My goal');
    expect((row.profile as Record<string, unknown>).age).toBe(30);
  });

  it('summary edit routes the AI revision to summary_proposal', async () => {
    await h.q('authenticated', A, `update public.user_strategy set summary='Mine'`);
    await h.apply(A, { change_reason: 'rev', summary: 'AI summary' });
    const row = (await h.q('authenticated', A, `select summary, summary_proposal p, id from public.user_strategy`))[0];
    expect(row.summary).toBe('Mine');
    expect(row.p).toBe('AI summary');
    await h.q('authenticated', A, `select public.resolve_strategy_proposal('summary','${row.id}',true)`);
    expect((await h.q('authenticated', A, `select summary from public.user_strategy`))[0].summary).toBe('AI summary');
  });

  it('tombstoned key is not resurrected', async () => {
    await h.q('authenticated', A, `update public.strategy_items set archived_at=now() where ai_key='side-gig'`);
    const r = await h.apply(A, { change_reason: 'rev', items: [{ key: 'side-gig', section: 'income', title: 'again' }] });
    expect(r.skipped).toBe(1);
    expect((await h.q('authenticated', A, `select title from public.strategy_items where ai_key='side-gig'`))[0].title).not.toBe('again');
  });

  it('is atomic: a bad row rolls everything back; version unchanged', async () => {
    const v0 = (await h.q('authenticated', A, `select version v from public.user_strategy`))[0].v;
    await expect(
      h.apply(A, { change_reason: 'bad', summary: 'should not persist', items: [{ key: 'ok1', section: 'gap', title: 'fine' }, { key: 'bad', section: 'gap', title: '' }] }),
    ).rejects.toThrow();
    expect((await h.q('authenticated', A, `select version v from public.user_strategy`))[0].v).toBe(v0);
    expect(await h.q('authenticated', A, `select 1 from public.strategy_items where ai_key='ok1'`)).toHaveLength(0);
  });

  it('raises when auth.uid() is null', async () => {
    await expect(h.q('authenticated', null, `select public.apply_strategy_update('{"summary":"x"}'::jsonb)`)).rejects.toThrow(/not authenticated/);
  });

  it('enforces the 25 live rows per section cap including income', async () => {
    const items = Array.from({ length: 26 }, (_, i) => ({ key: `inc-${i}`, section: 'income', title: `idea ${i}` }));
    await expect(h.apply(B, { change_reason: 'cap', items })).rejects.toThrow(/section cap/);
    const ok = items.slice(0, 20);
    await h.apply(B, { change_reason: 'cap', items: ok });
    await expect(h.apply(B, { change_reason: 'cap', items: items.slice(20, 26).map((x, i) => ({ ...x, key: `more-${i}` })) })).rejects.toThrow(/section cap/);
  });

  it('rejects items before the profile has goal plus horizon or risk', async () => {
    const C = '33333333-3333-3333-3333-333333333333';
    await h.db.exec(`insert into auth.users(id) values ('${C}')`);
    await expect(h.apply(C, { change_reason: 'x', profile: { primary_goal: 'g' }, items: [{ key: 'a', section: 'gap', title: 't' }] })).rejects.toThrow(/profile incomplete/);
    await h.apply(C, { change_reason: 'x', profile: { primary_goal: 'g' } });
    expect((await h.q('authenticated', C, `select status from public.user_strategy`))[0].status).toBe('interviewing');
  });

  it('remove_keys deletes unedited AI rows only', async () => {
    await h.q('authenticated', A, `update public.strategy_items set body='mine' where ai_key='cushion'`);
    await h.apply(A, { change_reason: 'rev', items: [{ key: 'tmp', section: 'gap', title: 'tmp' }] });
    const r = await h.apply(A, { change_reason: 'rev', remove_keys: [{ kind: 'item', section: 'gap', key: 'tmp' }, { kind: 'item', section: 'wealth', key: 'cushion' }] });
    expect(r.removed).toBe(1);
    expect(r.skipped).toBe(1);
  });
});

describe('coach_begin_turn / coach_save_reply', () => {
  const id = '99999999-9999-9999-9999-999999999999';
  const call = async (uid: string, mid: string) =>
    ((await h.q('authenticated', uid, `select public.coach_begin_turn('${mid}','hello') r`))[0].r as { status: string }).status;

  it('new, then retry, then replayed after the reply is saved', async () => {
    expect(await call(A, id)).toBe('new');
    expect(await call(A, id)).toBe('retry');
    await h.q('authenticated', A, `select public.coach_save_reply('${id}','reply')`);
    await h.q('authenticated', A, `select public.coach_save_reply('${id}','reply again')`);
    expect(await call(A, id)).toBe('replayed');
    const n = await h.q('authenticated', A, `select count(*)::int n from public.strategy_messages where role='assistant'`);
    expect(n[0].n).toBe(1);
  });

  it('9th message in a minute is rate limited', async () => {
    const D = '44444444-4444-4444-4444-444444444444';
    await h.db.exec(`insert into auth.users(id) values ('${D}')`);
    for (let i = 0; i < 8; i++) expect(await call(D, crypto.randomUUID())).toBe('new');
    expect(await call(D, crypto.randomUUID())).toBe('rate_limited');
  });

  it('a direct client insert cannot forge messages or skip the cap; the RPCs still work', async () => {
    const E = '55555555-5555-5555-5555-555555555555';
    await h.db.exec(`insert into auth.users(id) values ('${E}')`);
    await expect(h.q('authenticated', E, `insert into public.strategy_messages(user_id, role, content) values ('${E}','assistant','forged')`)).rejects.toThrow(/coach only/);
    await expect(h.q('authenticated', E, `insert into public.strategy_messages(user_id, role, content) values ('${E}','user','x')`)).rejects.toThrow(/coach only/);
    const mid = crypto.randomUUID();
    expect(await call(E, mid)).toBe('new');
    await h.q('authenticated', E, `select public.coach_save_reply('${mid}','ok')`);
    expect((await h.q('authenticated', E, `select count(*)::int n from public.strategy_messages`))[0].n).toBe(2);
    // the flag does not leak out of the RPC transaction
    await expect(h.q('authenticated', E, `insert into public.strategy_messages(user_id, role, content) values ('${E}','assistant','forged')`)).rejects.toThrow(/coach only/);
  });

  it('authenticated cannot truncate or reference the coach tables', async () => {
    for (const t of ['user_strategy', 'strategy_items', 'strategy_actions', 'strategy_messages']) {
      await expect(h.q('authenticated', A, `truncate public.${t}`)).rejects.toThrow(/permission denied/i);
      await expect(h.q('anon', null, `truncate public.${t}`)).rejects.toThrow(/permission denied/i);
    }
    const g = await h.q('postgres', null, `select count(*)::int n from information_schema.role_table_grants where (table_name like 'strategy_%' or table_name = 'user_strategy') and grantee in ('authenticated','anon','PUBLIC') and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')`);
    expect(g[0].n).toBe(0);
  });

  it('messages cannot be updated or deleted', async () => {
    await expect(h.q('authenticated', A, `update public.strategy_messages set content='x'`)).rejects.toThrow(/permission denied/i);
    await expect(h.q('authenticated', A, `delete from public.strategy_messages`)).rejects.toThrow(/permission denied/i);
  });
});

describe('migration static checks', () => {
  it('is additive, RLS everywhere, invoker only', () => {
    const sql = h.migrationSql;
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).not.toMatch(/alter\s+table[^;]*\b(drop|rename)\b/i);
    expect(sql).not.toMatch(/security\s+definer/i);
    expect(sql).not.toMatch(/service_role/i);
    for (const t of ['user_strategy', 'strategy_items', 'strategy_actions', 'strategy_messages']) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
    }
  });
});
