// Read-only broker views for desk-account and desk-mark-positions. These classes implement BrokerReadPort only:
// there is no submit or cancel method to call, by construction.
import { ledgerAccount, type PaperStore } from "./paper.ts";
import type { BrokerAccount, BrokerFill, BrokerPosition, BrokerReadPort } from "./port.ts";
import type { TradingMode } from "../types.ts";

class PaperReader implements BrokerReadPort {
  readonly name = "paper" as const;
  readonly mode = "paper" as const;
  constructor(private store: PaperStore) {}
  async getAccount(): Promise<BrokerAccount> {
    return ledgerAccount(await this.store.load()).account;
  }
  async getPositions(): Promise<BrokerPosition[]> {
    return ledgerAccount(await this.store.load()).positions;
  }
  async getOrder(clientOrderId: string): Promise<BrokerFill | null> {
    const hit = (await this.store.load()).fills.find((f) => f.clientOrderId === clientOrderId);
    return hit ? { brokerOrderId: hit.brokerOrderId, status: "filled", filledQty: hit.qty, avgFillPrice: hit.price } : null;
  }
}

class AlpacaReader implements BrokerReadPort {
  readonly name = "alpaca" as const;
  constructor(readonly mode: TradingMode, private creds: { keyId: string; secret: string }, private f: typeof fetch = fetch) {}
  private async get(path: string) {
    const base = this.mode === "live" ? "https://api.alpaca.markets" : "https://paper-api.alpaca.markets";
    const res = await this.f(`${base}${path}`, { headers: { "APCA-API-KEY-ID": this.creds.keyId, "APCA-API-SECRET-KEY": this.creds.secret }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Alpaca read ${res.status}`);
    return res.json();
  }
  async getAccount(): Promise<BrokerAccount> {
    const a = await this.get("/v2/account");
    return { equity: Number(a.equity), cash: Number(a.cash), buyingPower: Number(a.buying_power), asOf: new Date().toISOString() };
  }
  async getPositions(): Promise<BrokerPosition[]> {
    const rows = (await this.get("/v2/positions")) as Record<string, string>[];
    return rows.map((r) => ({ symbol: r.symbol, qty: Number(r.qty), avgPrice: Number(r.avg_entry_price), marketValue: Number(r.market_value) }));
  }
  async getOrder(): Promise<BrokerFill | null> {
    return null;
  }
}

export function makeReadOnlyBroker(mode: TradingMode, deps: { paperStore: PaperStore; alpaca?: { keyId: string; secret: string }; paperVenue?: "internal" | "alpaca" }): BrokerReadPort {
  if (mode === "live") {
    if (!deps.alpaca) throw new Error("Live mode requires Alpaca credentials.");
    return new AlpacaReader("live", deps.alpaca);
  }
  if (deps.paperVenue === "alpaca" && deps.alpaca) return new AlpacaReader("paper", deps.alpaca);
  return new PaperReader(deps.paperStore);
}
