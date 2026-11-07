// Client-side advisory risk preview. The server recomputes everything with a server-side quote; this never authorizes anything.
import { evaluateRisk, type OpenPositionSnapshot, type RiskDecision } from "../../../supabase/functions/_shared/desk/risk/engine.ts";
import { analyseOption, isOptionStructure } from "../../../supabase/functions/_shared/desk/risk/options.ts";
import type { ProposedOrder } from "../../../supabase/functions/_shared/desk/types.ts";
import { toNum } from "./format";
import type { DeskAccount, InstrumentRow, PositionRow, ProposedOrderRow } from "./types";

export interface Draft {
  qty: string;
  limit: string;
  stop: string;
  target: string;
}

const text = (v: ProposedOrderRow["qty"] | null): string => (v === null || v === undefined ? "" : String(toNum(v)));

export const draftFrom = (p: ProposedOrderRow): Draft => ({
  qty: text(p.qty),
  limit: text(p.limit_price),
  stop: text(p.stop_price),
  target: text(p.target_price),
});

const optNum = (s: string): number | undefined => {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export function buildOrder(p: ProposedOrderRow, symbol: string, draft: Draft = draftFrom(p)): ProposedOrder {
  return {
    id: p.id,
    instrumentId: p.instrument_id,
    symbol,
    agentName: p.agent_name,
    intent: p.intent,
    positionId: p.position_id ?? undefined,
    structure: p.structure,
    side: p.side,
    qty: optNum(draft.qty) ?? 0,
    orderType: p.order_type,
    limitPrice: optNum(draft.limit),
    legs: Array.isArray(p.legs) ? (p.legs as ProposedOrder["legs"]) : undefined,
    stopPrice: optNum(draft.stop) ?? null,
    stopBasis: p.stop_basis,
    targetPrice: optNum(draft.target),
  };
}

export function snapshotPositions(positions: PositionRow[], instruments: Map<string, InstrumentRow>): OpenPositionSnapshot[] {
  return positions
    .filter((p) => p.status === "open")
    .map((p) => {
      const symbol = instruments.get(p.instrument_id)?.symbol ?? "";
      return {
        positionId: p.id,
        positionGroup: p.position_group,
        symbol,
        underlying: symbol,
        structure: p.structure,
        qty: toNum(p.qty),
        exposure: toNum(p.exposure),
        maxLoss: toNum(p.max_loss),
      };
    });
}

/** Advisory only. Options price off their legs; closes only need a positive number because the server prices them off the position mark. */
function previewRefPrice(order: ProposedOrder, account: DeskAccount): number {
  if (order.intent === "close") return account.quotes?.[order.symbol] ?? 1;
  if (isOptionStructure(order.structure)) {
    const a = analyseOption(order.structure, order.legs);
    return a.ok ? Math.abs(a.netPremium) : 0;
  }
  // A stale quote must not size an opening order: price 0 makes the engine fail closed (the server enforces the same).
  if (account.staleQuotes?.includes(order.symbol)) return 0;
  return account.quotes?.[order.symbol] ?? 0;
}

/** Plain-English staleness note for a symbol, or null when the quote is fresh or no age data is available. */
export function staleQuoteNote(account: DeskAccount | undefined, symbol: string): string | null {
  if (!account?.staleQuotes?.includes(symbol)) return null;
  const asOf = account.quoteAsOf?.[symbol];
  return `Quote is stale${asOf ? ` (last daily close ${asOf})` : ""}. Opening orders are refused until it refreshes.`;
}

export function previewRisk(order: ProposedOrder, account: DeskAccount, openPositions: OpenPositionSnapshot[]): RiskDecision {
  return evaluateRisk({
    order,
    refPrice: previewRefPrice(order, account),
    equity: account.account.equity,
    dayStartEquity: account.state.day_start_equity,
    highWaterMark: account.state.high_water_mark,
    halted: account.state.halted,
    openPositions,
  });
}

export const livePhrase = (symbol: string, side: string, qty: number | string): string =>
  `LIVE ${symbol} ${side.toUpperCase()} ${toNum(qty)}`;

export interface BlockerInput {
  decision: RiskDecision | null;
  halted: boolean;
  intent: "open" | "close";
  mode: "paper" | "live";
  typed: string;
  expectedPhrase: string;
  dirty: boolean;
  busy: boolean;
  /** Set when the symbol's quote is stale. Blocks opening orders only. */
  staleQuote?: string | null;
}

/** Plain-English reasons Approve is disabled. Empty means enabled. */
export function approvalBlockers(i: BlockerInput): string[] {
  const out: string[] = [];
  if (i.halted && i.intent === "open") out.push("Kill switch is engaged. Reset it before approving new orders.");
  if (i.staleQuote && i.intent === "open") out.push(i.staleQuote);
  if (!i.decision) out.push("Account data has not loaded, so risk cannot be previewed.");
  else if (!i.decision.approved) out.push(...i.decision.reasons);
  if (i.dirty) out.push("Save or discard your edits first.");
  if (i.mode === "live" && i.typed !== i.expectedPhrase) out.push(`Type ${i.expectedPhrase} exactly to confirm live trading.`);
  if (i.busy) out.push("A decision is already in flight.");
  return out;
}
