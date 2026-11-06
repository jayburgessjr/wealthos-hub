// @vitest-environment node
// QA attacks on the risk engine, option maths and the client preview.
import { describe, expect, it } from "vitest";
import { evaluateRisk, type OpenPositionSnapshot, type RiskInput } from "../../../supabase/functions/_shared/desk/risk/engine.ts";
import { analyseOption } from "../../../supabase/functions/_shared/desk/risk/options.ts";
import type { OptionLeg, ProposedOrder } from "../../../supabase/functions/_shared/desk/types.ts";
import { buildOrder, previewRisk, draftFrom } from "../../lib/desk/preview.ts";

const stock = (o: Partial<ProposedOrder> = {}): ProposedOrder => ({
  instrumentId: "i", symbol: "AAPL", agentName: "a", intent: "open", structure: "stock", side: "buy", qty: 10,
  orderType: "market", stopPrice: 95, stopBasis: "price", ...o,
});
const base = (o: Partial<ProposedOrder> = {}, r: Partial<RiskInput> = {}): RiskInput => ({
  order: stock(o), refPrice: 100, equity: 100_000, dayStartEquity: 100_000, highWaterMark: 100_000, halted: false, openPositions: [], slippageBps: 0, ...r,
});
const rule = (d: ReturnType<typeof evaluateRisk>, name: string) => d.checks.find((c) => c.rule === name);
const leg = (right: "call" | "put", action: "buy" | "sell", strike: number, price: number, ratio = 1, expiry = "2026-12-18"): OptionLeg => ({ right, action, strike, price, ratio, expiry });
const opt = (structure: ProposedOrder["structure"], legs: OptionLeg[], o: Partial<ProposedOrder> = {}): ProposedOrder =>
  stock({ structure, legs, side: structure === "credit_spread" || structure === "iron_condor" || structure === "iron_butterfly" ? "sell" : "buy", qty: 1, stopPrice: 1, symbol: "SPY", ...o });
const optPos = (group: string, over: Partial<OpenPositionSnapshot> = {}): OpenPositionSnapshot => ({ positionGroup: group, symbol: "SPY", underlying: "SPY", structure: "credit_spread", qty: 1, exposure: 100, maxLoss: 100, ...over });
const stockPos = (over: Partial<OpenPositionSnapshot> = {}): OpenPositionSnapshot => ({ positionId: "p", positionGroup: "g", symbol: "AAPL", underlying: "AAPL", structure: "stock", qty: 10, exposure: 1000, maxLoss: 50, ...over });

describe("attack: mandatory stop", () => {
  for (const [name, stop] of [["null", null], ["undefined", undefined], ["zero", 0], ["negative", -5], ["NaN", NaN], ["Infinity", Infinity], ["string", "95"]] as const) {
    it(`rejects open order with ${name} stop`, () => {
      expect(evaluateRisk(base({ stopPrice: stop as unknown as number })).approved).toBe(false);
    });
    it(`rejects CLOSE order with ${name} stop`, () => {
      const d = evaluateRisk(base({ intent: "close", positionId: "p", side: "sell", stopPrice: stop as unknown as number }, { openPositions: [stockPos()] }));
      expect(d.approved).toBe(false);
    });
  }
});

