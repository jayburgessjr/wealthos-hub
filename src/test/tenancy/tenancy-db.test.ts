// Tenancy hardening (slice TEN) against the REAL policies/functions of the repo migrations in pglite.
// F1 profiles.household_id, F2 user_roles, F3 invitations, F4 helper oracle, F5 stripe unique, F6 create_household,
// F8 households policies. Every negative test is cross-household; the positive flow runs the whole legitimate path.
import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  makeTenancyHarness, readMigration, F, TEN_PATH, OA, OB, MB, DRIFT, U1, U2, U3, HA, HB, TOKEN,
  type TenancyHarness,
} from './tenancy-harness';

/** First argument text of every `fn(` call in sql (up to the first top-level comma), skipping type-signature uses. */
function firstArgs(sql: string, fn: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`${fn}\\s*\\(`, 'gi');
  for (const m of sql.matchAll(re)) {
    let i = m.index! + m[0].length;
    let depth = 0;
    let arg = '';
    for (; i < sql.length; i++) {
      const c = sql[i];
      if (c === '(') depth++;
      else if (c === ')') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) break;
      arg += c;
    }
    if (!/^\s*(uuid|_user_id)\b/i.test(arg)) out.push(arg.trim());
  }
  return out;
}

const fails = async (p: Promise<unknown>, re: RegExp) => {
  await expect(p).rejects.toThrow(re);
};
const count = async (h: TenancyHarness, caller: 'authenticated' | 'postgres', uid: string | null, sql: string) =>
  Number((await h.q(caller, uid, sql))[0].c);

describe('fixture fidelity: the pre-migration exploits are real (reproduce first)', () => {
  let h: TenancyHarness;
  beforeAll(async () => { h = await makeTenancyHarness({ applyTen: false }); }, 60000);

  it('names dropped by the migration exist in the real pre-migration policy set (no silent no-op drops)', async () => {
    const rows = await h.q('postgres', null, `select tablename, policyname from pg_policies`);
    const have = new Set(rows.map((r) => `${r.tablename}/${r.policyname}`));
    for (const n of [
      'user_roles/Users can insert their own role', 'user_roles/Owners can manage roles',
      'invitations/Invited user can view their invitation', 'invitations/Invited user can accept invitation',
      'profiles/Owners can manage profiles in their household',
      'households/Users can view their household', 'households/Owners can update their household',
    ]) expect(have.has(n), n).toBe(true);
  });

  it('F1 and F2 are exploitable before the migration', async () => {
    await h.q('authenticated', U1, `update public.profiles set household_id = '${HB}' where id = '${U1}'`);
    expect(await count(h, 'authenticated', U1, `select count(*) c from public.bills where household_id = '${HB}'`)).toBe(1);
    await h.q('authenticated', U2, `insert into public.user_roles(user_id, household_id, role) values ('${U2}', '${HA}', 'owner')`);
    expect(await count(h, 'postgres', null, `select count(*) c from public.user_roles where user_id = '${U2}' and role = 'owner'`)).toBe(1);
  });

  it('F4 oracle answers for any uid before the migration', async () => {
    const r = await h.q('authenticated', U3, `select public.get_user_household_id('${OB}') as hid`);
    expect(r[0].hid).toBe(HB);
  });
});

