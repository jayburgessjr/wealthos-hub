// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { evaluateRisk, type RiskInput } from "../../../supabase/functions/_shared/desk/risk/engine.ts";
import { AlpacaBroker } from "../../../supabase/functions/_shared/desk/broker/alpaca.ts";
import { makeBroker, resolveMode } from "../../../supabase/functions/_shared/desk/broker/factory.ts";
import { InMemoryPaperStore, PaperBroker } from "../../../supabase/functions/_shared/desk/broker/paper.ts";
import { assertSubmittable, OrderRefusedError, type SubmitRequest } from "../../../supabase/functions/_shared/desk/broker/port.ts";
import type { ProposedOrder } from "../../../supabase/functions/_shared/desk/types.ts";

const order = (over: Partial<ProposedOrder> = {}): ProposedOrder => ({
  instrumentId: "i1", symbol: "AAPL", agentName: "t", intent: "open", structure: "stock", side: "buy", qty: 100,
  orderType: "market", stopPrice: 95, targetPrice: 115, stopBasis: "price", ...over,
});
const riskInput = (o: ProposedOrder): RiskInput => ({ order: o, refPrice: 100, equity: 100_000, dayStartEquity: 100_000, highWaterMark: 100_000, halted: false, openPositions: [], slippageBps: 0 });
const req = (o = order(), over: Partial<SubmitRequest> = {}): SubmitRequest => ({
  clientOrderId: "ap1", approvalId: "ap1", symbol: o.symbol, order: o, decision: evaluateRisk(riskInput(o)), mode: "paper", ...over,
});
const quote = async () => 100;

describe("proof: an order without a stop is rejected", () => {
  it("the risk engine rejects it", () => {
    const d = evaluateRisk(riskInput(order({ stopPrice: null })));
    expect(d.approved).toBe(false);
    expect(d.reasons.join(" ")).toMatch(/mandatory_stop/);
  });
  it("brokers refuse a no-stop order even if someone hands them a passing decision", async () => {
    const good = evaluateRisk(riskInput(order()));
    const noStop = req(order({ stopPrice: null }), { decision: good });
    expect(() => assertSubmittable(noStop, "paper")).toThrow(/stop/);
    await expect(new PaperBroker(new InMemoryPaperStore(), quote).submitOrder(noStop)).rejects.toThrow(OrderRefusedError);
    const f = vi.fn();
    await expect(new AlpacaBroker({ keyId: "k", secret: "s", mode: "paper", fetchImpl: f as unknown as typeof fetch }).submitOrder(noStop)).rejects.toThrow(OrderRefusedError);
    expect(f).not.toHaveBeenCalled();
  });
  it("brokers refuse a rejected decision, a missing approval id, a mismatched client id and a mode mismatch", () => {
    const bad = evaluateRisk(riskInput(order({ qty: 5000 })));
    expect(() => assertSubmittable(req(order(), { decision: bad }), "paper")).toThrow(/not approved/);
    expect(() => assertSubmittable(req(order(), { approvalId: "" }), "paper")).toThrow(/approval id/);
    expect(() => assertSubmittable(req(order(), { clientOrderId: "other" }), "paper")).toThrow(/approval id/);
    expect(() => assertSubmittable(req(order(), { mode: "live" }), "paper")).toThrow(/mode/);
  });
});

describe("paper broker", () => {
  it("fills, tracks the position and marks equity from the ledger", async () => {
    const store = new InMemoryPaperStore(100_000);
    const broker = new PaperBroker(store, quote, 0);
    const fill = await broker.submitOrder(req());
    expect(fill).toMatchObject({ status: "filled", filledQty: 100, avgFillPrice: 100 });
    expect((await broker.getPositions())[0]).toMatchObject({ symbol: "AAPL", qty: 100, marketValue: 10_000 });
    expect((await broker.getAccount()).equity).toBe(100_000);
    store.marks["AAPL"] = 110;
    expect((await broker.getAccount()).equity).toBe(101_000);
  });
  it("is idempotent on the client order id", async () => {
    const store = new InMemoryPaperStore();
    const broker = new PaperBroker(store, quote, 0);
    await broker.submitOrder(req());
    await broker.submitOrder(req());
    expect(store.fills).toHaveLength(1);
  });
  it("rejects when no quote is available", async () => {
    const broker = new PaperBroker(new InMemoryPaperStore(), async () => null, 0);
    expect((await broker.submitOrder(req())).status).toBe("rejected");
  });
  it("books option credit and debit spreads with the 100x multiplier", async () => {
    const legs = [
      { right: "call" as const, action: "buy" as const, strike: 100, expiry: "2026-12-18", ratio: 1, price: 3 },
      { right: "call" as const, action: "sell" as const, strike: 105, expiry: "2026-12-18", ratio: 1, price: 1 },
    ];
    const o = order({ structure: "debit_spread", legs, qty: 2, stopPrice: 1, stopBasis: "premium" });
    const store = new InMemoryPaperStore(100_000);
    const broker = new PaperBroker(store, quote, 0);
    const d = evaluateRisk({ ...riskInput(o), refPrice: 2 });
    expect(d.approved).toBe(true);
    await broker.submitOrder({ ...req(o), decision: d });
    expect((await broker.getAccount()).cash).toBe(100_000 - 2 * 2 * 100);
  });
});

