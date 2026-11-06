// Mark-to-market job. Uses account numbers and quotes passed in (read-only); it never touches a trade-capable broker.
// It rolls the day, ratchets the high-water mark, trips the kill switch, and PROPOSES (never places) exits.
import { RISK_LIMITS } from "../risk/limits.ts";
import type { DeskRepo } from "./repo.ts";
import { syncState } from "./state.ts";

export interface MarkResult {
  marked: number;
  tripped: boolean;
  closeProposals: number;
  drawdown: number;
}

export async function markPositions(d: { repo: DeskRepo; equity: number; quotes: Record<string, number>; now: Date }): Promise<MarkResult> {
  const state = await syncState(d.repo, d.equity, d.now);
  const drawdown = state.highWaterMark > 0 ? Math.max(0, (state.highWaterMark - d.equity) / state.highWaterMark) : 0;
  let tripped = false;
  if (drawdown >= RISK_LIMITS.DRAWDOWN_KILL - 1e-9 && !state.halted) {
    await d.repo.patchState({ halted: true, haltedReason: "drawdown limit reached" });
    await d.repo.logRisk({ type: "kill_switch_tripped", actor: "system:desk-mark-positions", details: { drawdown, equity: d.equity, highWaterMark: state.highWaterMark } });
    tripped = true;
  }

  const open = await d.repo.listOpenPositions();
  const pending = await d.repo.listPendingProposals();
  const pendingCloseIds = new Set(pending.filter((p) => p.order.intent === "close").map((p) => p.order.positionId));
  let marked = 0, closeProposals = 0;
  for (const p of open) {
    const px = d.quotes[p.symbol];
    if (!(typeof px === "number" && px > 0)) continue;
    await d.repo.markPosition(p.id, px);
    marked++;
    const stopHit = px <= p.stopPrice;
    const targetHit = p.targetPrice !== undefined && p.targetPrice !== null && px >= p.targetPrice;
    if ((stopHit || targetHit) && !pendingCloseIds.has(p.id)) {
      await d.repo.insertProposal({
        instrumentId: p.instrumentId, symbol: p.symbol, agentName: p.agentName ?? "system", intent: "close", positionId: p.id,
        structure: p.structure, side: "sell", qty: p.qty, orderType: "market", stopPrice: p.stopPrice, stopBasis: "price",
      });
      closeProposals++;
    }
  }
  return { marked, tripped, closeProposals, drawdown };
}
