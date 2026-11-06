// Supabase-backed DeskRepo (Deno only; not imported by Vitest). Column names follow
// supabase/migrations/20261107000000_desk_core.sql.
//   admin: service-role client for agent writes, orders, positions, scores.
//   user:  owner-JWT client, used ONLY for insertApproval so the database sees auth.uid() = owner.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { OpenPositionSnapshot } from "../risk/engine.ts";
import type {
  ApprovalRow, DeskRepo, DeskState, OrderRow, OrderStatus, PositionRow, ProposalStatus, RunPatch, ScoreDbRow,
  StoredPosition, StoredProposal, StoredSignal, StoredThesis,
} from "./repo.ts";
import type { AssetClass, ProposedOrder, Signal, Structure, Thesis } from "../types.ts";

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v === null || v === undefined ? NaN : Number(v));
const optNum = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const DUP = "23505";

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error || res.data === null) throw new Error(`${what}: ${res.error?.message ?? "no data"}`);
  return res.data;
}

const POSITION_COLS =
  "id, position_group, instrument_id, thesis_id, agent_name, mode, structure, legs, qty, avg_price, stop_price, target_price, max_loss, exposure, mark_price, status, opened_order_id, opened_at, desk_instruments(symbol)";
const PROPOSAL_COLS =
  "id, thesis_id, instrument_id, agent_name, intent, position_id, structure, side, qty, order_type, limit_price, legs, stop_price, stop_basis, target_price, status, expires_at, created_at, desk_instruments(symbol)";
const SIGNAL_COLS = "id, instrument_id, agent_name, kind, direction, strength, summary, source_links, created_at, desk_instruments(symbol, asset_class)";

const symbolOf = (r: Row) => String((r.desk_instruments as Row | null)?.symbol ?? "?");

function toPosition(r: Row): StoredPosition {
  return {
    id: String(r.id), positionGroup: String(r.position_group), instrumentId: String(r.instrument_id), symbol: symbolOf(r),
    thesisId: (r.thesis_id as string) ?? undefined, agentName: (r.agent_name as string) ?? undefined, mode: r.mode as "paper" | "live",
    structure: r.structure as Structure, legs: r.legs ?? undefined, qty: num(r.qty), avgPrice: num(r.avg_price), stopPrice: num(r.stop_price),
    targetPrice: optNum(r.target_price), maxLoss: num(r.max_loss), exposure: num(r.exposure), openedOrderId: String(r.opened_order_id ?? ""),
    markPrice: optNum(r.mark_price) ?? null, status: r.status as "open" | "closed", openedAt: String(r.opened_at),
  };
}

function toProposal(r: Row): StoredProposal & { order: ProposedOrder } {
  const order: ProposedOrder = {
    id: String(r.id), thesisId: (r.thesis_id as string) ?? undefined, instrumentId: String(r.instrument_id), symbol: symbolOf(r),
    agentName: String(r.agent_name), intent: r.intent as "open" | "close", positionId: (r.position_id as string) ?? undefined,
    structure: r.structure as Structure, side: r.side as "buy" | "sell", qty: num(r.qty), orderType: r.order_type as "market" | "limit",
    limitPrice: optNum(r.limit_price), legs: (r.legs as ProposedOrder["legs"]) ?? undefined, stopPrice: num(r.stop_price),
    stopBasis: r.stop_basis as ProposedOrder["stopBasis"], targetPrice: optNum(r.target_price),
  };
  return { id: String(r.id), order, status: r.status as ProposalStatus, expiresAt: String(r.expires_at), createdAt: String(r.created_at) };
}

function toSignal(r: Row): StoredSignal {
  const inst = r.desk_instruments as Row | null;
  return {
    id: String(r.id), instrumentId: String(r.instrument_id), symbol: String(inst?.symbol ?? "?"), assetClass: (inst?.asset_class as AssetClass) ?? "equity",
    agentName: String(r.agent_name), kind: String(r.kind), direction: r.direction as Signal["direction"], strength: num(r.strength),
    summary: String(r.summary), sourceLinks: (r.source_links as Signal["sourceLinks"]) ?? [], createdAt: String(r.created_at),
  };
}