describe('negative: cross-household attacks fail (F1-F4, F6, F8)', () => {
  let h: TenancyHarness;
  beforeAll(async () => { h = await makeTenancyHarness(); }, 60000);
  const bills = (uid: string, hid: string) =>
    count(h, 'authenticated', uid, `select count(*) c from public.bills where household_id = '${hid}'`);

  it('F1: self-assigning household_id fails and exposes nothing', async () => {
    await fails(h.q('authenticated', U1, `update public.profiles set household_id = '${HB}' where id = '${U1}'`), /insufficient privilege/);
    expect(await count(h, 'postgres', null, `select count(*) c from public.profiles where id = '${U1}' and household_id is null`)).toBe(1);
    expect(await bills(U1, HB)).toBe(0);
    expect(await bills(U1, HA)).toBe(0);
  });

  it('F1: an owner cannot move themselves into, or move members of, another household', async () => {
    await fails(h.q('authenticated', OA, `update public.profiles set household_id = '${HB}' where id = '${OA}'`), /insufficient privilege/);
    // OA cannot even see MB; the dropped owner-update policy means no row is writable
    const r = await h.q('authenticated', OA, `update public.profiles set household_id = null where id = '${MB}' returning id`);
    expect(r).toHaveLength(0);
    expect(await count(h, 'postgres', null, `select count(*) c from public.profiles where id = '${MB}' and household_id = '${HB}'`)).toBe(1);
  });

  it('F1: client profile INSERT cannot carry a household_id', async () => {
    await h.db.exec(`insert into auth.users(id, email, email_confirmed_at) values ('44444444-4444-4444-4444-444444444444', 'u4@example.test', now());
      delete from public.profiles where id = '44444444-4444-4444-4444-444444444444'`);
    await h.q('authenticated', '44444444-4444-4444-4444-444444444444',
      `insert into public.profiles(id, display_name, email, household_id) values ('44444444-4444-4444-4444-444444444444', 'U4', 'u4@example.test', '${HB}')`);
    expect(await count(h, 'postgres', null, `select count(*) c from public.profiles where id = '44444444-4444-4444-4444-444444444444' and household_id is null`)).toBe(1);
  });

  it('F2 cascade: a forged profile pointer without a role row yields no household and no data', async () => {
    await h.db.exec(`update public.profiles set household_id = '${HB}' where id = '${U1}'`); // simulate drift as the table owner
    const r = await h.q('authenticated', U1, `select public.get_user_household_id('${U1}') as hid`);
    expect(r[0].hid).toBeNull();
    expect(await bills(U1, HB)).toBe(0);
    await h.db.exec(`update public.profiles set household_id = null where id = '${U1}'`);
  });

  it('F2: self-inserting an owner role, upserting, updating or deleting roles all fail', async () => {
    await fails(h.q('authenticated', U1, `insert into public.user_roles(user_id, household_id, role) values ('${U1}', '${HA}', 'owner')`), /permission denied/);
    await fails(h.q('authenticated', U1, `insert into public.user_roles(user_id, household_id, role) values ('${U1}', '${HA}', 'owner') on conflict (user_id, household_id) do update set role = 'owner'`), /permission denied/);
    await fails(h.q('authenticated', MB, `update public.user_roles set role = 'owner' where user_id = '${MB}'`), /permission denied/);
    await fails(h.q('authenticated', OB, `delete from public.user_roles where user_id = '${MB}'`), /permission denied/);
    await fails(h.q('authenticated', OA, `insert into public.user_roles(user_id, household_id, role) values ('${OA}', '${HB}', 'owner')`), /permission denied/);
    await fails(h.q('authenticated', OA, `update public.user_roles set role = 'member' where household_id = '${HB}'`), /permission denied/);
  });

  it('F2: even if the grant came back, no policy allows a client write (defence in depth)', async () => {
    await h.db.exec('grant insert, update, delete on public.user_roles to authenticated');
    try {
      await fails(h.q('authenticated', U1, `insert into public.user_roles(user_id, household_id, role) values ('${U1}', '${HA}', 'owner')`), /row-level security/);
      expect(await h.q('authenticated', OA, `update public.user_roles set role = 'member' where household_id = '${HB}' returning user_id`)).toHaveLength(0);
      expect(await h.q('authenticated', OB, `delete from public.user_roles where user_id = '${MB}' returning user_id`)).toHaveLength(0);
    } finally {
      await h.db.exec('revoke insert, update, delete on public.user_roles from authenticated');
    }
    const pol = await h.q('postgres', null, `select cmd from pg_policies where tablename = 'user_roles'`);
    expect(pol.map((p) => p.cmd).sort()).toEqual(['SELECT', 'SELECT']);
  });

  it('F3: setting profiles.email to the invitee address grants nothing', async () => {
    await h.q('authenticated', U1, `update public.profiles set email = 'u2@example.test' where id = '${U1}'`);
    expect(await count(h, 'authenticated', U1, `select count(*) c from public.invitations`)).toBe(0);
    await fails(h.q('authenticated', U1, `select public.accept_invitation('${TOKEN}')`), /invitation_unavailable/);
    expect(await count(h, 'postgres', null, `select count(*) c from public.user_roles where user_id = '${U1}'`)).toBe(0);
  });

  it('F3: an unconfirmed email cannot read or accept even with the matching address', async () => {
    expect(await count(h, 'authenticated', U3, `select count(*) c from public.invitations`)).toBe(0);
    await fails(h.q('authenticated', U3, `select public.accept_invitation('tok-for-u3-into-a')`), /invitation_unavailable/);
  });

  it('F3/F6: unknown token is indistinguishable; invitee cannot update invitations (no household_id rewrite)', async () => {
    await fails(h.q('authenticated', U2, `select public.accept_invitation('nope')`), /invitation_unavailable/);
    expect(await h.q('authenticated', U2, `update public.invitations set household_id = '${HB}' where token = '${TOKEN}' returning id`)).toHaveLength(0);
    expect(await h.q('authenticated', U2, `update public.invitations set status = 'accepted' where token = '${TOKEN}' returning id`)).toHaveLength(0);
  });

  it('F3: an owner of A cannot read or create invitations for B', async () => {
    await h.db.exec(`insert into public.invitations(token, household_id, email, invited_by) values ('tok-b', '${HB}', 'x@example.test', '${OB}')`);
    expect(await count(h, 'authenticated', OA, `select count(*) c from public.invitations where household_id = '${HB}'`)).toBe(0);
    await fails(h.q('authenticated', OA, `insert into public.invitations(token, household_id, email, invited_by) values ('t2', '${HB}', 'y@example.test', '${OA}')`), /row-level security/);
  });

  it('F3: a token for another invitee cannot be used (same error, no state change)', async () => {
    await fails(h.q('authenticated', MB, `select public.accept_invitation('${TOKEN}')`), /invitation_unavailable/);
    expect(await count(h, 'postgres', null, `select count(*) c from public.invitations where token = '${TOKEN}' and status = 'pending'`)).toBe(1);
  });

  it('F4: helpers return nothing for other uids, truth for the caller, truth for service_role', async () => {
    const other = await h.q('authenticated', U1, `select public.get_user_household_id('${OB}') a, public.is_household_member('${OB}', '${HB}') b, public.has_household_role('${OB}', '${HB}', 'owner') c`);
    expect(other[0]).toEqual({ a: null, b: false, c: false });
    const own = await h.q('authenticated', OB, `select public.get_user_household_id('${OB}') a, public.is_household_member('${OB}', '${HB}') b, public.has_household_role('${OB}', '${HB}', 'owner') c`);
    expect(own[0]).toEqual({ a: HB, b: true, c: true });
    const svc = await h.q('service_role', null, `select public.get_user_household_id('${OB}') a, public.is_household_member('${OB}', '${HB}') b, public.has_household_role('${OB}', '${HB}', 'owner') c`);
    expect(svc[0]).toEqual({ a: HB, b: true, c: true });
  });

  it('F4: anon has no EXECUTE on the helpers, the verified-email helper, or any RPC', async () => {
    for (const call of [
      `public.get_user_household_id('${OB}')`, `public.is_household_member('${OB}', '${HB}')`,
      `public.has_household_role('${OB}', '${HB}', 'owner')`, `public.auth_verified_email()`,
      `public.accept_invitation('x')`, `public.switch_active_household('${HB}')`,
      `public.set_member_role('${HB}', '${MB}', 'owner')`, `public.remove_member('${HB}', '${MB}')`,
    ]) await fails(h.q('anon', null, `select ${call}`), /permission denied for function/);
  });

  it('F6: anon cannot execute create_household', async () => {
    await fails(h.q('anon', null, `select public.create_household('x', 1)`), /permission denied for function/);
  });

  it('F8: households SELECT/UPDATE policies are TO authenticated only', async () => {
    const rows = await h.q('postgres', null, `select cmd, roles::text r from pg_policies where tablename = 'households' order by cmd`);
    expect(rows).toEqual([{ cmd: 'SELECT', r: '{authenticated}' }, { cmd: 'UPDATE', r: '{authenticated}' }]);
    // anon keeps the fixture's blanket table grant, so the policy itself must return nothing
    expect(await h.q('anon', null, `select id from public.households`)).toHaveLength(0);
  });

  it('F8: non-owner members and owners of other households cannot update a household', async () => {
    expect(await h.q('authenticated', MB, `update public.households set name = 'x' where id = '${HB}' returning id`)).toHaveLength(0);
    expect(await h.q('authenticated', OA, `update public.households set name = 'x' where id = '${HB}' returning id`)).toHaveLength(0);
    expect(await h.q('authenticated', OB, `update public.households set name = 'House B2' where id = '${HB}' returning id`)).toHaveLength(1);
  });

  it('RPC authorization: switch / set role / remove across households', async () => {
    await fails(h.q('authenticated', OA, `select public.switch_active_household('${HB}')`), /not_a_member/);
    await fails(h.q('authenticated', MB, `select public.set_member_role('${HB}', '${MB}', 'owner')`), /not_owner/);
    await fails(h.q('authenticated', OA, `select public.set_member_role('${HB}', '${MB}', 'owner')`), /not_owner/);
    await fails(h.q('authenticated', OB, `select public.set_member_role('${HB}', '${OB}', 'member')`), /last_owner/);
    await fails(h.q('authenticated', MB, `select public.remove_member('${HB}', '${OB}')`), /not_owner/);
    await fails(h.q('authenticated', OA, `select public.remove_member('${HB}', '${MB}')`), /not_owner/);
    await fails(h.q('authenticated', OB, `select public.remove_member('${HB}', '${OB}')`), /last_owner/);
    await fails(h.q('authenticated', OB, `select public.set_member_role('${HB}', '${U1}', 'member')`), /not_a_member/);
    expect(await count(h, 'postgres', null, `select count(*) c from public.user_roles where household_id = '${HB}'`)).toBe(2);
  });
});

