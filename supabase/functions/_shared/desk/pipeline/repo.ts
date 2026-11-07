// Persistence port for the Desk pipeline. Two views of it exist on purpose:
//  - AgentRepo: what scanner/research agents get. It has NO order, approval or position methods, so an
//    agent cannot place an order through it even in principle.
//  - DeskRepo: the full port used by approve/mark/scorecard flows.
// Implementations: SupabaseRepo (edge functions) and InMemoryRepo (tests, seeded end-to-end run).
import type { OpenPositionSnapshot } from "../risk/engine.ts";
import type { ScoreRow } from "../scorecard.ts";
import type { AssetClass, ProposedOrder, Signal, Structure, Thesis, TradingMode } from "../types.ts";

export interface DeskState {
  halted: boolean;
  haltedReason: string | null;
  highWaterMark: number;
  dayStartEquity: number;
  dayStartDate: string | null;
  lastEquity: number;
}

export type ProposalStatus = "pending" | "approved" | "rejected" | "expired" | "executed" | "failed";

export interface StoredProposal {
  id: string;
  order: ProposedOrder;
  status: ProposalStatus;
  expiresAt: string;
  createdAt: string;
}

export interface StoredSignal extends Signal {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  createdAt: string;
}

export interface StoredThesis extends Thesis {
  id: string;
  symbol: string;
  createdAt: string;
}

export interface ApprovalRow {
  proposedOrderId: string;
  decision: "approved" | "rejected";
  riskPassed: boolean;
  riskDecision: unknown;
  riskInputHash: string;
  mode: TradingMode;
  liveConfirmed: boolean;
  liveConfirmation?: string;
  decidedBy: string;
}

export interface StoredApproval {
  id: string;
  proposedOrderId: string;
  decision: "approved" | "rejected";
  riskPassed: boolean;
  riskDecision: unknown;
  mode: TradingMode;
  consumed: boolean;
  /** ISO timestamp, server set. */
  decidedAt: string;
}

export interface StoredOrder {
  id: string;
  approvalId: string;
  proposedOrderId: string;
  clientOrderId: string;
  broker: "paper" | "alpaca" | "ibkr";
  status: OrderStatus;
  createdAt: string;
}

export interface OrderRow {
  approvalId: string;
  proposedOrderId: string;
  instrumentId: string;
  mode: TradingMode;
  broker: "paper" | "alpaca" | "ibkr";
  clientOrderId: string;
  intent: "open" | "close";
  structure: Structure;
  side: "buy" | "sell";
  qty: number;
  orderType: "market" | "limit";
  limitPrice?: number;
  stopPrice: number;
  targetPrice?: number;
  legs?: unknown;
}

export type OrderStatus = "submitting" | "submitted" | "partially_filled" | "filled" | "canceled" | "rejected" | "failed";

export interface PositionRow {
  instrumentId: string;
  symbol: string;
  thesisId?: string;
  agentName?: string;
  mode: TradingMode;
  structure: Structure;
  legs?: unknown;
  qty: number;
  avgPrice: number;
  stopPrice: number;
  targetPrice?: number;
  maxLoss: number;
  exposure: number;
  openedOrderId: string;
  positionGroup?: string;
}

export interface StoredPosition extends PositionRow {
  id: string;
  positionGroup: string;
  markPrice: number | null;
  status: "open" | "closed";
  openedAt: string;
}

export type SubjectKind = "signal" | "thesis" | "trade";

/** returnPct, benchmarkReturnPct and alphaPct are FRACTIONS (0.05 = 5%). */
export interface ScoreDbRow extends ScoreRow {
  subjectKind: SubjectKind;
  subjectId: string;
  t0Date: string;
  t0Price: number;
  tnDate: string;
  tnPrice: number;
  targetHit: boolean;
  stopHit: boolean;
  firstTouch: "target" | "stop" | "none";
}

export interface RunPatch {
  status: "ok" | "error" | "skipped";
  summary?: string;
  error?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentRepo {
  upsertInstrument(i: { symbol: string; assetClass: AssetClass; name?: string }): Promise<string>;
  listWatchlist(): Promise<string[]>;
  /** Returns null when this (agent, key) already ran: runs are idempotent. */
  startRun(agent: string, key: string, trigger: "cron" | "manual"): Promise<string | null>;
  finishRun(id: string, p: RunPatch): Promise<void>;
  /** Returns null when the dedupe key already exists. */
  insertSignal(s: Omit<Signal, "id"> & { dedupeKey: string }): Promise<string | null>;
  getSignal(id: string): Promise<StoredSignal | null>;
  insertThesis(t: Thesis, runId?: string): Promise<string>;
  /** Writes a proposal with status pending. Nothing here can approve or execute it. */
  insertProposal(o: ProposedOrder, runId?: string): Promise<string>;
}

export interface DeskRepo extends AgentRepo {
  getProposal(id: string): Promise<StoredProposal | null>;
  setProposalStatus(id: string, status: ProposalStatus): Promise<void>;
  getState(): Promise<DeskState>;
  patchState(p: Partial<DeskState>): Promise<void>;
  listOpenPositions(): Promise<StoredPosition[]>;
  toSnapshots(positions: StoredPosition[]): OpenPositionSnapshot[];
  insertApproval(a: ApprovalRow): Promise<string>;
  insertOrder(o: OrderRow): Promise<string>;
  /** The approval for a proposal (one decision per proposal), or null. Used to recover a proposal stuck in approved. */
  getApprovalForProposal(proposedOrderId: string): Promise<StoredApproval | null>;
  /** Orders that have not reached a terminal state (submitting, submitted, partially_filled), oldest first. */
  listUnsettledOrders(): Promise<StoredOrder[]>;
  /** True when a position row already references this order (opened or closed by it). Makes settlement idempotent. */
  orderHasPosition(orderId: string): Promise<boolean>;
  updateOrder(id: string, p: { status: OrderStatus; brokerOrderId?: string; filledQty?: number; avgFillPrice?: number; error?: string }): Promise<void>;
  openPosition(p: PositionRow): Promise<string>;
  markPosition(id: string, price: number): Promise<void>;
  closePosition(id: string, price: number, closedOrderId: string): Promise<void>;
  listPendingProposals(): Promise<StoredProposal[]>;
  listAllPositions(): Promise<StoredPosition[]>;
  logRisk(e: { type: string; proposedOrderId?: string; actor: string; details?: unknown }): Promise<void>;
  listTheses(): Promise<StoredThesis[]>;
  listScoredKeys(): Promise<Set<string>>;
  insertScores(rows: ScoreDbRow[]): Promise<void>;
  listScores(): Promise<ScoreDbRow[]>;
  listSignals(): Promise<StoredSignal[]>;
}

export type AgentOnly = AgentRepo;

/** A facade exposing only the agent methods. Agent code receives this, never the full repository. */
export function asAgentRepo(r: AgentRepo): AgentRepo {
  return {
    upsertInstrument: r.upsertInstrument.bind(r),
    listWatchlist: r.listWatchlist.bind(r),
    startRun: r.startRun.bind(r),
    finishRun: r.finishRun.bind(r),
    insertSignal: r.insertSignal.bind(r),
    getSignal: r.getSignal.bind(r),
    insertThesis: r.insertThesis.bind(r),
    insertProposal: r.insertProposal.bind(r),
  };
}
