// The approval flow. IMPORT BOUNDARY: this is the only pipeline module allowed to use a trade-capable broker,
// and only desk-approve-order (plus tests) may import it.
//
// Order of operations, mirroring the database guards:
//   1. load the proposal (server side; the client sends only an id, a decision and a confirmation phrase)
//   2. rebuild every risk input from the database and the broker (equity, state, positions, quote)
//   3. evaluateRisk. A failure writes a risk event and leaves the proposal pending so the owner can modify it.
//   3b. a passing check writes a server-side 'check_passed' marker; the database refuses an approved decision without it
//   4. owner-scoped insert of the approval, then insert of the order (the DB trigger re-checks the approval),
//      then the broker call. Agents never reach steps 4 onward.
import { sha256Hex } from "../hash.ts";
import { evaluateRisk, type RiskDecision, type RiskInput } from "../risk/engine.ts";
import { analyseOption, isOptionStructure } from "../risk/options.ts";
import type { BrokerPort } from "../broker/port.ts";
import type { DeskRepo } from "./repo.ts";
import { assessQuote, type Quote } from "./quote.ts";
import { settleFill } from "./settle.ts";
import { syncState } from "./state.ts";
import type { TradingMode } from "../types.ts";

export interface ApproveDeps {
  repo: DeskRepo;
  broker: BrokerPort;
  mode: TradingMode;
  ownerId: string;
  now: () => Date;
  /**
   * Server-side quote for non-option instruments. Returns a dated Quote. A bare number has no date, so its age is unknown
   * and opening orders priced off it are refused (fail closed); closes pass with a warning.
   */
  quote: (symbol: string) => Promise<number | Quote | null>;
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
  /** Non-blocking notices for the owner, e.g. a stale quote on a close. */
  warnings?: string[];
  /** True when the order was accepted but is not filled yet; the reconciler settles it. The proposal is not 'executed'. */
  pendingFill?: boolean;
  error?: string;
}

export const livePhrase = (symbol: string, side: string, qty: number) => `LIVE ${symbol} ${side.toUpperCase()} ${qty}`;

/** The approval window enforced by desk_orders_guard is 5 minutes; stop retrying a little before it. */
const RETRY_WINDOW_MS = 4.5 * 60_000;

