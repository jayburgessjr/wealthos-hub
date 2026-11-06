// Broker ports. IMPORT BOUNDARY: BrokerTradePort (and anything under broker/ that can submit)
// may be imported only by supabase/functions/desk-approve-order. Read-only callers import BrokerReadPort.
// A grep test in src/test/desk enforces this.
import type { RiskDecision } from "../risk/engine.ts";
import type { ProposedOrder, TradingMode } from "../types.ts";

export interface BrokerAccount {
  equity: number;
  cash: number;
  buyingPower: number;
  asOf: string;
}

export interface BrokerPosition {
  symbol: string;
  qty: number;
  avgPrice: number;
  marketValue: number;
}

export interface BrokerFill {
  brokerOrderId: string;
  status: "submitted" | "partially_filled" | "filled" | "rejected" | "canceled";
  filledQty: number;
  avgFillPrice?: number;
  raw?: unknown;
}

export interface BrokerReadPort {
  readonly name: "paper" | "alpaca" | "ibkr";
  readonly mode: TradingMode;
  getAccount(): Promise<BrokerAccount>;
  getPositions(): Promise<BrokerPosition[]>;
  getOrder(clientOrderId: string): Promise<BrokerFill | null>;
}

/** Everything the trade port needs, including the proof that the risk engine passed. */
export interface SubmitRequest {
  clientOrderId: string;
  approvalId: string;
  symbol: string;
  order: ProposedOrder;
  decision: RiskDecision;
  mode: TradingMode;
}

export interface BrokerTradePort {
  submitOrder(req: SubmitRequest): Promise<BrokerFill>;
  cancelOrder(clientOrderId: string): Promise<void>;
}

export interface BrokerPort extends BrokerReadPort, BrokerTradePort {}

export class OrderRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderRefusedError";
  }
}

/** Runtime guard every adapter calls first. Refuses anything without a passing risk decision, an approval id and a valid stop. */
export function assertSubmittable(req: SubmitRequest, brokerMode: TradingMode): void {
  if (!req || !req.order) throw new OrderRefusedError("No order supplied.");
  if (!req.decision || req.decision.approved !== true || req.decision.reasons.length > 0) {
    throw new OrderRefusedError("Risk engine has not approved this order.");
  }
  if (!req.approvalId || req.clientOrderId !== req.approvalId) throw new OrderRefusedError("Order must carry its approval id as the client order id.");
  const stop = req.order.stopPrice;
  if (typeof stop !== "number" || !Number.isFinite(stop) || stop <= 0) throw new OrderRefusedError("Order has no valid stop price.");
  if (!Number.isFinite(req.order.qty) || req.order.qty <= 0) throw new OrderRefusedError("Order quantity is invalid.");
  if (req.mode !== brokerMode) throw new OrderRefusedError("Order mode does not match broker mode.");
}
