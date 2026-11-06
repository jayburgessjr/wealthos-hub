import { describe, expect, it } from "vitest";
import { evaluateRisk, type OpenPositionSnapshot, type RiskInput } from "../../../supabase/functions/_shared/desk/risk/engine.ts";
import { analyseOption } from "../../../supabase/functions/_shared/desk/risk/options.ts";
import type { OptionLeg, ProposedOrder } from "../../../supabase/functions/_shared/desk/types.ts";

const stockOrder = (over: Partial<ProposedOrder> = {}): ProposedOrder => ({
  instrumentId: "i1", symbol: "AAPL", agentName: "t", intent: "open", structure: "stock", side: "buy",
  qty: 100, orderType: "market", stopPrice: 95, stopBasis: "price", ...over,
});
// Zero slippage keeps the arithmetic readable; slippage has its own test.
const base = (order: ProposedOrder, over: Partial<RiskInput> = {}): RiskInput => ({
  order, refPrice: 100, equity: 100_000, dayStartEquity: 100_000, highWaterMark: 100_000, halted: false, openPositions: [], slippageBps: 0, ...over,
});
const failed = (d: ReturnType<typeof evaluateRisk>) => d.checks.filter((c) => !c.passed).map((c) => c.rule);

const leg = (right: OptionLeg["right"], action: OptionLeg["action"], strike: number, price: number, over: Partial<OptionLeg> = {}): OptionLeg =>
  ({ right, action, strike, price, expiry: "2026-12-18", ratio: 1, ...over });
const debitSpread = (qty = 2): ProposedOrder => stockOrder({
  structure: "debit_spread", qty, legs: [leg("call", "buy", 100, 3), leg("call", "sell", 105, 1)], stopPrice: 1, stopBasis: "premium",
}); // net debit 2.00 -> max loss $200/contract
const optPos = (group: string): OpenPositionSnapshot => ({ positionGroup: group, symbol: "X", underlying: "X", structure: "debit_spread", qty: 1, exposure: 200, maxLoss: 200 });

describe("approval and sizing: stocks", () => {
  it("approves a compliant order and reports sizing", () => {
    const d = evaluateRisk(base(stockOrder()));
    expect(d.approved).toBe(true);
    expect(d.sized.maxQty).toBe(250); // risk cap 300, position cap 250
    expect(d.sized.riskAmount).toBe(500);
  });
  it("exactly at 1.5% risk is allowed, one share more is not", () => {
    // $10 stop distance: 150 shares = $1,500 = 1.5%
    expect(evaluateRisk(base(stockOrder({ qty: 150, stopPrice: 90 }))).approved).toBe(true);
    expect(failed(evaluateRisk(base(stockOrder({ qty: 151, stopPrice: 90 }))))).toContain("risk_per_trade");
  });
  it("exactly at 25% position is allowed, oversize is rejected", () => {
    expect(evaluateRisk(base(stockOrder({ qty: 250, stopPrice: 99.9 }))).approved).toBe(true);
    const d = evaluateRisk(base(stockOrder({ qty: 251, stopPrice: 99.9 })));
    expect(d.approved).toBe(false);
    expect(failed(d)).toContain("position_cap");
  });
  it("counts exposure already held in the same underlying", () => {
    const held: OpenPositionSnapshot = { positionGroup: "g", symbol: "AAPL", underlying: "AAPL", structure: "stock", qty: 200, exposure: 20_000, maxLoss: 1000 };
    expect(failed(evaluateRisk(base(stockOrder({ qty: 60, stopPrice: 99.9 }), { openPositions: [held] })))).toContain("position_cap");
    const other = { ...held, underlying: "MSFT", symbol: "MSFT" };
    expect(evaluateRisk(base(stockOrder(), { openPositions: [other] })).approved).toBe(true);
  });
  it("applies slippage to the effective entry", () => {
    const d = evaluateRisk(base(stockOrder({ qty: 150, stopPrice: 90 }), { slippageBps: 100 })); // entry 101 -> risk 11 x 150 = 1650
    expect(failed(d)).toContain("risk_per_trade");
  });
  it("rejects short selling in phase 0", () => {
    expect(failed(evaluateRisk(base(stockOrder({ side: "sell", stopPrice: 105 }))))).toContain("long_only");
  });
  it("uses the higher of limit and quote for a limit order", () => {
    const d = evaluateRisk(base(stockOrder({ orderType: "limit", limitPrice: 110, qty: 150, stopPrice: 100 })));
    expect(d.sized.riskAmount).toBe(1500);
  });
  it("sizes crypto fractionally", () => {
    const d = evaluateRisk(base(stockOrder({ symbol: "BTC/USD", structure: "crypto", qty: 0.0205, stopPrice: 57_000 }), { refPrice: 60_000 }));
    expect(d.approved).toBe(true);
    expect(d.sized.maxQty).toBeGreaterThan(0.02);
  });
});