describe('positive: the whole legitimate flow', () => {
  let h: TenancyHarness;
  let hid: string;
  let h2: string;
  beforeAll(async () => { h = await makeTenancyHarness(); }, 60000);

  it('create_household makes the caller owner, sets the pointer and seeds categories', async () => {
    hid = (await h.q('authenticated', U1, `select public.create_household('Home', 1000) as id`))[0].id as string;
    expect(await h.q('postgres', null, `select role from public.user_roles where user_id = '${U1}' and household_id = '${hid}'`)).toEqual([{ role: 'owner' }]);
    expect((await h.q('authenticated', U1, `select public.get_user_household_id('${U1}') as hid`))[0].hid).toBe(hid);
    expect(await count(h, 'authenticated', U1, `select count(*) c from public.categories where household_id = '${hid}'`)).toBe(4);
  });

  it('the owner invites; only the verified invitee can read it; accept joins as member and activates', async () => {
    await h.q('authenticated', U1, `insert into public.invitations(token, household_id, email, invited_by) values ('tok-pos', '${hid}', 'U2@Example.test', '${U1}')`);
    expect(await count(h, 'authenticated', U2, `select count(*) c from public.invitations where token = 'tok-pos'`)).toBe(1); // case-insensitive match
    expect((await h.q('authenticated', U2, `select public.accept_invitation('tok-pos') as id`))[0].id).toBe(hid);
    expect(await h.q('postgres', null, `select role from public.user_roles where user_id = '${U2}' and household_id = '${hid}'`)).toEqual([{ role: 'member' }]);
    expect(await h.q('postgres', null, `select status, accepted_at is not null as at from public.invitations where token = 'tok-pos'`)).toEqual([{ status: 'accepted', at: true }]);
    expect((await h.q('authenticated', U2, `select public.get_user_household_id('${U2}') as hid`))[0].hid).toBe(hid);
  });

  it('accepting twice is idempotent', async () => {
    expect((await h.q('authenticated', U2, `select public.accept_invitation('tok-pos') as id`))[0].id).toBe(hid);
    expect(await count(h, 'postgres', null, `select count(*) c from public.user_roles where user_id = '${U2}' and household_id = '${hid}'`)).toBe(1);
  });

  it('accepting never downgrades an existing owner', async () => {
    await h.db.exec(`insert into public.invitations(token, household_id, email, invited_by) values ('tok-own', '${hid}', 'u1@example.test', '${U1}')`);
    await h.q('authenticated', U1, `select public.accept_invitation('tok-own')`);
    expect(await h.q('postgres', null, `select role from public.user_roles where user_id = '${U1}' and household_id = '${hid}'`)).toEqual([{ role: 'owner' }]);
  });

  it('list (own roles joined to member households) and switch change what the data policies show', async () => {
    h2 = (await h.q('authenticated', U2, `select public.create_household('Mine', 5) as id`))[0].id as string;
    await h.db.exec(`insert into public.bills(household_id, name, amount, due_date) values ('${hid}', 'shared-bill', 5, current_date)`);
    const list = await h.q('authenticated', U2, `select r.household_id, r.role, h.name from public.user_roles r join public.households h on h.id = r.household_id where r.user_id = '${U2}' order by h.name`);
    expect(list.map((r) => [r.name, r.role])).toEqual([['Home', 'member'], ['Mine', 'owner']]);
    expect(await count(h, 'authenticated', U2, `select count(*) c from public.bills where household_id = '${hid}'`)).toBe(0); // active = h2
    await h.q('authenticated', U2, `select public.switch_active_household('${hid}')`);
    expect((await h.q('authenticated', U2, `select public.get_user_household_id('${U2}') as hid`))[0].hid).toBe(hid);
    expect(await count(h, 'authenticated', U2, `select count(*) c from public.bills where household_id = '${hid}'`)).toBe(1);
    await h.q('authenticated', U2, `select public.switch_active_household('${h2}')`);
    expect((await h.q('authenticated', U2, `select public.get_user_household_id('${U2}') as hid`))[0].hid).toBe(h2);
  });

  it('roles: promote, demote with another owner present, last-owner protection', async () => {
    await h.q('authenticated', U1, `select public.set_member_role('${hid}', '${U2}', 'owner')`);
    await h.q('authenticated', U2, `select public.set_member_role('${hid}', '${U1}', 'member')`); // two owners present
    await fails(h.q('authenticated', U2, `select public.set_member_role('${hid}', '${U2}', 'member')`), /last_owner/);
    await fails(h.q('authenticated', U1, `select public.set_member_role('${hid}', '${U1}', 'owner')`), /not_owner/);
    await h.q('authenticated', U2, `select public.set_member_role('${hid}', '${U1}', 'owner')`); // same-role no-op path also fine below
    await h.q('authenticated', U2, `select public.set_member_role('${hid}', '${U1}', 'owner')`);
    expect(await count(h, 'postgres', null, `select count(*) c from public.user_roles where household_id = '${hid}' and role = 'owner'`)).toBe(2);
    await fails(h.q('authenticated', U1, `select public.set_member_role('${hid}', '${U3}', 'member')`), /not_a_member/);
  });

  it('leave: self-leave moves the pointer to another membership and revokes access', async () => {
    await h.q('authenticated', U2, `select public.switch_active_household('${hid}')`);
    await h.q('authenticated', U2, `select public.remove_member('${hid}', '${U2}')`);
    expect(await count(h, 'postgres', null, `select count(*) c from public.user_roles where user_id = '${U2}' and household_id = '${hid}'`)).toBe(0);
    expect((await h.q('authenticated', U2, `select public.get_user_household_id('${U2}') as hid`))[0].hid).toBe(h2);
    expect(await count(h, 'authenticated', U2, `select count(*) c from public.bills where household_id = '${hid}'`)).toBe(0);
    await h.q('authenticated', U2, `select public.remove_member('${hid}', '${U2}')`); // idempotent
  });

  it('owner removes a member: pointer cleared; the last owner cannot leave', async () => {
    await h.q('authenticated', OB, `select public.remove_member('${HB}', '${MB}')`);
    expect(await h.q('postgres', null, `select household_id from public.profiles where id = '${MB}'`)).toEqual([{ household_id: null }]);
    expect(await count(h, 'authenticated', MB, `select count(*) c from public.bills`)).toBe(0);
    await fails(h.q('authenticated', U1, `select public.remove_member('${hid}', '${U1}')`), /last_owner/);
  });

  it('household owners can still update their household and manage invitations/bills', async () => {
    expect(await h.q('authenticated', U1, `update public.households set name = 'Home 2' where id = '${hid}' returning id`)).toHaveLength(1);
    expect(await h.q('authenticated', OA, `insert into public.bills(household_id, name, amount, due_date) values ('${HA}', 'x', 1, current_date) returning id`)).toHaveLength(1);
    await fails(h.q('authenticated', OA, `insert into public.bills(household_id, name, amount, due_date) values ('${HB}', 'x', 1, current_date)`), /row-level security/);
  });
});

