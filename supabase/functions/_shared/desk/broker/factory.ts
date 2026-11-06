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

export function makeBroker(mode: TradingMode, deps: BrokerDeps): BrokerPort {
  if (mode === "live") {
    if (!deps.alpaca) throw new Error("Live mode requires Alpaca credentials.");
    return new AlpacaBroker({ ...deps.alpaca, mode: "live" });
  }
  if (deps.paperVenue === "alpaca" && deps.alpaca) return new AlpacaBroker({ ...deps.alpaca, mode: "paper" });
  return new PaperBroker(deps.paperStore, deps.quote);
}
