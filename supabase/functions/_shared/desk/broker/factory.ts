// Mode resolution and broker construction. IMPORT BOUNDARY: desk-approve-order only (builds a trade-capable broker).
import { AlpacaBroker } from "./alpaca.ts";
import { PaperBroker, type PaperStore } from "./paper.ts";
import type { BrokerPort } from "./port.ts";
import type { TradingMode } from "../types.ts";

export interface ModeEnv {
  TRADING_MODE?: string;
  LIVE_TRADING_ENABLED?: string;
}

/** Live only when BOTH flags are exactly set. Anything else (unset, typo, partial) is paper. */
export function resolveMode(env: ModeEnv): TradingMode {
  return env.TRADING_MODE === "live" && env.LIVE_TRADING_ENABLED === "true" ? "live" : "paper";
}

export interface BrokerDeps {
  paperStore: PaperStore;
  quote: (symbol: string) => Promise<number | null>;
  alpaca?: { keyId: string; secret: string };
  /** "alpaca" routes paper-mode orders to Alpaca's paper endpoint; default is the internal PaperBroker. */
  paperVenue?: "internal" | "alpaca";
}

/**
 * Phase 0 executes on the internal PaperBroker only. Alpaca fills asynchronously and there is no order reconciler yet,
 * so routing real or Alpaca-paper orders would leave positions unrecorded. The AlpacaBroker adapter is built, tested and
 * sits behind the same port; set ALPACA_EXECUTION_ENABLED=true only after a reconciliation job exists.
 */
export function makeBroker(mode: TradingMode, deps: BrokerDeps & { alpacaExecutionEnabled?: boolean }): BrokerPort {
  const wantsAlpaca = mode === "live" || deps.paperVenue === "alpaca";
  if (wantsAlpaca) {
    if (!deps.alpacaExecutionEnabled) throw new Error("Alpaca execution is disabled in phase 0 (no order reconciler yet).");
    if (!deps.alpaca) throw new Error("Alpaca execution requires credentials.");
    return new AlpacaBroker({ ...deps.alpaca, mode });
  }
  return new PaperBroker(deps.paperStore, deps.quote);
}
