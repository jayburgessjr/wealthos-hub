// Mode resolution and broker construction. IMPORT BOUNDARY: desk-approve-order only (builds a trade-capable broker).
import { AlpacaBroker } from "./alpaca.ts";
import { PaperBroker, type PaperStore } from "./paper.ts";
import type { BrokerPort } from "./port.ts";
import type { TradingMode } from "../types.ts";

export { resolveMode, type ModeEnv } from "../mode.ts";

export interface BrokerDeps {
  paperStore: PaperStore;
  quote: (symbol: string) => Promise<number | null>;
  alpaca?: { keyId: string; secret: string };
  /** "alpaca" routes paper-mode orders to Alpaca's paper endpoint; default is the internal PaperBroker. */
  paperVenue?: "internal" | "alpaca";
}

/**
 * Phase 0 executes on the internal PaperBroker only. Alpaca fills asynchronously. A reconciler now exists
 * (desk-reconcile-orders, scheduled per RUNBOOK) and approve never marks a proposal executed without a fill, but Alpaca
 * execution stays OFF by default: it is enabled only by setting ALPACA_EXECUTION_ENABLED=true, a deliberate owner action.
 */
export function makeBroker(mode: TradingMode, deps: BrokerDeps & { alpacaExecutionEnabled?: boolean }): BrokerPort {
  const wantsAlpaca = mode === "live" || deps.paperVenue === "alpaca";
  if (wantsAlpaca) {
    if (!deps.alpacaExecutionEnabled) throw new Error("Alpaca execution is disabled in phase 0 (ALPACA_EXECUTION_ENABLED is not true).");
    if (!deps.alpaca) throw new Error("Alpaca execution requires credentials.");
    return new AlpacaBroker({ ...deps.alpaca, mode });
  }
  return new PaperBroker(deps.paperStore, deps.quote);
}