describe("attack: boundary values at exactly the limits", () => {
  it("1.5% risk exactly passes, one cent more fails", () => {
    expect(rule(evaluateRisk(base({ qty: 300, stopPrice: 95 })), "risk_per_trade")!.passed).toBe(true);
    expect(rule(evaluateRisk(base({ qty: 300, stopPrice: 94.99 })), "risk_per_trade")!.passed).toBe(false);
    expect(rule(evaluateRisk(base({ qty: 301, stopPrice: 95 })), "risk_per_trade")!.passed).toBe(false);
  });
  it("float noise: risk of exactly 300 computed as 100.1 - 97.1 does not flip the 1.5% boundary", () => {
    const d = evaluateRisk(base({ qty: 100, stopPrice: 97.1 }, { equity: 20_000, dayStartEquity: 20_000, highWaterMark: 20_000, refPrice: 100.1 }));
    expect(rule(d, "risk_per_trade")!.passed).toBe(true);
  });
  it("25% position exactly passes, a hair over fails", () => {
    expect(rule(evaluateRisk(base({ qty: 250, stopPrice: 99 })), "position_cap")!.passed).toBe(true);
    expect(rule(evaluateRisk(base({ qty: 251, stopPrice: 99 })), "position_cap")!.passed).toBe(false);
  });
  it("position cap counts existing exposure in the same underlying", () => {
    const d = evaluateRisk(base({ qty: 100, stopPrice: 99 }, { openPositions: [stockPos({ positionId: "x", exposure: 20_000 })] }));
    expect(rule(d, "position_cap")!.passed).toBe(false);
  });
  it("3 options positions: 3rd ok, 4th rejected, adding to an existing group ok", () => {
    const legs = [leg("call", "sell", 100, 2.5), leg("call", "buy", 105, 1)];
    const two = [optPos("a"), optPos("b")];
    expect(rule(evaluateRisk(base(opt("credit_spread", legs), { openPositions: two, refPrice: 1 })), "options_count")!.passed).toBe(true);
    const three = [optPos("a"), optPos("b"), optPos("c")];
    expect(rule(evaluateRisk(base(opt("credit_spread", legs), { openPositions: three, refPrice: 1 })), "options_count")!.passed).toBe(false);
    expect(rule(evaluateRisk(base(opt("credit_spread", legs, { positionGroup: "a" }), { openPositions: three, refPrice: 1 })), "options_count")!.passed).toBe(true);
  });
  it("two open rows of the same group count as ONE options position", () => {
    const legs = [leg("call", "sell", 100, 2.5), leg("call", "buy", 105, 1)];
    const open = [optPos("a"), optPos("a"), optPos("b")];
    expect(rule(evaluateRisk(base(opt("credit_spread", legs), { openPositions: open, refPrice: 1 })), "options_count")!.value).toBe(3);
  });
  it("daily loss: exactly -3% is already hit", () => {
    const hit = evaluateRisk(base({}, { equity: 97_000 }));
    expect(rule(hit, "daily_loss")!.passed).toBe(false);
    expect(hit.effects.dailyLimitHit).toBe(true);
    expect(rule(evaluateRisk(base({ qty: 1 }, { equity: 97_010 })), "daily_loss")!.passed).toBe(true);
  });
  it("daily loss projected: worst case of this trade crossing -3% rejects", () => {
    const d = evaluateRisk(base({ qty: 295, stopPrice: 95 }, { equity: 98_400, dayStartEquity: 100_000, highWaterMark: 100_000 }));
    expect(rule(d, "daily_loss")!.passed).toBe(false);
  });
  it("drawdown exactly 10% trips the kill switch and rejects; just under does not", () => {
    const hit = evaluateRisk(base({}, { equity: 90_000, highWaterMark: 100_000, dayStartEquity: 90_000 }));
    expect(hit.effects.tripKillSwitch).toBe(true);
    expect(hit.approved).toBe(false);
    const near = evaluateRisk(base({ qty: 1 }, { equity: 90_010, highWaterMark: 100_000, dayStartEquity: 90_010 }));
    expect(near.effects.tripKillSwitch).toBe(false);
  });
});

describe("attack: hostile numeric inputs fail closed", () => {
  const bad: unknown[] = [NaN, Infinity, -Infinity, -1, 0, "100", null, undefined];
  for (const v of bad) {
    it(`refPrice=${String(v)}`, () => expect(evaluateRisk(base({}, { refPrice: v as number })).approved).toBe(false));
    it(`equity=${String(v)}`, () => expect(evaluateRisk(base({}, { equity: v as number })).approved).toBe(false));
    it(`dayStartEquity=${String(v)}`, () => expect(evaluateRisk(base({}, { dayStartEquity: v as number })).approved).toBe(false));
    it(`highWaterMark=${String(v)}`, () => expect(evaluateRisk(base({}, { highWaterMark: v as number })).approved).toBe(false));
    it(`qty=${String(v)}`, () => expect(evaluateRisk(base({ qty: v as number })).approved).toBe(false));
  }
  it("negative slippage cannot understate risk", () => {
    const honest = evaluateRisk(base({ qty: 300, stopPrice: 95 }, { slippageBps: 10 }));
    const neg = evaluateRisk(base({ qty: 300, stopPrice: 95 }, { slippageBps: -1000 }));
    expect(neg.approved).toBe(false);
  });
  it("limit price NaN on a limit order falls back to the quote, not to zero risk", () => {
    expect(evaluateRisk(base({ orderType: "limit", limitPrice: NaN, qty: 301, stopPrice: 95 })).approved).toBe(false);
  });
  it("limit order with a limit BELOW the quote still sizes risk from the quote", () => {
    expect(evaluateRisk(base({ orderType: "limit", limitPrice: 50, qty: 301, stopPrice: 95 })).approved).toBe(false);
  });
  it("short selling (open sell) is rejected", () => {
    expect(evaluateRisk(base({ side: "sell", stopPrice: 105 })).approved).toBe(false);
  });
  it("stop above entry for a long is rejected", () => {
    expect(evaluateRisk(base({ stopPrice: 101 })).approved).toBe(false);
  });
  it("unknown structure string cannot be approved", () => {
    expect(evaluateRisk(base({ structure: "naked_call" as never })).approved).toBe(false);
  });
});