describe("alpaca adapter", () => {
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  it("sends a bracket order with the stop attached on the paper host", async () => {
    const f = vi.fn(async () => ok({ id: "x1", status: "accepted", filled_qty: "0" }));
    const broker = new AlpacaBroker({ keyId: "k", secret: "s", mode: "paper", fetchImpl: f as unknown as typeof fetch });
    const fill = await broker.submitOrder(req());
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://paper-api.alpaca.markets/v2/orders");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ order_class: "bracket", client_order_id: "ap1", stop_loss: { stop_price: "95" }, take_profit: { limit_price: "115" } });
    expect(fill.status).toBe("submitted");
  });
  it("sends crypto with a separate protective stop", async () => {
    const f = vi.fn(async () => ok({ id: "c1", status: "accepted" }));
    const broker = new AlpacaBroker({ keyId: "k", secret: "s", mode: "paper", fetchImpl: f as unknown as typeof fetch });
    const o = order({ symbol: "BTC/USD", structure: "crypto", qty: 0.02, stopPrice: 57_000 });
    const r = req(o, { decision: evaluateRisk({ ...riskInput(o), refPrice: 60_000 }) });
    await broker.submitOrder(r);
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse((f.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toMatchObject({ type: "stop", side: "sell", stop_price: "57000" });
  });
  it("refuses multi-leg options before any network call", async () => {
    const f = vi.fn();
    const broker = new AlpacaBroker({ keyId: "k", secret: "s", mode: "paper", fetchImpl: f as unknown as typeof fetch });
    const legs = [
      { right: "call" as const, action: "buy" as const, strike: 100, expiry: "2026-12-18", ratio: 1, price: 3 },
      { right: "call" as const, action: "sell" as const, strike: 105, expiry: "2026-12-18", ratio: 1, price: 1 },
    ];
    const o = order({ structure: "debit_spread", legs, qty: 1, stopPrice: 1, stopBasis: "premium" });
    await expect(broker.submitOrder(req(o, { decision: evaluateRisk({ ...riskInput(o), refPrice: 2 }) }))).rejects.toThrow(/Multi-leg/);
    expect(f).not.toHaveBeenCalled();
  });
  it("returns the existing order on a duplicate client order id instead of resubmitting", async () => {
    let n = 0;
    const f = vi.fn(async (url: string) => (n++ === 0 ? ok({ message: "client_order_id must be unique" }, 422) : ok({ id: "old", status: "filled", filled_qty: "100", filled_avg_price: "100" })));
    const broker = new AlpacaBroker({ keyId: "k", secret: "s", mode: "paper", fetchImpl: f as unknown as typeof fetch });
    const fill = await broker.submitOrder(req());
    expect(fill).toMatchObject({ brokerOrderId: "old", status: "filled" });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("retries 5xx with backoff then gives up", async () => {
    const sleep = vi.fn(async () => {});
    const f = vi.fn(async () => ok({}, 503));
    const broker = new AlpacaBroker({ keyId: "k", secret: "s", mode: "paper", fetchImpl: f as unknown as typeof fetch, sleep });
    await expect(broker.getAccount()).rejects.toThrow(/after retries/);
    expect(f).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });
  it("refuses a paper-mode order on a live broker", async () => {
    const broker = new AlpacaBroker({ keyId: "k", secret: "s", mode: "live", fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(broker.submitOrder(req())).rejects.toThrow(/mode/);
  });
});

describe("mode resolution", () => {
  it("is paper unless both flags are exactly set", () => {
    expect(resolveMode({})).toBe("paper");
    expect(resolveMode({ TRADING_MODE: "live" })).toBe("paper");
    expect(resolveMode({ LIVE_TRADING_ENABLED: "true" })).toBe("paper");
    expect(resolveMode({ TRADING_MODE: "LIVE", LIVE_TRADING_ENABLED: "true" })).toBe("paper");
    expect(resolveMode({ TRADING_MODE: "live", LIVE_TRADING_ENABLED: "1" })).toBe("paper");
    expect(resolveMode({ TRADING_MODE: "live", LIVE_TRADING_ENABLED: "true" })).toBe("live");
  });
  it("live without credentials refuses to build a broker; paper builds the internal broker", () => {
    const deps = { paperStore: new InMemoryPaperStore(), quote };
    expect(() => makeBroker("live", deps)).toThrow(/credentials/);
    expect(makeBroker("paper", deps).name).toBe("paper");
  });
});
