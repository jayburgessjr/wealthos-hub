// @vitest-environment node
// QA attacks against the real migration on pglite: guard bypass, GUC spoofing, replay, immutability.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeHarness, OTHER, OWNER, type Harness } from "../desk-db/harness";

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
}, 60_000);
afterEach(async () => {
  await h.db.close();
});

const approvedProposal = async () => {
  const po = await h.seedProposal();
  const ap = await h.approve(po);
  return { po, ap };
};

describe("attack: GUC spoofing", () => {
  for (const [caller, uid] of [["authenticated", OWNER], ["service_role", null], ["authenticated", OTHER]] as const) {
    it(`${caller}/${uid ? "uid" : "null"} sets desk.internal=1 then forces a proposal to 'approved'`, async () => {
      const po = await h.seedProposal();
      await h.q(caller, uid, `select set_config('desk.internal','1',false)`);
      // either an error or a zero-row no-op (RLS hides the row from a non-owner); the status must not move
      await h.q(caller, uid, `update public.desk_proposed_orders set status='approved' where id='${po}'`).catch(() => undefined);
      expect((await h.q("postgres", null, `select status from public.desk_proposed_orders where id='${po}'`))[0].status).toBe("pending");
    });
    it(`${caller}/${uid ? "uid" : "null"} sets desk.internal=1 then rewrites an approval to unconsumed`, async () => {
      const { ap } = await approvedProposal();
      await h.q(caller, uid, `select set_config('desk.internal','1',false)`);
      await h.q(caller, uid, `update public.desk_approvals set consumed_at = now() where id='${ap}'`).catch(() => undefined);
      await h.q(caller, uid, `update public.desk_approvals set risk_passed = false where id='${ap}'`).catch(() => undefined);
      const row = (await h.q("postgres", null, `select consumed_at, risk_passed from public.desk_approvals where id='${ap}'`))[0];
      expect(row.consumed_at).toBeNull();
      expect(row.risk_passed).toBe(true);
    });
    it(`${caller}/${uid ? "uid" : "null"} sets desk.reset=1 then clears the kill switch`, async () => {
      await h.q("postgres", null, `update public.desk_state set halted = true, halted_reason = 'test', high_water_mark = 100000`);
      await h.q(caller, uid, `select set_config('desk.reset','1',false)`);
      await h.q(caller, uid, `update public.desk_state set halted=false`).catch(() => undefined);
      await h.q(caller, uid, `update public.desk_state set high_water_mark = 1`).catch(() => undefined);
      const st = (await h.q("postgres", null, `select halted, high_water_mark::float8 as hwm from public.desk_state`))[0];
      expect(st.halted).toBe(true);
      expect(st.hwm).toBe(100000);
    });
  }
  it("desk_internal() is not callable by anon/authenticated, and is false for service_role at top level", async () => {
    for (const role of ["authenticated", "anon"] as const) {
      await expect(h.q(role, role === "anon" ? null : OWNER, `select public.desk_internal()`)).rejects.toThrow();
    }
    await h.q("service_role", null, `select set_config('desk.internal','1',false)`);
    expect((await h.q("service_role", null, `select public.desk_internal() as v`))[0].v).toBe(false);
  });
  it("kill switch reset: service role (no uid) and non-owner are refused, owner succeeds", async () => {
    await h.q("postgres", null, `update public.desk_state set halted = true, last_equity = 50000`);
    await expect(h.q("service_role", null, `select public.desk_reset_kill_switch('x')`)).rejects.toThrow(/owner only/);
    await expect(h.q("authenticated", OTHER, `select public.desk_reset_kill_switch('x')`)).rejects.toThrow(/owner only/);
    await expect(h.q("anon", null, `select public.desk_reset_kill_switch('x')`)).rejects.toThrow();
    await h.q("authenticated", OWNER, `select public.desk_reset_kill_switch('reviewed')`);
    expect((await h.q("postgres", null, `select halted from public.desk_state`))[0].halted).toBe(false);
    expect((await h.q("postgres", null, `select count(*)::int c from public.desk_risk_events where event_type='kill_switch_reset'`))[0].c).toBe(1);
  });
});