export class SupabaseRepo implements DeskRepo {
  constructor(private admin: SupabaseClient, private user?: SupabaseClient) {}

  // ---------------- AgentRepo ----------------
  async upsertInstrument(i: { symbol: string; assetClass: AssetClass; name?: string }): Promise<string> {
    const ins = await this.admin.from("desk_instruments").insert({ symbol: i.symbol, asset_class: i.assetClass, name: i.name ?? null }).select("id").single();
    if (!ins.error) return String(ins.data.id);
    if (ins.error.code !== DUP) throw new Error(`upsertInstrument: ${ins.error.message}`);
    return String(must(await this.admin.from("desk_instruments").select("id").eq("symbol", i.symbol).single(), "instrument lookup").id);
  }

  async listWatchlist(): Promise<string[]> {
    const { data, error } = await this.admin.from("desk_instruments").select("symbol").eq("on_watchlist", true).eq("active", true).in("asset_class", ["equity", "etf"]).limit(100);
    if (error) throw new Error(`listWatchlist: ${error.message}`);
    return (data ?? []).map((r: Row) => String(r.symbol));
  }

  async startRun(agent: string, key: string, trigger: "cron" | "manual"): Promise<string | null> {
    const res = await this.admin.from("desk_agent_runs").insert({ agent_name: agent, idempotency_key: key, trigger }).select("id").single();
    if (res.error?.code === DUP) return null;
    return String(must(res, "startRun").id);
  }

