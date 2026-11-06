// The approval flow. IMPORT BOUNDARY: this is the only pipeline module allowed to use a trade-capable broker,
// and only desk-approve-order (plus tests) may import it.
//
// Order of operations, mirroring the database guards:
//   1. load the proposal (server side; the client sends only an id, a decision and a confirmation phrase)
//   2. rebuild every risk input from the database and the broker (equity, state, positions, quote)
//   3. evaluateRisk. A failure writes a risk event and leaves the proposal pending so the owner can modify it.
//   4. owner-scoped insert of the approval, then insert of the order (the DB trigger re-checks the approval),
//      then the broker call. Agents never reach steps 4 onward.
import { sha256Hex } from "../hash.ts";
import { evaluateRisk, type RiskDecision, type RiskInput } from "../risk/engine.ts";
import { analyseOption, isOptionStructure } from "../risk/options.ts";
import type { BrokerPort } from "../broker/port.ts";
import type { DeskRepo } from "./repo.ts";
import { syncState } from "./state.ts";
import type { TradingMode } from "../types.ts";

export interface ApproveDeps {
  repo: DeskRepo;
  broker: BrokerPort;
  mode: TradingMode;
  ownerId: string;
  now: () => Date;
  /** Server-side quote for non-option instruments. */
  quote: (symbol: string) => Promise<number | null>;
}

export interface ApproveInput {
  proposedOrderId: string;
  decision: "approved" | "rejected";
  liveConfirmation?: string;
}

export interface ApproveResult {
  ok: boolean;
  decision: "approved" | "rejected" | "blocked";
  risk?: RiskDecision;
  order?: { id: string; status: string; brokerOrderId?: string; filledQty: number; avgFillPrice?: number };
  error?: string;
}

export const livePhrase = (symbol: string, side: string, qty: number) => `LIVE ${symbol} ${side.toUpperCase()} ${qty}`;