describe("attack: approval replay, forgery and tamper", () => {
  it("an approval cannot be reused for a second order", async () => {
    const { po, ap } = await approvedProposal();
    await h.insertOrder(ap, po);
    await expect(h.insertOrder(ap, po)).rejects.toThrow();
  });
  it("an approval for proposal A cannot authorise an order for proposal B", async () => {
    const a = await approvedProposal();
    const b = await h.seedProposal();
    await h.approve(b);
    await expect(h.insertOrder(a.ap, b)).rejects.toThrow();
  });
  it("a rejected approval, or an approved-but-risk-failed approval, never authorises an order", async () => {
    const po1 = await h.seedProposal();
    const ap1 = await h.approve(po1, { decision: "'rejected'" });
    await expect(h.insertOrder(ap1, po1)).rejects.toThrow();
    const po2 = await h.seedProposal();
    const ap2 = await h.approve(po2, { risk_passed: "false" });
    await expect(h.insertOrder(ap2, po2)).rejects.toThrow();
  });
  it("a live-mode order cannot ride a paper approval, and a live approval without confirmation is refused", async () => {
    const { po, ap } = await approvedProposal();
    await expect(h.insertOrder(ap, po, { mode: "'live'" })).rejects.toThrow();
    const po2 = await h.seedProposal();
    await expect(h.approve(po2, { mode: "'live'" })).rejects.toThrow();
  });
  it("an order that quietly changes side, qty or stop versus the proposal is refused", async () => {
    for (const over of [{ side: "'sell'" }, { qty: "11" }, { stop_price: "94" }, { stop_price: "0" }, { stop_price: "-1" }, { qty: "1e9" }]) {
      const { po, ap } = await approvedProposal();
      await expect(h.insertOrder(ap, po, over), JSON.stringify(over)).rejects.toThrow();
    }
  });
  it("an order with a NULL stop is refused at the database", async () => {
    const { po, ap } = await approvedProposal();
    await expect(
      h.q("service_role", null, `insert into public.desk_orders(approval_id, proposed_order_id, instrument_id, mode, broker, client_order_id, intent, structure, side, qty, order_type, stop_price)
        values ('${ap}','${po}','${h.instrumentId}','paper','paper','${ap}','open','stock','buy',10,'market',null)`),
    ).rejects.toThrow();
  });
  it("a proposal with an expired expires_at cannot be approved", async () => {
    const rows = await h.q("service_role", null,
      `insert into public.desk_proposed_orders(instrument_id, agent_name, side, qty, order_type, limit_price, stop_price, expires_at)
       values ('${h.instrumentId}','a','buy',1,'limit',100,95, now() - interval '1 minute') returning id`);
    await expect(h.approve(rows[0].id as string)).rejects.toThrow(/not pending/);
  });
  it("a second decision on the same proposal is refused (approve after reject, reject after approve)", async () => {
    const po = await h.seedProposal();
    await h.approve(po, { decision: "'rejected'" });
    await expect(h.approve(po)).rejects.toThrow();
    const po2 = await h.seedProposal();
    await h.approve(po2);
    await expect(h.approve(po2, { decision: "'rejected'" })).rejects.toThrow();
  });
  it("an approval cannot be inserted already consumed, nor deleted, nor edited by the owner", async () => {
    const po = await h.seedProposal();
    await expect(
      h.q("authenticated", OWNER, `insert into public.desk_approvals(proposed_order_id, decision, risk_passed, risk_decision, risk_input_hash, mode, decided_by, consumed_at)
        values ('${po}','approved',true,'{}','h','paper','${OWNER}', now())`),
    ).rejects.toThrow(/consumed/);
    const { ap } = await approvedProposal();
    await expect(h.q("authenticated", OWNER, `delete from public.desk_approvals where id='${ap}'`)).rejects.toThrow();
    await expect(h.q("postgres", null, `delete from public.desk_approvals where id='${ap}'`)).rejects.toThrow(/immutable/);
    await expect(h.q("authenticated", OWNER, `update public.desk_approvals set risk_passed = true where id='${ap}'`)).rejects.toThrow();
  });
  // DEFECT D15 (non-blocking): decided_at is client-supplied, so an owner session can post a future decided_at and the
  // 5-minute freshness window never expires. Smallest fix: `new.decided_at := now()` in desk_approvals_guard.
  it.fails("the owner cannot extend the 5-minute approval window with a future decided_at", async () => {
    const po = await h.seedProposal();
    const ap = await h.approve(po, { decided_at: "now() + interval '30 days'" });
    const r = await h.q("postgres", null, `select (decided_at > now() + interval '1 minute') as future from public.desk_approvals where id='${ap}'`);
    expect(r[0].future).toBe(false);
  });
  // DEFECT D16 (non-blocking): desk_orders.client_order_id is documented as = approval_id but only unique, so an order can carry a forged id.
  it.fails("an order's client_order_id must equal its approval id", async () => {
    const { po, ap } = await approvedProposal();
    await expect(
      h.q("service_role", null, `insert into public.desk_orders(approval_id, proposed_order_id, instrument_id, mode, broker, client_order_id, intent, structure, side, qty, order_type, limit_price, stop_price, target_price)
        values ('${ap}','${po}','${h.instrumentId}','paper','paper','forged-id-1','open','stock','buy',10,'limit',100,95,110)`),
    ).rejects.toThrow();
  });
});

