// Row shapes for desk_* tables as returned by PostgREST. Numeric columns may arrive as number or string.
import type { RISK_LIMITS } from "../../../supabase/functions/_shared/desk/risk/limits.ts";

export type Numeric = number | string;

export interface InstrumentRow {
  id: string;
  symbol: string;
  asset_class: string;
  name: string | null;
}

export interface SourceLinkRow {
  url: string;
  title?: string;
  published_at?: string;
}

export interface SignalRow {
  id: string;
  instrument_id: string;
  agent_name: string;
  kind: string;
  direction: "long" | "short" | "neutral";
  strength: Numeric;
  summary: string;
  source_links: SourceLinkRow[] | null;
  created_at: string;
}

export interface ThesisRow {
  id: string;
  instrument_id: string;
  agent_name: string;
  direction: "long" | "short";
  bull_case: string;
  bear_case: string;
  catalysts: { event: string; date?: string }[] | null;
  entry_price: Numeric;
  stop_price: Numeric;
  target_price: Numeric;
  confidence: Numeric;
  invalidation: string;
  horizon_days: number;
}

export interface ProposedOrderRow {
  id: string;
  thesis_id: string | null;
  instrument_id: string;
  agent_name: string;
  intent: "open" | "close";
  position_id: string | null;
  structure: "stock" | "crypto" | "long_call" | "long_put" | "debit_spread" | "credit_spread" | "iron_condor" | "iron_butterfly";
  side: "buy" | "sell";
  qty: Numeric;
  order_type: "market" | "limit";
  limit_price: Numeric | null;
  legs: unknown;
  stop_price: Numeric | null;
  stop_basis: "price" | "underlying" | "premium";
  target_price: Numeric | null;
  max_loss: Numeric | null;
  rationale: string | null;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface PositionRow {
  id: string;
  position_group: string;
  instrument_id: string;
  agent_name: string | null;
  mode: "paper" | "live";
  structure: ProposedOrderRow["structure"];
  legs: unknown;
  qty: Numeric;
  avg_price: Numeric;
  stop_price: Numeric;
  target_price: Numeric | null;
  max_loss: Numeric;
  exposure: Numeric;
  mark_price: Numeric | null;
  status: "open" | "closed";
  opened_at: string;
}

export interface JournalRow {
  id: string;
  author: string;
  entry_type: string;
  body: string;
  tags: string[] | null;
  created_at: string;
}

export interface ScorecardRow {
  id: string;
  subject_kind: "signal" | "thesis" | "trade";
  subject_id: string;
  agent_name: string;
  horizon_days: number;
  tn_date: string;
  /** Stored as fractions (0.05 means 5%). */
  return_pct: Numeric;
  benchmark_return_pct: Numeric;
  alpha_pct: Numeric;
}

export interface DeskAccount {
  ok: boolean;
  error?: string;
  mode: "paper" | "live";
  broker: string;
  account: { equity: number; cash: number; buyingPower: number; asOf: string };
  positions: { symbol: string; qty: number; avgPrice: number; marketValue: number }[];
  state: {
    halted: boolean;
    halted_reason: string | null;
    halted_at: string | null;
    high_water_mark: number;
    day_start_equity: number;
    last_equity: number;
  };
  quotes: Record<string, number>;
  /** Bar date (YYYY-MM-DD) of each quote. Quotes are the latest daily close, not real time. */
  quoteAsOf?: Record<string, string>;
  /** Symbols whose quote is too old to price an opening order. */
  staleQuotes?: string[];
  limits: typeof RISK_LIMITS;
}
