// Turns a broker fill report into database state. Shared by the approve flow and the order reconciler so both apply
// identical rules. No broker import: it works on a plain FillInfo.
//
// Rules (fail closed):
//  - a proposal becomes 'executed' only when the order is filled AND filledQty > 0 and the position is recorded;
//  - 'submitted' / 'partially_filled' leave the proposal 'approved' (awaiting fill) for the reconciler to settle;
//  - 'filled' with zero quantity is treated as unconfirmed ('submitted' plus an error note), never as an execution;
//  - rejected / canceled with nothing filled fails the proposal; a partial fill on an open order keeps the filled part.
import { isOptionStructure } from "../risk/options.ts";
import type { DeskRepo, OrderStatus, ProposalStatus, StoredProposal } from "./repo.ts";

export interface FillInfo {
  status: "submitted" | "partially_filled" | "filled" | "rejected" | "canceled";
  brokerOrderId?: string;
  filledQty: number;
  avgFillPrice?: number;
}

export interface SettleInput {
  repo: DeskRepo;
  orderId: string;
  approvalId: string;
  proposal: StoredProposal;
  fill: FillInfo;
  sized: { maxLoss: number; exposure: number };
  mode: "paper" | "live";
  /** Used for the position entry price when the broker reports no average fill price. */
  fallbackPrice?: number;
}

export interface SettleResult {
  orderStatus: OrderStatus;
  proposalStatus: ProposalStatus;
  positionRecorded: boolean;
  note?: string;
}

export async function settleFill(i: SettleInput): Promise<SettleResult> {
  const o = i.proposal.order;
  const fq = Number.isFinite(i.fill.filledQty) && i.fill.filledQty > 0 ? i.fill.filledQty : 0;
  let orderStatus: OrderStatus = i.fill.status;
  let error: string | undefined;
  if (i.fill.status === "filled" && fq === 0) {
    orderStatus = "submitted";
    error = "Broker reported filled with zero quantity; awaiting reconciliation.";
  }
  await i.repo.updateOrder(i.orderId, { status: orderStatus, brokerOrderId: i.fill.brokerOrderId, filledQty: fq, avgFillPrice: i.fill.avgFillPrice, error });

  const optionOrder = isOptionStructure(o.structure);
  const record = async (qty: number): Promise<{ done: boolean; note?: string }> => {
    if (await i.repo.orderHasPosition(i.orderId)) return { done: true };
    const entry = i.fill.avgFillPrice ?? i.fallbackPrice;
    if (!(typeof entry === "number" && Number.isFinite(entry) && entry > 0)) return { done: false, note: "No fill price available; position not recorded. Review manually." };
    if (o.intent === "open") {
      await i.repo.openPosition({
        instrumentId: o.instrumentId, symbol: o.symbol, thesisId: o.thesisId, agentName: o.agentName, mode: i.mode, structure: o.structure, legs: o.legs,
        qty, avgPrice: entry, stopPrice: o.stopPrice as number, targetPrice: o.targetPrice, maxLoss: i.sized.maxLoss, exposure: i.sized.exposure,
        openedOrderId: i.orderId, positionGroup: optionOrder ? i.approvalId : o.positionGroup,
      });
      return { done: true };
    }
    if (o.positionId) { await i.repo.closePosition(o.positionId, entry, i.orderId); return { done: true }; }
    return { done: false, note: "Close order has no position id." };
  };

  if (orderStatus === "filled") {
    const r = await record(fq);
    if (!r.done) return { orderStatus, proposalStatus: "approved", positionRecorded: false, note: r.note };
    await i.repo.setProposalStatus(i.proposal.id, "executed");
    return { orderStatus, proposalStatus: "executed", positionRecorded: true };
  }
  if (orderStatus === "rejected" || orderStatus === "canceled") {
    if (fq > 0 && o.intent === "open") {
      const r = await record(fq);
      if (r.done) { await i.repo.setProposalStatus(i.proposal.id, "executed"); return { orderStatus, proposalStatus: "executed", positionRecorded: true, note: "Order ended with a partial fill; the filled quantity was recorded." }; }
      return { orderStatus, proposalStatus: "approved", positionRecorded: false, note: r.note };
    }
    await i.repo.setProposalStatus(i.proposal.id, "failed");
    return { orderStatus, proposalStatus: "failed", positionRecorded: false, note: fq > 0 ? "Partial close fill ended without a full fill; review the position manually." : undefined };
  }
  // submitted or partially_filled: still working at the broker
  return { orderStatus, proposalStatus: "approved", positionRecorded: false, note: error };
}