export async function approveOrder(d: ApproveDeps, input: ApproveInput): Promise<ApproveResult> {
  const proposal = await d.repo.getProposal(input.proposedOrderId);
  if (!proposal) return { ok: false, decision: "blocked", error: "Proposal not found." };
  if (proposal.status !== "pending") return { ok: false, decision: "blocked", error: `Proposal is ${proposal.status}.` };
  if (new Date(proposal.expiresAt).getTime() < d.now().getTime()) {
    await d.repo.setProposalStatus(proposal.id, "expired");
    return { ok: false, decision: "blocked", error: "Proposal has expired." };
  }
  const order = proposal.order;

  // ---- explicit owner rejection: recorded, nothing else happens ----
  if (input.decision === "rejected") {
    await d.repo.insertApproval({
      proposedOrderId: proposal.id, decision: "rejected", riskPassed: false, riskDecision: { rejectedByOwner: true },
      riskInputHash: await sha256Hex({ proposal: proposal.id, rejected: true }), mode: d.mode, liveConfirmed: false, decidedBy: d.ownerId,
    });
    return { ok: true, decision: "rejected" };
  }

  // ---- rebuild risk inputs server side ----
  const account = await d.broker.getAccount();
  const state = await syncState(d.repo, account.equity, d.now());
  const positions = await d.repo.listOpenPositions();
  const held = order.intent === "close" ? positions.find((x) => x.id === order.positionId) : undefined;
  let refPrice: number | null;
  if (isOptionStructure(order.structure)) {
    if (held) {
      refPrice = held.markPrice ?? held.avgPrice; // option closes price off the position's last mark
    } else {
      const a = analyseOption(order.structure, order.legs);
      refPrice = a.ok ? Math.abs(a.netPremium) : null;
    }
  } else {
    refPrice = (await d.quote(order.symbol)) ?? (held ? (held.markPrice ?? held.avgPrice) : null);
  }
  const riskInput: RiskInput = {
    order, refPrice: refPrice ?? NaN, equity: account.equity, dayStartEquity: state.dayStartEquity, highWaterMark: state.highWaterMark,
    halted: state.halted, openPositions: d.repo.toSnapshots(positions),
  };
  const risk = evaluateRisk(riskInput);

  // Persist engine side effects whether or not the trade passes.
  if (risk.effects.tripKillSwitch && !state.halted) {
    await d.repo.patchState({ halted: true, haltedReason: "drawdown limit reached" });
    await d.repo.logRisk({ type: "kill_switch_tripped", proposedOrderId: proposal.id, actor: "system:desk-approve-order", details: { drawdown: riskInput.highWaterMark, equity: account.equity } });
  }
  if (risk.effects.dailyLimitHit) await d.repo.logRisk({ type: "daily_limit_hit", proposedOrderId: proposal.id, actor: "system:desk-approve-order" });

  // ---- live gate: typed phrase must match exactly ----
  const phraseOk = d.mode !== "live" || input.liveConfirmation === livePhrase(order.symbol, order.side, order.qty);
  const reasons = [...risk.reasons, ...(phraseOk ? [] : ["live_confirmation: type the exact confirmation phrase to place a live order."])];
  const passed = risk.approved && phraseOk;

  const inputHash = await sha256Hex(riskInput);
  if (!passed) {
    await d.repo.logRisk({ type: "check_failed", proposedOrderId: proposal.id, actor: "owner", details: { reasons, inputHash } });
    return { ok: false, decision: "blocked", risk: { ...risk, approved: false, reasons }, error: reasons[0] };
  }
  await d.repo.logRisk({ type: "check_passed", proposedOrderId: proposal.id, actor: "owner", details: { inputHash, engineVersion: risk.engineVersion } });

  // ---- approval (owner session) then order (trigger-gated) then broker ----
  const approvalId = await d.repo.insertApproval({
    proposedOrderId: proposal.id, decision: "approved", riskPassed: true, riskDecision: risk, riskInputHash: inputHash, mode: d.mode,
    liveConfirmed: d.mode === "live" && phraseOk, liveConfirmation: input.liveConfirmation, decidedBy: d.ownerId,
  });

  const orderId = await d.repo.insertOrder({
    approvalId, proposedOrderId: proposal.id, instrumentId: order.instrumentId, mode: d.mode, broker: d.broker.name, clientOrderId: approvalId,
    intent: order.intent, structure: order.structure, side: order.side, qty: order.qty, orderType: order.orderType, limitPrice: order.limitPrice,
    stopPrice: order.stopPrice as number, targetPrice: order.targetPrice, legs: order.legs,
  });

  // The broker request may carry details the stored proposal does not (position legs and group on a close, a mark-based
  // price for option closes). The stored order row above is unchanged, so the database still sees the approved economics.
  const optionOrder = isOptionStructure(order.structure);
  const brokerOrder = {
    ...order,
    positionGroup: held ? held.positionGroup : optionOrder ? approvalId : order.positionGroup,
    legs: order.legs ?? (held?.legs as typeof order.legs),
    ...(optionOrder && held && refPrice ? { limitPrice: refPrice } : {}),
  };

  try {
    const fill = await d.broker.submitOrder({ clientOrderId: approvalId, approvalId, symbol: order.symbol, order: brokerOrder, decision: risk, mode: d.mode });
    const status = fill.status === "filled" ? "filled" : fill.status === "partially_filled" ? "partially_filled" : fill.status === "rejected" ? "rejected" : fill.status === "canceled" ? "canceled" : "submitted";
    await d.repo.updateOrder(orderId, { status, brokerOrderId: fill.brokerOrderId, filledQty: fill.filledQty, avgFillPrice: fill.avgFillPrice });

    if (fill.status === "rejected" || fill.status === "canceled") {
      await d.repo.setProposalStatus(proposal.id, "failed");
      return { ok: false, decision: "approved", risk, order: { id: orderId, status, filledQty: 0 }, error: "Broker rejected the order." };
    }

    if (fill.filledQty > 0) {
      const entry = fill.avgFillPrice ?? refPrice ?? 0;
      if (order.intent === "open") {
        await d.repo.openPosition({
          instrumentId: order.instrumentId, symbol: order.symbol, thesisId: order.thesisId, agentName: order.agentName, mode: d.mode,
          structure: order.structure, legs: order.legs, qty: fill.filledQty, avgPrice: entry, stopPrice: order.stopPrice as number,
          targetPrice: order.targetPrice, maxLoss: risk.sized.maxLoss, exposure: risk.sized.exposure, openedOrderId: orderId, positionGroup: optionOrder ? approvalId : order.positionGroup,
        });
      } else if (order.positionId) {
        await d.repo.closePosition(order.positionId, entry, orderId);
      }
    }
    await d.repo.setProposalStatus(proposal.id, "executed");
    return { ok: true, decision: "approved", risk, order: { id: orderId, status, brokerOrderId: fill.brokerOrderId, filledQty: fill.filledQty, avgFillPrice: fill.avgFillPrice } };
  } catch (e) {
    // Order row stays 'submitting'; reconciliation (getOrder by client id) settles it. A retry cannot double-submit.
    await d.repo.updateOrder(orderId, { status: "submitting", error: (e as Error).message });
    return { ok: false, decision: "approved", risk, order: { id: orderId, status: "submitting", filledQty: 0 }, error: `Broker call failed: ${(e as Error).message}` };
  }
}
