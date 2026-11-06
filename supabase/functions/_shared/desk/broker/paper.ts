// Paper broker. Stateless over a ledger: account and positions are derived from recorded fills,
// so it works across edge-function invocations (the ledger is read from desk_orders by the caller).
import { analyseOption } from "../risk/options.ts";
import { isOptionStructure } from "../risk/options.ts";
import { assertSubmittable, type BrokerAccount, type BrokerFill, type BrokerPort, type BrokerPosition, type SubmitRequest } from "./port.ts";

export interface LedgerFill {
  clientOrderId: string;
  /** stock/crypto: symbol. options: symbol#positionGroup. */
  key: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  multiplier: number;
  brokerOrderId: string;
}

export interface PaperLedger {
  startingCash: number;
  fills: LedgerFill[];
  /** latest mark by key; falls back to last fill price */
  marks: Record<string, number>;
}

export interface PaperStore {
  load(): Promise<PaperLedger>;
  /** Optional: in-memory stores record the fill; the DB store does not (the caller writes desk_orders). */
  append?(fill: LedgerFill): Promise<void>;
}

export class InMemoryPaperStore implements PaperStore {
  fills: LedgerFill[] = [];
  marks: Record<string, number> = {};
  constructor(public startingCash = 100_000) {}
  async load(): Promise<PaperLedger> {
    return { startingCash: this.startingCash, fills: [...this.fills], marks: { ...this.marks } };
  }
  async append(fill: LedgerFill): Promise<void> {
    this.fills.push(fill);
  }
}

export function ledgerAccount(l: PaperLedger): { account: BrokerAccount; positions: BrokerPosition[] } {
  let cash = l.startingCash;
  const net = new Map<string, { symbol: string; qty: number; cost: number; mult: number; last: number }>();
  for (const f of l.fills) {
    const sign = f.side === "buy" ? 1 : -1;
    cash -= sign * f.qty * f.price * f.multiplier;
    const p = net.get(f.key) ?? { symbol: f.symbol, qty: 0, cost: 0, mult: f.multiplier, last: f.price };
    p.qty += sign * f.qty;
    p.cost += sign * f.qty * f.price * f.multiplier;
    p.last = f.price;
    net.set(f.key, p);
  }
  const positions: BrokerPosition[] = [];
  let mv = 0;
  for (const [key, p] of net) {
    if (Math.abs(p.qty) < 1e-12) continue;
    const mark = l.marks[key] ?? p.last;
    const value = p.qty * mark * p.mult;
    mv += value;
    positions.push({ symbol: key, qty: p.qty, avgPrice: Math.abs(p.cost / (p.qty * p.mult)), marketValue: value });
  }
  const equity = cash + mv;
  return { account: { equity, cash, buyingPower: Math.max(0, cash), asOf: "ledger" }, positions };
}

export class PaperBroker implements BrokerPort {
  readonly name = "paper" as const;
  readonly mode = "paper" as const;

  constructor(
    private store: PaperStore,
    /** Server-side quote for a symbol. Stock/crypto price; for options the net premium comes from the legs instead. */
    private quote: (symbol: string) => Promise<number | null>,
    private slippageBps = 10,
  ) {}

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

  async submitOrder(req: SubmitRequest): Promise<BrokerFill> {
    assertSubmittable(req, "paper");
    const prior = await this.getOrder(req.clientOrderId);
    if (prior) return prior; // idempotent on client order id

    const o = req.order;
    const option = isOptionStructure(o.structure);
    let price: number | null;
    if (option) {
      const a = analyseOption(o.structure, o.legs);
      price = a.ok ? Math.abs(a.netPremium) : null;
    } else {
      const q = await this.quote(req.symbol);
      price = q === null ? null : o.orderType === "limit" && o.limitPrice ? Math.min(q, o.limitPrice) : q * (1 + this.slippageBps / 10_000);
    }
    if (price === null || !(price > 0)) return { brokerOrderId: `paper-${req.clientOrderId}`, status: "rejected", filledQty: 0 };

    const fill: LedgerFill = {
      clientOrderId: req.clientOrderId,
      key: option ? `${req.symbol}#${o.positionGroup ?? req.clientOrderId}` : req.symbol,
      symbol: req.symbol,
      side: o.side,
      qty: o.qty,
      price,
      multiplier: option ? 100 : 1,
      brokerOrderId: `paper-${req.clientOrderId}`,
    };
    await this.store.append?.(fill);
    return { brokerOrderId: fill.brokerOrderId, status: "filled", filledQty: o.qty, avgFillPrice: price };
  }

  async cancelOrder(): Promise<void> {
    // Paper fills are immediate; nothing to cancel.
  }
}