describe("attack: kill switch and close orders", () => {
  it("halted rejects an open order", () => {
    const d = evaluateRisk(base({}, { halted: true }));
    expect(rule(d, "kill_switch")!.passed).toBe(false);
    expect(d.approved).toBe(false);
  });
  it("halted still allows a valid close", () => {
    const d = evaluateRisk(base({ intent: "close", positionId: "p", side: "sell", qty: 5 }, { halted: true, openPositions: [stockPos()] }));
    expect(d.approved).toBe(true);
  });
  it("close for more than open qty / unknown position / no id is rejected", () => {
    const pos = [stockPos()];
    expect(evaluateRisk(base({ intent: "close", positionId: "p", side: "sell", qty: 10.5 }, { openPositions: pos })).approved).toBe(false);
    expect(evaluateRisk(base({ intent: "close", positionId: "zzz", side: "sell", qty: 1 }, { openPositions: pos })).approved).toBe(false);
    expect(evaluateRisk(base({ intent: "close", side: "sell", qty: 1 }, { openPositions: [stockPos({ positionId: undefined })] })).approved).toBe(false);
  });
  // DEFECT D1: close never validates side, so a close-intent BUY adds to the position with no kill-switch,
  // risk-per-trade, position-cap or daily-loss check at all.
  it("a close-intent BUY cannot be used to add exposure past every limit (halted, oversize)", () => {
    const d = evaluateRisk(base({ intent: "close", positionId: "p", side: "buy", qty: 10, stopPrice: 1 }, { halted: true, openPositions: [stockPos({ qty: 100_000 })] }));
    expect(d.approved).toBe(false);
  });
  // DEFECT D2: close does not compare the order symbol to the position's symbol: "close MSFT position" can sell AAPL.
  it("a close must be for the same symbol as the referenced position", () => {
    const d = evaluateRisk(base({ intent: "close", positionId: "p", symbol: "AAPL", side: "sell", qty: 10 }, { openPositions: [stockPos({ symbol: "MSFT", underlying: "MSFT" })] }));
    expect(d.approved).toBe(false);
  });
});

describe("attack: slippage rounding and crypto sizing", () => {
  it("sized maxQty always passes and maxQty+1 never does", () => {
    for (const [px, stop, bps] of [[100, 95, 10], [33.33, 31.1, 10], [0.5, 0.45, 25], [1234.56, 1200, 7]] as const) {
      const q = evaluateRisk(base({ qty: 1, stopPrice: stop }, { refPrice: px, slippageBps: bps })).sized.maxQty;
      if (q > 0) {
        expect(rule(evaluateRisk(base({ qty: q, stopPrice: stop }, { refPrice: px, slippageBps: bps })), "risk_per_trade")!.passed, `px ${px}`).toBe(true);
        expect(evaluateRisk(base({ qty: q + 1, stopPrice: stop }, { refPrice: px, slippageBps: bps })).approved, `px ${px} over`).toBe(false);
      }
    }
  });
  it("crypto allows fractional quantity sized to 4 decimals, never over budget", () => {
    const q = evaluateRisk(base({ structure: "crypto", symbol: "BTC/USD", qty: 1, stopPrice: 60_000 }, { refPrice: 65_000, slippageBps: 10 })).sized.maxQty;
    expect(q).toBeGreaterThan(0);
    expect(evaluateRisk(base({ structure: "crypto", symbol: "BTC/USD", qty: q, stopPrice: 60_000 }, { refPrice: 65_000, slippageBps: 10 })).approved).toBe(true);
    expect(evaluateRisk(base({ structure: "crypto", symbol: "BTC/USD", qty: q + 0.001, stopPrice: 60_000 }, { refPrice: 65_000, slippageBps: 10 })).approved).toBe(false);
  });
  it("stop a cent below entry cannot yield a huge passing qty (position cap binds)", () => {
    expect(evaluateRisk(base({ qty: 10_000, stopPrice: 99.99 })).approved).toBe(false);
  });
});

