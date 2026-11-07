// Trading mode resolution. Kept apart from broker/factory.ts so read-only code can resolve the mode
// without importing anything that can build a trade-capable broker.
import type { TradingMode } from "./types.ts";

export interface ModeEnv {
  TRADING_MODE?: string;
  LIVE_TRADING_ENABLED?: string;
}

/** Live only when BOTH flags are exactly set. Anything else (unset, typo, partial) is paper. */
export function resolveMode(env: ModeEnv): TradingMode {
  return env.TRADING_MODE === "live" && env.LIVE_TRADING_ENABLED === "true" ? "live" : "paper";
}
