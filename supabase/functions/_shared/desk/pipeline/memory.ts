// In-memory DeskRepo used by tests and the seeded end-to-end run. It enforces the same invariants the
// database triggers enforce (order needs a matching, unconsumed, fresh, owner-made approval), so flow
// tests exercise realistic failure modes. The real triggers are proven separately against Postgres.
import type { OpenPositionSnapshot } from "../risk/engine.ts";
import { isOptionStructure } from "../risk/options.ts";
import type {
  ApprovalRow, DeskRepo, DeskState, OrderRow, OrderStatus, PositionRow, ProposalStatus, RunPatch,
  ScoreDbRow, StoredPosition, StoredProposal, StoredSignal, StoredThesis,
} from "./repo.ts";
import type { AssetClass, ProposedOrder, Signal, Thesis } from "../types.ts";

let seq = 0;
const nid = (p: string) => `${p}-${++seq}`;

export class InMemoryRepo implements DeskRepo {
  now: () => Date;
  ownerId: string;
  /** Who is calling: the owner's session or a service role. Mirrors auth.uid() in the database. */
  caller: string | null = null;
  instruments = new Map<string, { id: string; symbol: string; assetClass: AssetClass; name?: string }>();
  watchlist: string[] = [];
  runs = new Map<string, { id: string; agent: string; key: string; patch?: RunPatch }>();
  signals = new Map<string, StoredSignal & { dedupeKey: string }>();
  theses = new Map<string, StoredThesis>();
  proposals = new Map<string, StoredProposal & { thesisId?: string }>();
  approvals = new Map<string, ApprovalRow & { id: string; decidedAt: number; consumed: boolean }>();
  orders = new Map<string, OrderRow & { id: string; status: OrderStatus; filledQty: number; avgFillPrice?: number; brokerOrderId?: string; error?: string }>();
  positions = new Map<string, StoredPosition>();
  risk: { type: string; proposedOrderId?: string; actor: string; details?: unknown }[] = [];
  scores: ScoreDbRow[] = [];
  state: DeskState = { halted: false, haltedReason: null, highWaterMark: 0, dayStartEquity: 0, dayStartDate: null, lastEquity: 0 };

  constructor(opts: { ownerId?: string; now?: () => Date } = {}) {
    this.ownerId = opts.ownerId ?? "owner-1";
    this.now = opts.now ?? (() => new Date());
  }

  // ---- AgentRepo ----
  async upsertInstrument(i: { symbol: string; assetClass: AssetClass; name?: string }): Promise<string> {
    const hit = this.instruments.get(i.symbol);
    if (hit) return hit.id;
    const id = nid("inst");
    this.instruments.set(i.symbol, { id, ...i });
    return id;
  }
  async listWatchlist(): Promise<string[]> {
    return this.watchlist;
  }
  async startRun(agent: string, key: string): Promise<string | null> {
    const k = `${agent}:${key}`;
    if (this.runs.has(k)) return null;
    const id = nid("run");
    this.runs.set(k, { id, agent, key });
    return id;
  }
  async finishRun(id: string, p: RunPatch): Promise<void> {
    for (const r of this.runs.values()) if (r.id === id) r.patch = p;
  }
  async insertSignal(s: Omit<Signal, "id"> & { dedupeKey: string }): Promise<string | null> {
    if ([...this.signals.values()].some((x) => x.dedupeKey === s.dedupeKey)) return null;
    const inst = [...this.instruments.values()].find((i) => i.id === s.instrumentId);
    const id = nid("sig");
    this.signals.set(id, { ...s, id, symbol: inst?.symbol ?? "?", assetClass: inst?.assetClass ?? "equity", createdAt: this.now().toISOString() });
    return id;
  }
  async getSignal(id: string): Promise<StoredSignal | null> {
    return this.signals.get(id) ?? null;
  }
  async insertThesis(t: Thesis): Promise<string> {
    const inst = [...this.instruments.values()].find((i) => i.id === t.instrumentId);
    const id = nid("th");
    this.theses.set(id, { ...t, id, symbol: inst?.symbol ?? "?", createdAt: this.now().toISOString() });
    return id;
  }
  async insertProposal(o: ProposedOrder): Promise<string> {
    if (typeof o.stopPrice !== "number" || !(o.stopPrice > 0)) throw new Error("proposed order requires a stop_price (NOT NULL, > 0)");
    const id = nid("po");
    const created = this.now();
    this.proposals.set(id, { id, order: { ...o, id }, status: "pending", createdAt: created.toISOString(), expiresAt: new Date(created.getTime() + 86_400_000).toISOString(), thesisId: o.thesisId });
    return id;
  }

