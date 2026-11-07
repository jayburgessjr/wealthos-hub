// Order reconciler. Settles orders that never reached a terminal state: a broker call that threw after the order row was
// written ('submitting'), or an asynchronous fill that was only 'submitted' / 'partially_filled' when we last looked.
// It only READS from the broker (getOrder by client order id, which equals the approval id) and writes database state.
// It never submits or cancels anything. Idempotent: positions are recorded once per order.
import type { DeskRepo } from "./repo.ts";
import { settleFill, type FillInfo } from "./settle.ts";

export interface ReconcileSource {
  getOrder(clientOrderId: string): Promise<FillInfo | null>;
}

export interface ReconcileResult {
  checked: number;
  settled: number;
  failed: number;
  stillOpen: number;
  errors: number;
}

/** A 'submitting' order with no broker record after this long never reached the broker. */
export const SUBMITTING_GRACE_MS = 10 * 60_000;

export async function reconcileOrders(d: { repo: DeskRepo; broker: ReconcileSource; now: Date; graceMs?: number }): Promise<ReconcileResult> {
  const res: ReconcileResult = { checked: 0, settled: 0, failed: 0, stillOpen: 0, errors: 0 };
  const grace = d.graceMs ?? SUBMITTING_GRACE_MS;
  for (const o of await d.repo.listUnsettledOrders()) {
    res.checked++;
    try {
      const proposal = await d.repo.getProposal(o.proposedOrderId);
      if (!proposal) { res.errors++; continue; }
      const fill = await d.broker.getOrder(o.clientOrderId);
      if (!fill) {
        const age = d.now.getTime() - new Date(o.createdAt).getTime();
        if (o.status === "submitting" && age > grace) {
          await d.repo.updateOrder(o.id, { status: "failed", error: "No broker record for this client order id; the order never reached the broker." });
          if (proposal.status === "approved") await d.repo.setProposalStatus(proposal.id, "failed");
          await d.repo.logRisk({ type: "order_reconcile_failed", proposedOrderId: proposal.id, actor: "system:desk-reconcile-orders", details: { orderId: o.id, from: o.status, reason: "no_broker_record" } });
          res.failed++;
        } else res.stillOpen++;
        continue;
      }
      const approval = await d.repo.getApprovalForProposal(o.proposedOrderId);
      const sized = ((approval?.riskDecision ?? {}) as { sized?: { maxLoss?: number; exposure?: number } }).sized ?? {};
      const r = await settleFill({
        repo: d.repo, orderId: o.id, approvalId: o.approvalId, proposal, fill, mode: approval?.mode ?? "paper",
        sized: { maxLoss: Number(sized.maxLoss) || 0, exposure: Number(sized.exposure) || 0 }, fallbackPrice: proposal.order.limitPrice,
      });
      if (r.orderStatus !== o.status || r.note) {
        await d.repo.logRisk({ type: "order_reconciled", proposedOrderId: proposal.id, actor: "system:desk-reconcile-orders", details: { orderId: o.id, from: o.status, to: r.orderStatus, proposal: r.proposalStatus, note: r.note ?? null } });
      }
      if (r.proposalStatus === "executed" || r.proposalStatus === "failed") res.settled++; else res.stillOpen++;
    } catch {
      res.errors++; // one bad order never sinks the run
    }
  }
  return res;
}