describe('policy sweep: every helper call site still works (155 in the repo)', () => {
  const HELPERS = ['get_user_household_id', 'has_household_role', 'is_household_member'];

  it('every helper call in every migration passes auth.uid() as the user argument', () => {
    const dir = resolve(__dirname, '../../../supabase/migrations');
    let total = 0;
    const bad: string[] = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
      const sql = readMigration(f);
      for (const fn of HELPERS) {
        for (const arg of firstArgs(sql, fn)) {
          total++;
          if (!/^(\(\s*select\s+auth\.uid\(\)\s*\)|auth\.uid\(\))$/i.test(arg)) bad.push(`${f}: ${fn}(${arg}`);
        }
      }
    }
    expect(bad).toEqual([]);
    expect(total).toBeGreaterThanOrEqual(155);
  });

  it('edge functions never call the helpers (service role bypasses RLS)', () => {
    const fnDir = resolve(__dirname, '../../../supabase/functions');
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(resolve(d, e.name)) : [resolve(d, e.name)]));
    const hits = walk(fnDir).filter((p) => /\.(ts|js)$/.test(p) && HELPERS.some((fn) => readFileSync(p, 'utf8').includes(fn)));
    expect(hits).toEqual([]);
  });

  describe('in the fixture', () => {
    let h: TenancyHarness;
    beforeAll(async () => { h = await makeTenancyHarness(); }, 60000);

    it('every live policy calling a helper uses auth.uid() as its first argument', async () => {
      const rows = await h.q('postgres', null, `select tablename, policyname, coalesce(qual,'') || ' ' || coalesce(with_check,'') as expr from pg_policies`);
      const withHelper = rows.filter((r) => HELPERS.some((fn) => String(r.expr).includes(fn)));
      expect(withHelper.length).toBeGreaterThan(8);
      for (const r of withHelper) {
        for (const fn of HELPERS) {
          for (const arg of firstArgs(String(r.expr), fn)) expect(arg, `${r.tablename}/${r.policyname}`).toMatch(/auth\.uid\(\)/);
        }
      }
    });

    it('each helper-protected table: members see own household rows, nothing else; strangers see nothing', async () => {
      const tables = (await h.q('postgres', null, `select distinct c.relname t from pg_policies p join pg_class c on c.relname = p.tablename
        join pg_attribute a on a.attrelid = c.oid and a.attname = 'household_id' and not a.attisdropped
        where p.schemaname = 'public' and c.relkind = 'r' and c.relname not in ('profiles','user_roles','invitations')
          and (p.qual like '%household%' or p.with_check like '%household%')`)).map((r) => String(r.t));
      expect(tables).toEqual(expect.arrayContaining(['bills', 'categories', 'goals']));
      await h.db.exec(`insert into public.categories(household_id, name) values ('${HA}', 'ca'), ('${HB}', 'cb');
        insert into public.goals(household_id, name, target_amount) values ('${HA}', 'ga', 1), ('${HB}', 'gb', 1)`);
      for (const t of tables) {
        const own = await count(h, 'authenticated', OA, `select count(*) c from public.${t} where household_id = '${HA}'`);
        const other = await count(h, 'authenticated', OA, `select count(*) c from public.${t} where household_id = '${HB}'`);
        const stranger = await count(h, 'authenticated', U1, `select count(*) c from public.${t}`);
        expect(other, `${t} other household`).toBe(0);
        expect(stranger, `${t} stranger`).toBe(0);
        if (['bills', 'categories', 'goals'].includes(t)) expect(own, `${t} own`).toBeGreaterThan(0);
      }
    });

    it('owner-only write policies (has_household_role) still authorize owners and refuse members', async () => {
      expect(await h.q('authenticated', OB, `insert into public.goals(household_id, name, target_amount) values ('${HB}', 'g2', 1) returning id`)).toHaveLength(1);
      await fails(h.q('authenticated', MB, `insert into public.goals(household_id, name, target_amount) values ('${HB}', 'g3', 1)`), /row-level security/);
      await fails(h.q('authenticated', OA, `insert into public.goals(household_id, name, target_amount) values ('${HB}', 'g4', 1)`), /row-level security/);
    });

    it('profiles: members of a household still see each other, and nobody else', async () => {
      expect(await count(h, 'authenticated', OB, `select count(*) c from public.profiles`)).toBe(2); // OB + MB
      expect(await count(h, 'authenticated', U1, `select count(*) c from public.profiles`)).toBe(1); // only self
    });
  });
});