describe("attack: immutability and deletion", () => {
  it("executed order economics cannot change; status fields can; deletes are refused", async () => {
    const { po, ap } = await approvedProposal();
    const id = (await h.insertOrder(ap, po))[0].id as string;
    for (const set of ["qty = 1", "stop_price = 1", "side = 'sell'", "limit_price = 1", "client_order_id = 'x'", "approval_id = gen_random_uuid()", "mode = 'live'", "structure = 'crypto'"]) {
      await expect(h.q("service_role", null, `update public.desk_orders set ${set} where id='${id}'`), set).rejects.toThrow();
    }
    await h.q("service_role", null, `update public.desk_orders set status='filled', filled_qty=10, avg_fill_price=100 where id='${id}'`);
    await expect(h.q("service_role", null, `delete from public.desk_orders where id='${id}'`)).rejects.toThrow();
    await expect(h.q("postgres", null, `delete from public.desk_orders where id='${id}'`)).rejects.toThrow();
    await expect(h.q("authenticated", OWNER, `update public.desk_orders set status='filled' where id='${id}'`)).rejects.toThrow();
  });
  it("risk events and scorecard rows cannot be updated or deleted by anyone with row privileges", async () => {
    await h.q("service_role", null, `insert into public.desk_risk_events(event_type, actor) values ('check_passed','x')`);
    for (const role of ["service_role", "postgres"] as const) {
      await expect(h.q(role, null, `delete from public.desk_risk_events`)).rejects.toThrow(/append-only/);
      await expect(h.q(role, null, `update public.desk_risk_events set actor='y'`)).rejects.toThrow(/append-only/);
    }
    await expect(h.q("authenticated", OWNER, `delete from public.desk_risk_events`)).rejects.toThrow();
    await expect(h.q("authenticated", OWNER, `insert into public.desk_risk_events(event_type, actor) values ('check_passed','x')`)).rejects.toThrow();
    await expect(h.q("anon", null, `select * from public.desk_risk_events`)).rejects.toThrow();
  });
  // DEFECT D14: row-level DELETE triggers do not fire for TRUNCATE, and service_role keeps the TRUNCATE privilege
  // (the migration revokes from anon/authenticated only). A service-role caller can wipe the append-only audit log
  // and the kill-switch state without tripping any guard. Smallest fix: `revoke truncate on all desk_ tables from service_role`
  // or add BEFORE TRUNCATE statement triggers that raise.
  it("service role cannot TRUNCATE the append-only risk event log", async () => {
    await h.q("service_role", null, `insert into public.desk_risk_events(event_type, actor) values ('kill_switch_tripped','system')`);
    await expect(h.q("service_role", null, `truncate public.desk_risk_events`)).rejects.toThrow();
    expect((await h.q("postgres", null, `select count(*)::int c from public.desk_risk_events`))[0].c).toBe(1);
  });
  it("service role cannot TRUNCATE the kill-switch state or the scorecard", async () => {
    await h.q("postgres", null, `update public.desk_state set halted = true`);
    await expect(h.q("service_role", null, `truncate public.desk_state`)).rejects.toThrow();
    expect((await h.q("postgres", null, `select halted from public.desk_state`))[0].halted).toBe(true);
    await expect(h.q("service_role", null, `truncate public.desk_scorecard`)).rejects.toThrow();
  });
  it("proposals are never deleted and economics are frozen for the service role", async () => {
    const po = await h.seedProposal();
    await expect(h.q("service_role", null, `delete from public.desk_proposed_orders where id='${po}'`)).rejects.toThrow();
    await expect(h.q("service_role", null, `update public.desk_proposed_orders set stop_price = 1 where id='${po}'`)).rejects.toThrow();
    await expect(h.q("service_role", null, `update public.desk_proposed_orders set status = 'executed' where id='${po}'`)).rejects.toThrow();
    await expect(h.q("service_role", null, `update public.desk_proposed_orders set status = 'approved' where id='${po}'`)).rejects.toThrow();
  });
  it("service role cannot insert a proposal already 'approved', with no stop, or with a negative stop", async () => {
    const cols = `instrument_id, agent_name, side, qty, order_type, limit_price`;
    const vals = `'${h.instrumentId}','a','buy',1,'limit',100`;
    await expect(h.q("service_role", null, `insert into public.desk_proposed_orders(${cols}, stop_price, status) values (${vals}, 95, 'approved')`)).rejects.toThrow();
    await expect(h.q("service_role", null, `insert into public.desk_proposed_orders(${cols}) values (${vals})`)).rejects.toThrow();
    await expect(h.q("service_role", null, `insert into public.desk_proposed_orders(${cols}, stop_price) values (${vals}, -3)`)).rejects.toThrow();
  });
  // DEFECT D17 (non-blocking): Postgres orders NaN above every number, so `stop_price > 0` and `qty > 0` accept the string 'NaN'.
  // The engine rejects a NaN stop at approval, so no order can result, but the "stop is NOT NULL and > 0" guarantee has a hole.
  it.fails("a NaN stop price or quantity is refused by the proposal constraints", async () => {
    const cols = `instrument_id, agent_name, side, qty, order_type, limit_price`;
    await expect(h.q("service_role", null, `insert into public.desk_proposed_orders(${cols}, stop_price) values ('${h.instrumentId}','a','buy',1,'limit',100,'NaN')`)).rejects.toThrow();
    await expect(h.q("service_role", null, `insert into public.desk_proposed_orders(${cols}, stop_price) values ('${h.instrumentId}','a','buy','NaN','limit',100,95)`)).rejects.toThrow();
  });
  it("a close proposal needs a position id; a limit proposal needs a limit price; option structures need legs", async () => {
    await expect(h.q("service_role", null, `insert into public.desk_proposed_orders(instrument_id, agent_name, side, qty, order_type, stop_price, intent) values ('${h.instrumentId}','a','sell',1,'market',90,'close')`)).rejects.toThrow();
    await expect(h.q("service_role", null, `insert into public.desk_proposed_orders(instrument_id, agent_name, side, qty, order_type, stop_price) values ('${h.instrumentId}','a','buy',1,'limit',90)`)).rejects.toThrow();
    await expect(h.q("service_role", null, `insert into public.desk_proposed_orders(instrument_id, agent_name, side, qty, order_type, stop_price, structure) values ('${h.instrumentId}','a','sell',1,'market',90,'credit_spread')`)).rejects.toThrow();
  });
});