  // ---- DeskRepo ----
  async getProposal(id: string): Promise<StoredProposal | null> {
    return this.proposals.get(id) ?? null;
  }
  async setProposalStatus(id: string, status: ProposalStatus): Promise<void> {
    const p = this.proposals.get(id);
    if (p) p.status = status;
  }
  async getState(): Promise<DeskState> {
    return { ...this.state };
  }
  async patchState(p: Partial<DeskState>): Promise<void> {
    // Mirrors desk_state_guard: halted can be set freely, never cleared here; HWM never decreases.
    if (p.halted === false && this.state.halted) throw new Error("kill switch can only be reset by resetKillSwitch()");
    if (p.highWaterMark !== undefined && p.highWaterMark < this.state.highWaterMark) throw new Error("high-water mark cannot decrease");
    this.state = { ...this.state, ...p };
  }
  /** Owner-only reset path (desk_reset_kill_switch). */
  async resetKillSwitch(note: string): Promise<void> {
    if (this.caller !== this.ownerId) throw new Error("owner only");
    this.state = { ...this.state, halted: false, haltedReason: null, highWaterMark: this.state.lastEquity };
    this.risk.push({ type: "kill_switch_reset", actor: "owner", details: { note } });
  }
  async listOpenPositions(): Promise<StoredPosition[]> {
    return [...this.positions.values()].filter((p) => p.status === "open");
  }
  toSnapshots(positions: StoredPosition[]): OpenPositionSnapshot[] {
    return positions.map((p) => ({
      positionId: p.id, positionGroup: p.positionGroup, symbol: p.symbol, underlying: p.symbol, structure: p.structure,
      qty: p.qty, exposure: p.exposure, maxLoss: p.maxLoss,
    }));
  }
  async insertApproval(a: ApprovalRow): Promise<string> {
    if (this.caller !== this.ownerId || a.decidedBy !== this.ownerId) throw new Error("approvals require the owner session");
    const po = this.proposals.get(a.proposedOrderId);
    if (!po || po.status !== "pending") throw new Error("proposal not pending");
    if ([...this.approvals.values()].some((x) => x.proposedOrderId === a.proposedOrderId)) throw new Error("one decision per proposal");
    const id = nid("ap");
    this.approvals.set(id, { ...a, id, decidedAt: this.now().getTime(), consumed: false });
    po.status = a.decision === "approved" && a.riskPassed ? "approved" : "rejected";
    return id;
  }
  async insertOrder(o: OrderRow): Promise<string> {
    const a = this.approvals.get(o.approvalId);
    const po = this.proposals.get(o.proposedOrderId);
    if (!a || a.decision !== "approved" || !a.riskPassed || a.consumed || a.proposedOrderId !== o.proposedOrderId || this.now().getTime() - a.decidedAt > 5 * 60_000 || a.mode !== o.mode || (o.mode === "live" && !a.liveConfirmed)) {
      this.risk.push({ type: "trigger_block", proposedOrderId: o.proposedOrderId, actor: "system:db", details: { approval_id: o.approvalId } });
      throw new Error("order rejected: no valid approval");
    }
    if (!po || !(o.stopPrice > 0) || po.order.stopPrice !== o.stopPrice || po.order.qty !== o.qty || po.order.side !== o.side) throw new Error("order does not match approved proposal");
    if (this.state.halted && o.intent === "open") throw new Error("kill switch engaged");
    a.consumed = true;
    const id = nid("ord");
    this.orders.set(id, { ...o, id, status: "submitting", filledQty: 0 });
    return id;
  }
  async updateOrder(id: string, p: { status: OrderStatus; brokerOrderId?: string; filledQty?: number; avgFillPrice?: number; error?: string }): Promise<void> {
    const o = this.orders.get(id);
    if (o) Object.assign(o, p);
  }
  async openPosition(p: PositionRow): Promise<string> {
    const id = nid("pos");
    this.positions.set(id, { ...p, id, positionGroup: p.positionGroup ?? nid("grp"), markPrice: p.avgPrice, status: "open", openedAt: this.now().toISOString() });
    return id;
  }
  async markPosition(id: string, price: number): Promise<void> {
    const p = this.positions.get(id);
    if (p) p.markPrice = price;
  }
  async closePosition(id: string, price: number): Promise<void> {
    const p = this.positions.get(id);
    if (p) {
      p.status = "closed";
      p.markPrice = price;
    }
  }
  async listAllPositions(): Promise<StoredPosition[]> {
    return [...this.positions.values()];
  }
  async listPendingProposals(): Promise<StoredProposal[]> {
    return [...this.proposals.values()].filter((p) => p.status === "pending");
  }
  async logRisk(e: { type: string; proposedOrderId?: string; actor: string; details?: unknown }): Promise<void> {
    this.risk.push(e);
  }
  async listTheses(): Promise<StoredThesis[]> {
    return [...this.theses.values()];
  }
  async listScoredKeys(): Promise<Set<string>> {
    return new Set(this.scores.map((s) => `${s.subjectKind}:${s.subjectId}:${s.horizonDays}`));
  }
  async insertScores(rows: ScoreDbRow[]): Promise<void> {
    const have = await this.listScoredKeys();
    for (const r of rows) {
      const k = `${r.subjectKind}:${r.subjectId}:${r.horizonDays}`;
      if (!have.has(k)) {
        this.scores.push(r);
        have.add(k);
      }
    }
  }
  async listScores(): Promise<ScoreDbRow[]> {
    return [...this.scores];
  }
  async listSignals(): Promise<StoredSignal[]> {
    return [...this.signals.values()];
  }
  isOption(structure: ProposedOrder["structure"]): boolean {
    return isOptionStructure(structure);
  }
}