describe('migration: idempotence, backfill, stripe index', () => {
  let h: TenancyHarness;
  beforeAll(async () => { h = await makeTenancyHarness({ applyTen: false }); }, 60000);
  const roles = (hh: TenancyHarness) => hh.q('postgres', null, `select user_id, household_id, role from public.user_roles order by user_id, household_id`);

  it('backfill gives a pointer-without-role user a member role (never owner); a second run inserts nothing', async () => {
    expect(await count(h, 'postgres', null, `select count(*) c from public.user_roles where user_id = '${DRIFT}'`)).toBe(0);
    const before = await roles(h);
    await h.db.exec(h.tenSql);
    const after = await roles(h);
    expect(after).toHaveLength(before.length + 1);
    expect(after.find((r) => r.user_id === DRIFT)).toMatchObject({ household_id: HA, role: 'member' });
    expect(after.filter((r) => r.role === 'owner')).toEqual(before.filter((r) => r.role === 'owner'));
    // DRIFT keeps working after the stricter helper
    expect((await h.q('authenticated', DRIFT, `select public.get_user_household_id('${DRIFT}') as hid`))[0].hid).toBe(HA);
    await h.db.exec(h.tenSql);
    await h.db.exec(h.tenSql);
    expect(await roles(h)).toEqual(after);
  });

  it('re-applying leaves one policy per name and one trigger per guard', async () => {
    const pol = await h.q('postgres', null, `select tablename, policyname from pg_policies where tablename in ('user_roles','invitations','households','profiles')`);
    const names = pol.map((p) => `${p.tablename}/${p.policyname}`);
    expect(new Set(names).size).toBe(names.length);
    const trg = await h.q('postgres', null, `select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and not tgisinternal and tgname like 'profiles_guard_household%' order by 1`);
    expect(trg).toEqual([{ tgname: 'profiles_guard_household' }, { tgname: 'profiles_guard_household_insert' }]);
  });

  it('F5: the stripe_customer_id unique index exists on clean data and blocks a duplicate', async () => {
    const idx = await h.q('postgres', null, `select indexdef from pg_indexes where indexname = 'profiles_stripe_customer_id_key'`);
    expect(idx).toHaveLength(1);
    await h.db.exec(`update public.profiles set stripe_customer_id = 'cus_1' where id = '${OA}'`);
    await expect(h.db.exec(`update public.profiles set stripe_customer_id = 'cus_1' where id = '${OB}'`)).rejects.toThrow(/duplicate key|unique/);
    await h.db.exec(`update public.profiles set stripe_customer_id = null where id = '${OA}'`);
  });

  it('F5: with duplicate customer ids the migration still completes and skips the index', async () => {
    const d = await makeTenancyHarness({
      applyTen: true,
      seed: `update public.profiles set stripe_customer_id = 'cus_dup' where id in ('${OA}', '${OB}')`,
    });
    expect(await d.q('postgres', null, `select 1 from pg_indexes where indexname = 'profiles_stripe_customer_id_key'`)).toHaveLength(0);
    expect(await count(d, 'postgres', null, `select count(*) c from public.user_roles`)).toBe(4);
  });

  it('the migration sorts after SEC and Desk and its version is unique', () => {
    const files = readdirSync(resolve(__dirname, '../../../supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
    const versions = files.map((f) => f.split('_')[0]);
    expect(new Set(versions).size).toBe(versions.length);
    expect(files.indexOf(TEN_PATH.split('/').pop()!)).toBeGreaterThan(files.indexOf(F.sec));
    expect(readMigration(F.ten)).not.toMatch(/\bdrop\s+(table|column)\b/i);
  });
});
