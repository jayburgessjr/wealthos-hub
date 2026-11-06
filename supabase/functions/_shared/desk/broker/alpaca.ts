// Alpaca adapter behind the same BrokerPort. Credentials and fetch are injected (no Deno.env in here).
// Phase 0: stocks/ETFs (bracket or oto), crypto (entry + separate stop), single-leg options (limit + separate stop).
// Multi-leg structures are refused clearly rather than mis-sent.
import { isOptionStructure } from "../risk/options.ts";
import { assertSubmittable, OrderRefusedError, type BrokerAccount, type BrokerFill, type BrokerPort, type BrokerPosition, type SubmitRequest } from "./port.ts";
import type { TradingMode } from "../types.ts";

export interface AlpacaDeps {
  keyId: string;
  secret: string;
  mode: TradingMode;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

// Alpaca responses are untyped JSON; every field is coerced with String()/Number() at the point of use.
type AlpacaJson = Record<string, string | number | null | undefined>;

const BACKOFF_MS = [500, 1500, 4000];

export class AlpacaBroker implements BrokerPort {
  readonly name = "alpaca" as const;
  readonly mode: TradingMode;
  private base: string;
  private f: typeof fetch;
  private sleep: (ms: number) => Promise<void>;

  constructor(private deps: AlpacaDeps) {
    this.mode = deps.mode;
    this.base = deps.mode === "live" ? "https://api.alpaca.markets" : "https://paper-api.alpaca.markets";
    this.f = deps.fetchImpl ?? fetch;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private async call(method: string, path: string, body?: unknown): Promise<{ status: number; json: AlpacaJson }> {
    let last: unknown;
    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), this.deps.timeoutMs ?? 10_000);
      try {
        const res = await this.f(`${this.base}${path}`, {
          method,
          signal: ctl.signal,
          headers: { "APCA-API-KEY-ID": this.deps.keyId, "APCA-API-SECRET-KEY": this.deps.secret, "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        const json = text ? JSON.parse(text) : {};
        if (res.status === 429 || res.status >= 500) throw new Error(`Alpaca ${res.status}`);
        return { status: res.status, json };
      } catch (e) {
        last = e;
        if (attempt < BACKOFF_MS.length) await this.sleep(BACKOFF_MS[attempt]);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(`Alpaca request failed after retries: ${(last as Error)?.message ?? last}`);
  }

  async getAccount(): Promise<BrokerAccount> {
    const { status, json } = await this.call("GET", "/v2/account");
    if (status >= 400) throw new Error(`Alpaca account error ${status}`);
    return { equity: Number(json.equity), cash: Number(json.cash), buyingPower: Number(json.buying_power), asOf: new Date().toISOString() };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const { status, json } = await this.call("GET", "/v2/positions");
    if (status >= 400) throw new Error(`Alpaca positions error ${status}`);
    return (json as unknown as AlpacaJson[]).map((r) => ({ symbol: String(r.symbol), qty: Number(r.qty), avgPrice: Number(r.avg_entry_price), marketValue: Number(r.market_value) }));
  }

  private toFill(j: AlpacaJson): BrokerFill {
    const s = String(j.status);
    return {
      brokerOrderId: String(j.id),
      status: s === "filled" ? "filled" : s === "partially_filled" ? "partially_filled" : s === "rejected" ? "rejected" : s === "canceled" || s === "expired" || s === "done_for_day" ? "canceled" : s === "stopped" || s === "suspended" ? "rejected" : "submitted",
      filledQty: Number(j.filled_qty ?? 0),
      avgFillPrice: j.filled_avg_price ? Number(j.filled_avg_price) : undefined,
      raw: j,
    };
  }

  async getOrder(clientOrderId: string): Promise<BrokerFill | null> {
    const { status, json } = await this.call("GET", `/v2/orders:by_client_order_id?client_order_id=${encodeURIComponent(clientOrderId)}`);
    if (status === 404) return null;
    if (status >= 400) throw new Error(`Alpaca order lookup error ${status}`);
    return this.toFill(json);
  }

  async submitOrder(req: SubmitRequest): Promise<BrokerFill> {
    assertSubmittable(req, this.mode);
    const o = req.order;
    const crypto = o.structure === "crypto";
    const option = isOptionStructure(o.structure);
    if (option && o.structure !== "long_call" && o.structure !== "long_put") {
      throw new OrderRefusedError("Multi-leg option structures are not supported by the Alpaca adapter in phase 0.");
    }

    const closing = o.intent === "close";
    const body: Record<string, unknown> = {
      symbol: req.symbol,
      qty: String(o.qty),
      side: o.side,
      client_order_id: req.clientOrderId,
      // Crypto trades around the clock (gtc); US equity and option orders are day orders.
      time_in_force: crypto ? "gtc" : "day",
      type: option || (!closing && o.orderType === "limit") ? "limit" : "market",
    };
    if (body.type === "limit") body.limit_price = String(o.limitPrice ?? o.legs?.[0]?.price);
    // Protective stop travels with an opening stock/ETF entry. Closing orders never carry one: a sell-stop above the
    // market would be refused or open a short.
    if (!closing && !crypto && !option) {
      body.order_class = typeof o.targetPrice === "number" && o.targetPrice > 0 ? "bracket" : "oto";
      if (body.order_class === "bracket") body.take_profit = { limit_price: String(o.targetPrice) };
      body.stop_loss = { stop_price: String(o.stopPrice) };
    }

    let fillJson: AlpacaJson;
    const placed = await this.call("POST", "/v2/orders", body);
    if (placed.status === 422 && /client_order_id/i.test(String(placed.json.message))) {
      const existing = await this.getOrder(req.clientOrderId); // retried approval: already submitted, never double-send
      if (!existing) throw new Error("Duplicate client order id but the order could not be found.");
      fillJson = (existing.raw as AlpacaJson) ?? {};
    } else if (placed.status >= 400) {
      return { brokerOrderId: "", status: "rejected", filledQty: 0, raw: placed.json };
    } else {
      fillJson = placed.json;
    }

    // Alpaca cannot attach a stop to crypto or option entries, so it goes as its own order. The client id makes it idempotent.
    if (!closing && (crypto || option)) {
      const stopPrice = Number(o.stopPrice);
      const stop = await this.call("POST", "/v2/orders", {
        symbol: req.symbol,
        qty: String(o.qty),
        side: o.side === "buy" ? "sell" : "buy",
        // Alpaca crypto accepts market, limit and stop_limit only; the limit sits 1% beyond the stop so a gap still exits.
        type: crypto ? "stop_limit" : "stop",
        stop_price: String(stopPrice),
        ...(crypto ? { limit_price: String(+(stopPrice * (o.side === "buy" ? 0.99 : 1.01)).toFixed(2)) } : {}),
        time_in_force: crypto ? "gtc" : "day",
        client_order_id: `${req.clientOrderId}-stop`,
      });
      const duplicate = stop.status === 422 && /client_order_id/i.test(String(stop.json.message));
      if (stop.status >= 400 && !duplicate) throw new Error(`Entry placed but protective stop was refused (${stop.status}). Close the position manually.`);
    }
    return this.toFill(fillJson);
  }

  async cancelOrder(clientOrderId: string): Promise<void> {
    const existing = await this.getOrder(clientOrderId);
    if (existing) await this.call("DELETE", `/v2/orders/${existing.brokerOrderId}`);
  }
}