describe("mandatory stop", () => {
  it.each([null, undefined, 0, -1, NaN, Infinity])("rejects stop = %s", (stopPrice) => {
    const d = evaluateRisk(base(stockOrder({ stopPrice: stopPrice as number })));
    expect(d.approved).toBe(false);
    expect(failed(d)).toContain("mandatory_stop");
  });
  it("rejects a long stop at or above entry", () => {
    expect(failed(evaluateRisk(base(stockOrder({ stopPrice: 100 }))))).toContain("stop_side");
    expect(failed(evaluateRisk(base(stockOrder({ stopPrice: 105 }))))).toContain("stop_side");
  });
  it("applies to options and crypto", () => {
    expect(failed(evaluateRisk(base(debitSpread(), { refPrice: 2 }).order.legs ? { ...base({ ...debitSpread(), stopPrice: null }), refPrice: 2 } : base(debitSpread())))).toContain("mandatory_stop");
    expect(failed(evaluateRisk(base(stockOrder({ structure: "crypto", stopPrice: undefined }))))).toContain("mandatory_stop");
  });
  it("applies to close orders too", () => {
    const pos: OpenPositionSnapshot = { positionId: "p1", positionGroup: "g", symbol: "AAPL", underlying: "AAPL", structure: "stock", qty: 100, exposure: 10_000, maxLoss: 500 };
    const close = stockOrder({ intent: "close", side: "sell", positionId: "p1", stopPrice: null });
    expect(failed(evaluateRisk(base(close, { openPositions: [pos] })))).toContain("mandatory_stop");
  });
});

describe("options: defined risk", () => {
  it("approves a debit spread and computes max loss from payoff", () => {
    const d = evaluateRisk(base(debitSpread(2), { refPrice: 2 }));
    expect(d.approved).toBe(true);
    expect(d.sized.maxLoss).toBe(400);
    expect(d.sized.maxQty).toBe(7); // 1,500 / 200
  });
  it("rejects more contracts than the risk budget allows", () => {
    expect(failed(evaluateRisk(base(debitSpread(8), { refPrice: 2 })))).toContain("risk_per_trade");
  });
  it("rejects naked shorts, calendars, ratio writes and unknown structures", () => {
    expect(analyseOption("credit_spread", [leg("call", "sell", 100, 2)]).ok).toBe(false);
    expect(analyseOption("credit_spread", [leg("put", "sell", 100, 2)]).ok).toBe(false);
    expect(analyseOption("debit_spread", [leg("call", "buy", 100, 3), leg("call", "sell", 105, 1, { expiry: "2027-01-15" })]).ok).toBe(false);
    expect(analyseOption("debit_spread", [leg("call", "buy", 100, 3), leg("call", "sell", 105, 1, { ratio: 2 })]).ok).toBe(false);
    expect(analyseOption("stock", [leg("call", "buy", 100, 3)]).ok).toBe(false);
    expect(analyseOption("long_call", undefined).ok).toBe(false);
    expect(analyseOption("long_call", [leg("call", "buy", 100, 3, { ratio: 1.5 })]).ok).toBe(false);
  });
  it("computes credit spread and iron condor max loss", () => {
    const cs = analyseOption("credit_spread", [leg("put", "sell", 100, 2), leg("put", "buy", 95, 0.5)]);
    expect(cs.maxLossPerContract).toBeCloseTo(350); // width 5 - credit 1.5 = 3.5
    const ic = analyseOption("iron_condor", [leg("put", "buy", 90, 0.3), leg("put", "sell", 95, 1), leg("call", "sell", 105, 1), leg("call", "buy", 110, 0.3)]);
    expect(ic.ok).toBe(true);
    expect(ic.maxLossPerContract).toBeCloseTo(360); // wing width 5 minus total credit 1.4 = 3.6 per share
  });
  it("long option risk is the whole premium", () => {
    expect(analyseOption("long_call", [leg("call", "buy", 100, 3)]).maxLossPerContract).toBeCloseTo(300);
  });
  it("requires the order side to match debit or credit", () => {
    const credit = stockOrder({ structure: "credit_spread", side: "buy", qty: 1, legs: [leg("put", "sell", 100, 2), leg("put", "buy", 95, 0.5)], stopPrice: 4, stopBasis: "premium" });
    expect(failed(evaluateRisk(base(credit, { refPrice: 1.5 })))).toContain("order_side");
  });
  it("allows a third options position and rejects a fourth", () => {
    expect(evaluateRisk(base(debitSpread(1), { refPrice: 2, openPositions: [optPos("a"), optPos("b")] })).approved).toBe(true);
    const d = evaluateRisk(base(debitSpread(1), { refPrice: 2, openPositions: [optPos("a"), optPos("b"), optPos("c")] }));
    expect(failed(d)).toContain("options_count");
  });
  it("adding to an existing group does not count as a new position; stock orders ignore the cap", () => {
    const three = [optPos("a"), optPos("b"), optPos("c")];
    expect(failed(evaluateRisk(base({ ...debitSpread(1), positionGroup: "a" }, { refPrice: 2, openPositions: three })))).not.toContain("options_count");
    expect(evaluateRisk(base(stockOrder(), { openPositions: three })).approved).toBe(true);
  });
});