describe("attack: option payoff maths", () => {
  it("credit put spread: max loss = width - credit", () => {
    const a = analyseOption("credit_spread", [leg("put", "sell", 100, 3), leg("put", "buy", 95, 1)]);
    expect(a.maxLossPerContract).toBeCloseTo(300, 6);
    expect(a.netPremium).toBeCloseTo(-2, 9);
  });
  it("credit call spread: max loss = width - credit", () => {
    expect(analyseOption("credit_spread", [leg("call", "sell", 100, 3), leg("call", "buy", 105, 1)]).maxLossPerContract).toBeCloseTo(300, 6);
  });
  it("iron condor: one wing width less total credit", () => {
    const a = analyseOption("iron_condor", [leg("put", "buy", 90, 0.5), leg("put", "sell", 95, 1.5), leg("call", "sell", 105, 1.5), leg("call", "buy", 110, 0.5)]);
    expect(a.maxLossPerContract).toBeCloseTo(300, 6);
  });
  it("iron condor with unequal wings uses the wider wing", () => {
    const a = analyseOption("iron_condor", [leg("put", "buy", 85, 0.2), leg("put", "sell", 95, 1.5), leg("call", "sell", 105, 1.5), leg("call", "buy", 110, 0.5)]);
    expect(a.maxLossPerContract).toBeCloseTo((10 - 2.3) * 100, 6);
  });
  it("long put / long call: max loss = premium", () => {
    expect(analyseOption("long_put", [leg("put", "buy", 100, 2.5)]).maxLossPerContract).toBeCloseTo(250, 6);
    expect(analyseOption("long_call", [leg("call", "buy", 100, 2.5)]).maxLossPerContract).toBeCloseTo(250, 6);
  });
  it("debit spread: max loss = debit", () => {
    expect(analyseOption("debit_spread", [leg("call", "buy", 100, 4), leg("call", "sell", 105, 1.5)]).maxLossPerContract).toBeCloseTo(250, 6);
  });
  it("ratio spread with more shorts than longs is naked and rejected", () => {
    expect(analyseOption("credit_spread", [leg("call", "buy", 100, 5), leg("call", "sell", 105, 2, 2)]).ok).toBe(false);
  });
  it("back spread (sell 1, buy 2) is accepted with finite max loss", () => {
    const a = analyseOption("debit_spread", [leg("call", "sell", 100, 4), leg("call", "buy", 105, 1.5, 2)]);
    expect(a.ok).toBe(true);
    expect(Number.isFinite(a.maxLossPerContract)).toBe(true);
  });
  it("naked short call / put rejected", () => {
    expect(analyseOption("credit_spread", [leg("call", "sell", 100, 2)]).ok).toBe(false);
    expect(analyseOption("credit_spread", [leg("put", "sell", 100, 2)]).ok).toBe(false);
  });
  it("zero-price legs: spread max loss is the full width", () => {
    const a = analyseOption("credit_spread", [leg("put", "sell", 100, 0), leg("put", "buy", 95, 0)]);
    expect(a.maxLossPerContract).toBeCloseTo(500, 6);
  });
  it("all-zero-price single long: cannot size => rejected", () => {
    expect(analyseOption("long_call", [leg("call", "buy", 100, 0)]).ok).toBe(false);
  });
  it("mixed expiries (calendar) rejected", () => {
    expect(analyseOption("debit_spread", [leg("call", "buy", 100, 3, 1, "2026-12-18"), leg("call", "sell", 100, 2, 1, "2027-01-15")]).ok).toBe(false);
  });
  for (const [name, bad] of [["NaN strike", { strike: NaN }], ["negative price", { price: -1 }], ["Infinity price", { price: Infinity }], ["fractional ratio", { ratio: 1.5 }], ["zero ratio", { ratio: 0 }], ["bad right", { right: "x" }], ["bad action", { action: "short" }]] as const) {
    it(`rejects leg with ${name}`, () => {
      expect(analyseOption("long_call", [{ ...leg("call", "buy", 100, 2), ...(bad as object) } as OptionLeg]).ok).toBe(false);
    });
  }
  it("engine: long_call label with naked short legs rejected", () => {
    expect(evaluateRisk(base(opt("long_call", [leg("call", "sell", 100, 2)], { side: "buy" }), { refPrice: 1 })).approved).toBe(false);
  });
  it("engine: credit structure must be sold", () => {
    const legs = [leg("call", "sell", 100, 3), leg("call", "buy", 105, 1)];
    expect(evaluateRisk(base(opt("credit_spread", legs, { side: "buy" }), { refPrice: 2 })).approved).toBe(false);
  });
  it("engine: option risk boundary at $300/contract on $100k (5 passes, 6 fails)", () => {
    const legs = [leg("put", "sell", 100, 3), leg("put", "buy", 95, 1)];
    expect(rule(evaluateRisk(base(opt("credit_spread", legs, { qty: 5, stopPrice: 3 }), { refPrice: 2 })), "risk_per_trade")!.passed).toBe(true);
    expect(rule(evaluateRisk(base(opt("credit_spread", legs, { qty: 6, stopPrice: 3 }), { refPrice: 2 })), "risk_per_trade")!.passed).toBe(false);
  });
  // DEFECT D3: options trade in whole contracts; qty 0.5 is accepted (and sent as "0.5" to a broker).
  it("fractional option contract quantity is rejected", () => {
    const legs = [leg("put", "sell", 100, 3), leg("put", "buy", 95, 1)];
    expect(evaluateRisk(base(opt("credit_spread", legs, { qty: 0.5, stopPrice: 3 }), { refPrice: 2 })).approved).toBe(false);
  });
  it("credit stop on the wrong side of the premium is rejected", () => {
    const legs = [leg("put", "sell", 100, 3), leg("put", "buy", 95, 1)];
    expect(evaluateRisk(base(opt("credit_spread", legs, { qty: 1, stopPrice: 1 }), { refPrice: 2 })).approved).toBe(false);
  });
});