export async function approveOrder(d: ApproveDeps, input: ApproveInput): Promise<ApproveResult> {
  const proposal = await d.repo.getProposal(input.proposedOrderId);
  if (!proposal) return { ok: false, decision: "blocked", error: "Proposal not found." };

  // ---- recovery: a proposal stuck in 'approved' (the approval exists but no order was placed) ----
  let reuse: { id: string } | null = null;
  if (proposal.status === "approved") {
    if (input.decision === "rejected") return { ok: false, decision: "blocked", error: "Proposal is approved and cannot be rejected." };
    const ap = await d.repo.getApprovalForProposal(proposal.id);
    if (!ap || ap.decision !== "approved" || !ap.riskPassed) return { ok: false, decision: "blocked", error: "Proposal is approved but has no valid approval record. Nothing was placed." };
    if (ap.consumed) return { ok: false, decision: "blocked", error: "An order already exists for this proposal. Reconciliation will settle it; nothing was placed again." };
    if (d.now().getTime() - new Date(ap.decidedAt).getTime() > RETRY_WINDOW_MS) {
      // The approval is too old for the database to accept an order. Release the proposal (audited) rather than leave it stuck.
      await d.repo.setProposalStatus(proposal.id, "failed");
      await d.repo.logRisk({ type: "proposal_released", proposedOrderId: proposal.id, actor: "owner", details: { approvalId: ap.id, releasedBy: d.ownerId, reason: "approval window expired before an order was placed" } });
      return { ok: false, decision: "blocked", error: "The approval expired before an order was placed, so the proposal was released. Ask the agent for a fresh proposal." };
    }
    reuse = { id: ap.id }; // idempotent retry inside the window: same approval, same client order id
  } else if (proposal.status !== "pending") {
    return { ok: false, decision: "blocked", error: `Proposal is ${proposal.status}.` };
  }
  if (!reuse && new Date(proposal.expiresAt).getTime() < d.now().getTime()) {
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
  const warnings: string[] = [];
  const staleReasons: string[] = [];
  let refPrice: number | null;
  if (isOptionStructure(order.structure)) {
    if (held) {
      refPrice = held.markPrice ?? held.avgPrice; // option closes price off the position's last mark
    } else {
      const a = analyseOption(order.structure, order.legs);
      refPrice = a.ok ? Math.abs(a.netPremium) : null;
    }
  } else {
    const raw = await d.quote(order.symbol);
    const q: Quote | null = typeof raw === "number" ? { price: raw, asOf: "" } : raw;
    const fresh = assessQuote(q, order.structure, d.now());
    if (!fresh.fresh) {
      const msg = `quote_stale: ${fresh.message}`;
      if (order.intent === "open") staleReasons.push(`${msg} Opening orders need a fresh quote.`);
      else warnings.push(`${msg} The close is priced off the last known price.`);
      await d.repo.logRisk({ type: "stale_quote", proposedOrderId: proposal.id, actor: "system:desk-approve-order", details: { symbol: order.symbol, intent: order.intent, message: fresh.message, blocked: order.intent === "open" } });
    }
    refPrice = (fresh.fresh ? q!.price : null) ?? (held ? (held.markPrice ?? held.avgPrice) : null);
    // A stale quote must never size an opening order: the engine then sees no usable price and also fails closed.
    if (!fresh.fresh && order.intent === "open") refPrice = null;
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
  const reasons = [...staleReasons, ...risk.reasons, ...(phraseOk ? [] : ["live_confirmation: type the exact confirmation phrase to place a live order."])];
  const passed = risk.approved && phraseOk && staleReasons.length === 0;

  const inputHash = await sha256Hex(riskInput);
  if (!passed) {
    await d.repo.logRisk({ type: "check_failed", proposedOrderId: proposal.id, actor: "owner", details: { reasons, inputHash } });
    return { ok: false, decision: "blocked", risk: { ...risk, approved: false, reasons }, error: reasons[0], ...(warnings.length ? { warnings } : {}) };
  }
  // The marker the database requires before it accepts an approved decision. Written with the service role, bound to this
  // exact input hash and to the proposal's economics, so editing the proposal afterwards invalidates it.
  await d.repo.logRisk({
    type: "check_passed", proposedOrderId: proposal.id, actor: "system:desk-approve-order",
    details: { inputHash, engineVersion: risk.engineVersion, qty: order.qty, stopPrice: order.stopPrice, limitPrice: order.limitPrice ?? null, targetPrice: order.targetPrice ?? null },
  });

  // ---- approval (owner session) then order (trigger-gated) then broker ----
  const approvalId = reuse
    ? reuse.id
    : await d.repo.insertApproval({
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
    const settled = await settleFill({
      repo: d.repo, orderId, approvalId, proposal, fill, sized: risk.sized, mode: d.mode, fallbackPrice: refPrice ?? undefined,
    });
    const orderOut = { id: orderId, status: settled.orderStatus, brokerOrderId: fill.brokerOrderId, filledQty: fill.filledQty, avgFillPrice: fill.avgFillPrice };
    const extra = { ...(warnings.length ? { warnings } : {}) };
    if (settled.orderStatus === "rejected" || settled.orderStatus === "canceled") {
      return { ok: settled.proposalStatus === "executed", decision: "approved", risk, order: { ...orderOut, filledQty: settled.proposalStatus === "executed" ? fill.filledQty : 0 }, error: settled.proposalStatus === "executed" ? undefined : "Broker rejected the order.", ...extra };
    }
    if (settled.proposalStatus === "executed") return { ok: true, decision: "approved", risk, order: orderOut, ...extra };
    // Accepted by the broker but not filled (or unconfirmed): never reported as executed. The reconciler settles it.
    return { ok: true, decision: "approved", risk, order: orderOut, pendingFill: true, warnings: [...warnings, settled.note ?? "Order accepted but not filled yet. It will be settled by reconciliation; the position appears once it fills."] };
  } catch (e) {
    // Order row stays 'submitting'; reconciliation (getOrder by client id) settles it. A retry reuses the same approval and client order id.
    await d.repo.updateOrder(orderId, { status: "submitting", error: (e as Error).message });
    return { ok: false, decision: "approved", risk, order: { id: orderId, status: "submitting", filledQty: 0 }, error: `Broker call failed: ${(e as Error).message}`, ...(warnings.length ? { warnings } : {}) };
  }
}