  async finishRun(id: string, p: RunPatch): Promise<void> {
    const { error } = await this.admin.from("desk_agent_runs").update({
      status: p.status, summary: p.summary ?? null, error: p.error ?? null, model: p.model ?? null,
      input_tokens: p.inputTokens ?? null, output_tokens: p.outputTokens ?? null, finished_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw new Error(`finishRun: ${error.message}`);
  }

  async insertSignal(s: Omit<Signal, "id"> & { dedupeKey: string }): Promise<string | null> {
    const res = await this.admin.from("desk_signals").insert({
      instrument_id: s.instrumentId, agent_name: s.agentName, kind: s.kind, direction: s.direction, strength: Math.round(s.strength * 1000) / 1000,
      summary: s.summary, source_links: s.sourceLinks, dedupe_key: s.dedupeKey, raw: s.raw ?? null,
    }).select("id").single();
    if (res.error?.code === DUP) return null;
    return String(must(res, "insertSignal").id);
  }

  async getSignal(id: string): Promise<StoredSignal | null> {
    const { data, error } = await this.admin.from("desk_signals").select(SIGNAL_COLS).eq("id", id).maybeSingle();
    if (error) throw new Error(`getSignal: ${error.message}`);
    return data ? toSignal(data as Row) : null;
  }

  async insertThesis(t: Thesis, runId?: string): Promise<string> {
    return String(must(await this.admin.from("desk_theses").insert({
      instrument_id: t.instrumentId, signal_ids: t.signalIds, agent_name: t.agentName, agent_run_id: runId ?? null, direction: t.direction,
      bull_case: t.bullCase, bear_case: t.bearCase, catalysts: t.catalysts, entry_price: t.entryPrice, stop_price: t.stopPrice, target_price: t.targetPrice,
      size_risk_pct: t.sizeRiskPct === undefined ? null : Math.min(0.015, Math.round(t.sizeRiskPct * 1e4) / 1e4), size_qty: t.sizeQty ?? null,
      confidence: Math.round(t.confidence * 1000) / 1000, invalidation: t.invalidation, horizon_days: t.horizonDays,
    }).select("id").single(), "insertThesis").id);
  }

  async insertProposal(o: ProposedOrder, runId?: string): Promise<string> {
    return String(must(await this.admin.from("desk_proposed_orders").insert({
      thesis_id: o.thesisId ?? null, instrument_id: o.instrumentId, agent_name: o.agentName, agent_run_id: runId ?? null, intent: o.intent,
      position_id: o.positionId ?? null, structure: o.structure, side: o.side, qty: o.qty, order_type: o.orderType, limit_price: o.limitPrice ?? null,
      legs: o.legs ?? null, stop_price: o.stopPrice, stop_basis: o.stopBasis, target_price: o.targetPrice ?? null,
    }).select("id").single(), "insertProposal").id);
  }

  // ---------------- DeskRepo ----------------
  async getProposal(id: string): Promise<StoredProposal | null> {
    const { data, error } = await this.admin.from("desk_proposed_orders").select(PROPOSAL_COLS).eq("id", id).maybeSingle();
    if (error) throw new Error(`getProposal: ${error.message}`);
    return data ? toProposal(data as Row) : null;
  }

  async setProposalStatus(id: string, status: ProposalStatus): Promise<void> {
    const { error } = await this.admin.from("desk_proposed_orders").update({ status }).eq("id", id);
    if (error) throw new Error(`setProposalStatus: ${error.message}`);
  }

  async getState(): Promise<DeskState> {
    const r = must(await this.admin.from("desk_state").select("halted, halted_reason, high_water_mark, day_start_equity, day_start_date, last_equity").eq("id", true).single(), "getState") as Row;
    return {
      halted: Boolean(r.halted), haltedReason: (r.halted_reason as string) ?? null, highWaterMark: num(r.high_water_mark),
      dayStartEquity: num(r.day_start_equity), dayStartDate: (r.day_start_date as string) ?? null, lastEquity: num(r.last_equity),
    };
  }

  async patchState(p: Partial<DeskState>): Promise<void> {
    const row: Row = { last_equity_at: new Date().toISOString() };
    if (p.halted !== undefined) { row.halted = p.halted; if (p.halted) row.halted_at = new Date().toISOString(); }
    if (p.haltedReason !== undefined) row.halted_reason = p.haltedReason;
    if (p.highWaterMark !== undefined) row.high_water_mark = Math.round(p.highWaterMark * 100) / 100;
    if (p.dayStartEquity !== undefined) row.day_start_equity = Math.round(p.dayStartEquity * 100) / 100;
    if (p.dayStartDate !== undefined) row.day_start_date = p.dayStartDate;
    if (p.lastEquity !== undefined) row.last_equity = Math.round(p.lastEquity * 100) / 100;
    const { error } = await this.admin.from("desk_state").update(row).eq("id", true);
    if (error) throw new Error(`patchState: ${error.message}`);
  }

  async listOpenPositions(): Promise<StoredPosition[]> {
    const { data, error } = await this.admin.from("desk_positions").select(POSITION_COLS).eq("status", "open").limit(500);
    if (error) throw new Error(`listOpenPositions: ${error.message}`);
    return (data ?? []).map((r) => toPosition(r as Row));
  }

  async listAllPositions(): Promise<StoredPosition[]> {
    const { data, error } = await this.admin.from("desk_positions").select(POSITION_COLS).order("opened_at", { ascending: false }).limit(1000);
    if (error) throw new Error(`listAllPositions: ${error.message}`);
    return (data ?? []).map((r) => toPosition(r as Row));
  }

  toSnapshots(positions: StoredPosition[]): OpenPositionSnapshot[] {
    return positions.map((p) => ({
      positionId: p.id, positionGroup: p.positionGroup, symbol: p.symbol, underlying: p.symbol, structure: p.structure,
      qty: p.qty, exposure: p.exposure, maxLoss: p.maxLoss,
    }));
  }

  async insertApproval(a: ApprovalRow): Promise<string> {
    if (!this.user) throw new Error("insertApproval requires the owner session client");
    return String(must(await this.user.from("desk_approvals").insert({
      proposed_order_id: a.proposedOrderId, decision: a.decision, risk_passed: a.riskPassed, risk_decision: a.riskDecision, risk_input_hash: a.riskInputHash,
      mode: a.mode, live_confirmed: a.liveConfirmed, live_confirmation: a.liveConfirmation ?? null, decided_by: a.decidedBy,
    }).select("id").single(), "insertApproval").id);
  }

  async insertOrder(o: OrderRow): Promise<string> {
    return String(must(await this.admin.from("desk_orders").insert({
      approval_id: o.approvalId, proposed_order_id: o.proposedOrderId, instrument_id: o.instrumentId, mode: o.mode, broker: o.broker,
      client_order_id: o.clientOrderId, intent: o.intent, structure: o.structure, side: o.side, qty: o.qty, order_type: o.orderType,
      limit_price: o.limitPrice ?? null, legs: o.legs ?? null, stop_price: o.stopPrice, target_price: o.targetPrice ?? null,
    }).select("id").single(), "insertOrder").id);
  }

  async updateOrder(id: string, p: { status: OrderStatus; brokerOrderId?: string; filledQty?: number; avgFillPrice?: number; error?: string }): Promise<void> {
    const { error } = await this.admin.from("desk_orders").update({
      status: p.status, broker_order_id: p.brokerOrderId ?? null, filled_qty: p.filledQty ?? 0, avg_fill_price: p.avgFillPrice ?? null, error: p.error ?? null,
    }).eq("id", id);
    if (error) throw new Error(`updateOrder: ${error.message}`);
  }

  async openPosition(p: PositionRow): Promise<string> {
    return String(must(await this.admin.from("desk_positions").insert({
      instrument_id: p.instrumentId, thesis_id: p.thesisId ?? null, agent_name: p.agentName ?? null, mode: p.mode, structure: p.structure,
      legs: p.legs ?? null, qty: p.qty, avg_price: p.avgPrice, stop_price: p.stopPrice, target_price: p.targetPrice ?? null,
      max_loss: Math.round(p.maxLoss * 100) / 100, exposure: Math.round(p.exposure * 100) / 100, opened_order_id: p.openedOrderId,
      ...(p.positionGroup ? { position_group: p.positionGroup } : {}),
    }).select("id").single(), "openPosition").id);
  }

  async markPosition(id: string, price: number): Promise<void> {
    const { error } = await this.admin.from("desk_positions").update({ mark_price: price, marked_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(`markPosition: ${error.message}`);
  }

  async closePosition(id: string, price: number, closedOrderId: string): Promise<void> {
    const p = must(await this.admin.from("desk_positions").select("avg_price, qty").eq("id", id).single(), "closePosition lookup") as Row;
    const { error } = await this.admin.from("desk_positions").update({
      status: "closed", closed_at: new Date().toISOString(), close_price: price, closed_order_id: closedOrderId,
      realized_pnl: Math.round((price - num(p.avg_price)) * num(p.qty) * 100) / 100,
    }).eq("id", id);
    if (error) throw new Error(`closePosition: ${error.message}`);
  }

  async listPendingProposals(): Promise<StoredProposal[]> {
    const { data, error } = await this.admin.from("desk_proposed_orders").select(PROPOSAL_COLS).eq("status", "pending").limit(500);
    if (error) throw new Error(`listPendingProposals: ${error.message}`);
    return (data ?? []).map((r) => toProposal(r as Row));
  }

  async logRisk(e: { type: string; proposedOrderId?: string; actor: string; details?: unknown }): Promise<void> {
    const { error } = await this.admin.from("desk_risk_events").insert({ event_type: e.type, proposed_order_id: e.proposedOrderId ?? null, actor: e.actor, details: e.details ?? {} });
    if (error) throw new Error(`logRisk: ${error.message}`);
  }

  async listTheses(): Promise<StoredThesis[]> {
    const { data, error } = await this.admin.from("desk_theses")
      .select("id, instrument_id, signal_ids, agent_name, direction, bull_case, bear_case, catalysts, entry_price, stop_price, target_price, confidence, invalidation, horizon_days, created_at, desk_instruments(symbol)")
      .order("created_at", { ascending: false }).limit(1000);
    if (error) throw new Error(`listTheses: ${error.message}`);
    return (data ?? []).map((raw) => {
      const r = raw as Row;
      return {
        id: String(r.id), instrumentId: String(r.instrument_id), symbol: symbolOf(r), signalIds: (r.signal_ids as string[]) ?? [], agentName: String(r.agent_name),
        direction: r.direction as "long" | "short", bullCase: String(r.bull_case), bearCase: String(r.bear_case), catalysts: (r.catalysts as Thesis["catalysts"]) ?? [],
        entryPrice: num(r.entry_price), stopPrice: num(r.stop_price), targetPrice: num(r.target_price), confidence: num(r.confidence),
        invalidation: String(r.invalidation), horizonDays: num(r.horizon_days), createdAt: String(r.created_at),
      };
    });
  }

  async listSignals(): Promise<StoredSignal[]> {
    const { data, error } = await this.admin.from("desk_signals").select(SIGNAL_COLS).order("created_at", { ascending: false }).limit(2000);
    if (error) throw new Error(`listSignals: ${error.message}`);
    return (data ?? []).map((r) => toSignal(r as Row));
  }

  async listScoredKeys(): Promise<Set<string>> {
    const { data, error } = await this.admin.from("desk_scorecard").select("subject_kind, subject_id, horizon_days").limit(20000);
    if (error) throw new Error(`listScoredKeys: ${error.message}`);
    return new Set((data ?? []).map((r: Row) => `${r.subject_kind}:${r.subject_id}:${r.horizon_days}`));
  }

  async insertScores(rows: ScoreDbRow[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.admin.from("desk_scorecard").upsert(
      rows.map((r) => ({
        subject_kind: r.subjectKind, subject_id: r.subjectId, agent_name: r.agent, horizon_days: r.horizonDays, t0_date: r.t0Date, t0_price: r.t0Price,
        tn_date: r.tnDate, tn_price: r.tnPrice, return_pct: r.returnPct, benchmark_return_pct: r.benchmarkReturnPct, alpha_pct: r.alphaPct,
        target_hit: r.targetHit, stop_hit: r.stopHit, first_touch: r.firstTouch,
      })),
      { onConflict: "subject_kind,subject_id,horizon_days", ignoreDuplicates: true },
    );
    if (error) throw new Error(`insertScores: ${error.message}`);
  }

  async listScores(): Promise<ScoreDbRow[]> {
    const { data, error } = await this.admin.from("desk_scorecard")
      .select("subject_kind, subject_id, agent_name, horizon_days, t0_date, t0_price, tn_date, tn_price, return_pct, benchmark_return_pct, alpha_pct, target_hit, stop_hit, first_touch")
      .limit(20000);
    if (error) throw new Error(`listScores: ${error.message}`);
    return (data ?? []).map((raw) => {
      const r = raw as Row;
      return {
        itemId: String(r.subject_id), kind: r.subject_kind === "trade" ? "trade" : "signal", agent: String(r.agent_name), symbol: "", horizonDays: num(r.horizon_days) as 1 | 5 | 20,
        scoredOn: String(r.tn_date), returnPct: num(r.return_pct), benchmarkReturnPct: num(r.benchmark_return_pct), alphaPct: num(r.alpha_pct),
        subjectKind: r.subject_kind as ScoreDbRow["subjectKind"], subjectId: String(r.subject_id), t0Date: String(r.t0_date), t0Price: num(r.t0_price),
        tnDate: String(r.tn_date), tnPrice: num(r.tn_price), targetHit: Boolean(r.target_hit), stopHit: Boolean(r.stop_hit), firstTouch: r.first_touch as "target" | "stop" | "none",
      };
    });
  }
}