describe("attack: client preview must agree with the server engine", () => {
  const row = (over: object = {}) =>
    ({ id: "po1", instrument_id: "i", agent_name: "a", intent: "open", position_id: null, structure: "stock", side: "buy", qty: 1, order_type: "market", limit_price: null, legs: null, stop_price: 95, stop_basis: "price", target_price: null, ...over }) as never;
  const account = (quotes: Record<string, number>) =>
    ({ account: { equity: 100_000 }, state: { day_start_equity: 100_000, high_water_mark: 100_000, halted: false }, quotes }) as never;

  // D4 (non-blocking, latent): buildOrder() drops positionGroup, so preview and engine disagree whenever a group is
  // supplied. In production no proposal carries one (desk_proposed_orders has no position_group column and
  // supabase-repo does not map it), so the engine "adding to a group" branch is unreachable. it.fails documents it.
  it.fails("preview and engine agree when adding to an existing options group at the 3-position cap", () => {
    const legs = [leg("call", "sell", 100, 2.5), leg("call", "buy", 105, 1)];
    const open = [optPos("a"), optPos("b"), optPos("c")];
    const r = row({ structure: "credit_spread", side: "sell", legs, stop_price: 5, stop_basis: "premium", position_group: "a" });
    const order = buildOrder(r, "SPY", draftFrom(r));
    const preview = previewRisk(order, account({ SPY: 1 }), open);
    const server = evaluateRisk({ order: { ...order, positionGroup: "a" }, refPrice: 1, equity: 100_000, dayStartEquity: 100_000, highWaterMark: 100_000, halted: false, openPositions: open });
    expect(server.approved).toBe(true);
    expect(preview.approved).toBe(server.approved);
  });
  it("preview agrees with engine on an ordinary oversize stock order", () => {
    const r = row({ qty: 400, stop_price: 95 });
    const o = buildOrder(r, "AAPL");
    const p = previewRisk(o, account({ AAPL: 100 }), []);
    expect(p.approved).toBe(false);
    expect(p.reasons.join(" ")).toMatch(/risk_per_trade/);
  });
  it("preview with a missing quote fails closed", () => {
    expect(previewRisk(buildOrder(row(), "AAPL"), account({}), []).approved).toBe(false);
  });
  it("edited stop that is garbage becomes null and rejects; 1e999 qty becomes 0 and rejects", () => {
    const o = buildOrder(row(), "AAPL", { qty: "1", limit: "", stop: "abc", target: "" });
    expect(o.stopPrice).toBeNull();
    expect(previewRisk(o, account({ AAPL: 100 }), []).approved).toBe(false);
    const o2 = buildOrder(row(), "AAPL", { qty: "1e999", limit: "", stop: "95", target: "" });
    expect(o2.qty).toBe(0);
    expect(previewRisk(o2, account({ AAPL: 100 }), []).approved).toBe(false);
  });
});