describe("daily loss limit (3%)", () => {
  it("allows a -2.9% day with a small trade", () => {
    expect(evaluateRisk(base(stockOrder({ qty: 10 }), { equity: 97_100, highWaterMark: 100_000 })).approved).toBe(true);
  });
  it("rejects at -3%", () => {
    const d = evaluateRisk(base(stockOrder({ qty: 10 }), { equity: 97_000 }));
    expect(failed(d)).toContain("daily_loss");
    expect(d.effects.dailyLimitHit).toBe(true);
  });
  it("rejects a trade whose worst case would breach the limit", () => {
    // day -2.5% = -2,500; risking $1,000 more projects to -3.5%
    const d = evaluateRisk(base(stockOrder({ qty: 100, stopPrice: 90 }), { equity: 97_500 }));
    expect(failed(d)).toContain("daily_loss");
    expect(d.effects.dailyLimitHit).toBe(false);
  });
});

describe("drawdown kill switch (10%)", () => {
  it("trips at exactly 10% and asks the caller to persist it", () => {
    const d = evaluateRisk(base(stockOrder({ qty: 10 }), { equity: 90_000, dayStartEquity: 90_000 }));
    expect(d.approved).toBe(false);
    expect(failed(d)).toContain("drawdown_kill");
    expect(d.effects.tripKillSwitch).toBe(true);
  });
  it("does not trip at 9.9%", () => {
    const d = evaluateRisk(base(stockOrder({ qty: 10 }), { equity: 90_100, dayStartEquity: 90_100 }));
    expect(d.effects.tripKillSwitch).toBe(false);
    expect(d.approved).toBe(true);
  });
  it("a persisted halt blocks every new order even when numbers recover", () => {
    for (const o of [stockOrder(), debitSpread(1), stockOrder({ structure: "crypto", symbol: "ETH/USD", qty: 1, stopPrice: 2900 })]) {
      const d = evaluateRisk(base(o, { halted: true, refPrice: o.structure === "debit_spread" ? 2 : o.structure === "crypto" ? 3000 : 100 }));
      expect(d.approved).toBe(false);
      expect(failed(d)).toContain("kill_switch");
    }
  });
  it("never blocks a closing order", () => {
    const pos: OpenPositionSnapshot = { positionId: "p1", positionGroup: "g", symbol: "AAPL", underlying: "AAPL", structure: "stock", qty: 100, exposure: 10_000, maxLoss: 500 };
    const close = stockOrder({ intent: "close", side: "sell", positionId: "p1", stopPrice: 95 });
    expect(evaluateRisk(base(close, { halted: true, equity: 85_000, openPositions: [pos] })).approved).toBe(true);
  });
  it("a close must reference an open position and not exceed it", () => {
    const pos: OpenPositionSnapshot = { positionId: "p1", positionGroup: "g", symbol: "AAPL", underlying: "AAPL", structure: "stock", qty: 100, exposure: 10_000, maxLoss: 500 };
    expect(failed(evaluateRisk(base(stockOrder({ intent: "close", side: "sell", positionId: "nope" }), { openPositions: [pos] })))).toContain("close_valid");
    expect(failed(evaluateRisk(base(stockOrder({ intent: "close", side: "sell", positionId: "p1", qty: 101 }), { openPositions: [pos] })))).toContain("close_valid");
  });
  it("high-water mark only ratchets up", () => {
    expect(evaluateRisk(base(stockOrder(), { equity: 105_000, dayStartEquity: 105_000 })).effects.newHighWaterMark).toBe(105_000);
    expect(evaluateRisk(base(stockOrder(), { equity: 99_000 })).effects.newHighWaterMark).toBe(100_000);
  });
});

describe("fail closed and determinism", () => {
  it.each([
    ["zero qty", base(stockOrder({ qty: 0 }))],
    ["NaN qty", base(stockOrder({ qty: NaN }))],
    ["no ref price", base(stockOrder(), { refPrice: NaN })],
    ["zero equity", base(stockOrder(), { equity: 0 })],
    ["zero hwm", base(stockOrder(), { highWaterMark: 0 })],
    ["empty symbol", base(stockOrder({ symbol: "" }))],
  ])("rejects %s", (_n, input) => {
    const d = evaluateRisk(input);
    expect(d.approved).toBe(false);
    expect(d.checks[0].rule).toBe("invalid_input");
  });
  it("reports every failed check, not just the first", () => {
    const d = evaluateRisk(base(stockOrder({ qty: 500, stopPrice: null }), { halted: true }));
    expect(failed(d)).toEqual(expect.arrayContaining(["kill_switch", "mandatory_stop", "position_cap"]));
  });
  it("is deterministic and never mutates its input", () => {
    const input = base(stockOrder());
    const snapshot = JSON.stringify(input);
    expect(evaluateRisk(input)).toEqual(evaluateRisk(input));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
