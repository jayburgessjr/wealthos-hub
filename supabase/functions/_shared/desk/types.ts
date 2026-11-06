// Shared Desk domain types. Pure TypeScript: no Deno or Node APIs.
export type Direction = "long" | "short";
export type AssetClass = "equity" | "etf" | "index" | "option" | "crypto";
export type Structure =
  | "stock"
  | "crypto"
  | "long_call"
  | "long_put"
  | "debit_spread"
  | "credit_spread"
  | "iron_condor"
  | "iron_butterfly";
export type TradingMode = "paper" | "live";

export interface OptionLeg {
  right: "call" | "put";
  action: "buy" | "sell";
  strike: number;
  expiry: string;
  ratio: number;
  /** premium per share */
  price: number;
}

export interface SourceLink {
  url: string;
  title?: string;
  publishedAt?: string;
}

export interface Signal {
  id?: string;
  instrumentId: string;
  agentName: string;
  kind: string;
  direction: Direction | "neutral";
  strength: number;
  summary: string;
  sourceLinks: SourceLink[];
  raw?: unknown;
  expiresAt?: string;
}

export interface Thesis {
  id?: string;
  instrumentId: string;
  agentName: string;
  signalIds: string[];
  direction: Direction;
  bullCase: string;
  bearCase: string;
  catalysts: { event: string; date?: string }[];
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  sizeRiskPct?: number;
  sizeQty?: number;
  confidence: number;
  invalidation: string;
  horizonDays: number;
}

export interface ProposedOrder {
  id?: string;
  thesisId?: string;
  instrumentId: string;
  /** Tradable symbol; for option structures this is the underlying. */
  symbol: string;
  agentName: string;
  intent: "open" | "close";
  positionId?: string;
  /** Adding to an existing spread/condor keeps it one position. */
  positionGroup?: string;
  structure: Structure;
  side: "buy" | "sell";
  qty: number;
  orderType: "market" | "limit";
  limitPrice?: number;
  legs?: OptionLeg[];
  /** MANDATORY. Null or missing is rejected by the engine and by the database. */
  stopPrice: number | null | undefined;
  stopBasis: "price" | "underlying" | "premium";
  targetPrice?: number;
}