describe("attack: owner session abuse and roles", () => {
  it("owner cannot approve by editing status, nor edit economics beyond qty/limit/stop/target, nor edit a non-pending row", async () => {
    const po = await h.seedProposal();
    await expect(h.q("authenticated", OWNER, `update public.desk_proposed_orders set status='approved' where id='${po}'`)).rejects.toThrow();
    for (const set of ["side='sell'", "structure='crypto'", "instrument_id=gen_random_uuid()", "agent_name='x'", "intent='close'", "expires_at = now() + interval '99 days'"]) {
      await expect(h.q("authenticated", OWNER, `update public.desk_proposed_orders set ${set} where id='${po}'`), set).rejects.toThrow();
    }
    await h.q("authenticated", OWNER, `update public.desk_proposed_orders set stop_price = 96, qty = 5 where id='${po}'`);
    await expect(h.q("authenticated", OWNER, `update public.desk_proposed_orders set stop_price = 0 where id='${po}'`)).rejects.toThrow();
    await expect(h.q("authenticated", OWNER, `update public.desk_proposed_orders set stop_price = null where id='${po}'`)).rejects.toThrow();
    const { po: po2 } = await approvedProposal();
    await h.q("authenticated", OWNER, `update public.desk_proposed_orders set qty = 9999 where id='${po2}'`).catch(() => undefined); // RLS: row not pending => no-op
    expect(Number((await h.q("postgres", null, `select qty from public.desk_proposed_orders where id='${po2}'`))[0].qty)).toBe(10);
  });
  it("non-owner authenticated user and anon can read and write nothing across all desk tables", async () => {
    await approvedProposal();
    const tables = ["desk_owner", "desk_state", "desk_instruments", "desk_agent_runs", "desk_signals", "desk_theses", "desk_proposed_orders", "desk_approvals", "desk_orders", "desk_positions", "desk_journal", "desk_scorecard", "desk_risk_events"];
    for (const t of tables) {
      expect((await h.q("authenticated", OTHER, `select count(*)::int c from public.${t}`))[0].c, t).toBe(0);
      await expect(h.q("anon", null, `select 1 from public.${t}`), `anon ${t}`).rejects.toThrow();
      await expect(h.q("authenticated", OTHER, `delete from public.${t}`), `delete ${t}`).rejects.toThrow();
    }
    await expect(h.q("authenticated", OTHER, `insert into public.desk_journal(author, entry_type, body) values ('owner','note','x')`)).rejects.toThrow();
    await expect(h.q("authenticated", OTHER, `update public.desk_instruments set on_watchlist = true`)).resolves.toEqual([]);
    expect((await h.q("postgres", null, `select count(*)::int c from public.desk_instruments where on_watchlist`))[0].c).toBe(0);
    expect((await h.q("authenticated", OTHER, `select public.is_desk_owner() as o`))[0].o).toBe(false);
    expect((await h.q("authenticated", null, `select public.is_desk_owner() as o`))[0].o).toBe(false);
  });
  it("the scorecard roll-up view leaks nothing to a non-owner", async () => {
    await h.q("service_role", null, `insert into public.desk_scorecard(subject_kind, subject_id, agent_name, horizon_days, t0_date, t0_price, tn_date, tn_price, return_pct, benchmark_return_pct, alpha_pct)
      values ('signal', gen_random_uuid(), 'a', 1, '2026-06-01', 1, '2026-06-02', 1, 0.1, 0.01, 0.09)`);
    expect((await h.q("authenticated", OTHER, `select count(*)::int c from public.desk_scorecard_by_agent`))[0].c).toBe(0);
    expect((await h.q("authenticated", OWNER, `select count(*)::int c from public.desk_scorecard_by_agent`))[0].c).toBe(1);
    await expect(h.q("anon", null, `select * from public.desk_scorecard_by_agent`)).rejects.toThrow();
  });
  it("owner cannot write orders, positions, signals, theses, state or scorecard directly", async () => {
    const { po, ap } = await approvedProposal();
    await expect(h.q("authenticated", OWNER, `insert into public.desk_orders(approval_id, proposed_order_id, instrument_id, mode, broker, client_order_id, intent, structure, side, qty, order_type, stop_price)
      values ('${ap}','${po}','${h.instrumentId}','paper','paper','${ap}','open','stock','buy',10,'market',95)`)).rejects.toThrow();
    await expect(h.q("authenticated", OWNER, `insert into public.desk_positions(instrument_id, mode, structure, qty, avg_price, stop_price, max_loss, exposure) values ('${h.instrumentId}','paper','stock',1,1,1,1,1)`)).rejects.toThrow();
    await expect(h.q("authenticated", OWNER, `update public.desk_state set halted = false`)).rejects.toThrow();
    await expect(h.q("authenticated", OWNER, `update public.desk_state set high_water_mark = 1`)).rejects.toThrow();
  });
  it("journal: owner may write only as 'owner'", async () => {
    await h.q("authenticated", OWNER, `insert into public.desk_journal(author, entry_type, body) values ('owner','note','hi')`);
    await expect(h.q("authenticated", OWNER, `insert into public.desk_journal(author, entry_type, body) values ('momentum','note','spoof')`)).rejects.toThrow();
  });
  it("kill switch blocks both the approval and the order insert for opens, but not for closes", async () => {
    await h.q("postgres", null, `update public.desk_state set halted = true`);
    const po = await h.seedProposal();
    await expect(h.approve(po)).rejects.toThrow(/kill switch/);
    // a close proposal while halted: needs a real position
    const pos = await h.q("postgres", null, `insert into public.desk_positions(instrument_id, mode, structure, qty, avg_price, stop_price, max_loss, exposure) values ('${h.instrumentId}','paper','stock',10,100,95,50,1000) returning id`);
    const cp = await h.q("service_role", null,
      `insert into public.desk_proposed_orders(instrument_id, agent_name, intent, position_id, side, qty, order_type, stop_price) values ('${h.instrumentId}','sys','close','${pos[0].id}','sell',10,'market',95) returning id`);
    const ap = await h.approve(cp[0].id as string);
    const o = await h.q("service_role", null,
      `insert into public.desk_orders(approval_id, proposed_order_id, instrument_id, mode, broker, client_order_id, intent, structure, side, qty, order_type, stop_price)
       values ('${ap}','${cp[0].id}','${h.instrumentId}','paper','paper','${ap}','close','stock','sell',10,'market',95) returning id`);
    expect(o.length).toBe(1);
  });
  it("a second desk_owner row cannot be inserted, even by service role", async () => {
    await expect(h.q("service_role", null, `insert into public.desk_owner(user_id) values ('${OTHER}')`)).rejects.toThrow();
  });
  // Documented design gap (non-blocking): positions are plain service-role inserts with no order link enforced.
  it.fails("a position cannot exist without a real opening order", async () => {
    await expect(
      h.q("service_role", null, `insert into public.desk_positions(instrument_id, mode, structure, qty, avg_price, stop_price, max_loss, exposure) values ('${h.instrumentId}','paper','stock',1,1,1,1,1)`),
    ).rejects.toThrow();
  });
});
