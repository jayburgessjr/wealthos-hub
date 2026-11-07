// Option position marking. Pure with injected data. An option position is marked by its current NET premium per share
// (absolute value), the same unit the stored premium stop uses. A stop breach only ever becomes a close PROPOSAL.
import { CREDIT_STRUCTURES } from "../risk/options.ts";
import type { OptionLeg, Structure } from "../types.ts";
import { assessQuote } from "./quote.ts";

/** OCC option ticker in Polygon form, e.g. O:AAPL261218C00200000. Returns null for malformed legs. */
export function occTicker(underlying: string, leg: Pick<OptionLeg, "right" | "strike" | "expiry">): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(leg.expiry ?? "");
  if (!m || !/^[A-Z.]{1,6}$/.test(underlying) || !(leg.strike > 0) || (leg.right !== "call" && leg.right !== "put")) return null;
  return `O:${underlying}${m[1].slice(2)}${m[2]}${m[3]}${leg.right === "call" ? "C" : "P"}${String(Math.round(leg.strike * 1000)).padStart(8, "0")}`;
}

/** True when the premium stop is breached: debit structures at or below the stop, credit structures at or above it. */
export function optionStopBreached(structure: Structure, stopPrice: number, currentNet: number): boolean {
  if (!(Number.isFinite(stopPrice) && stopPrice > 0 && Number.isFinite(currentNet) && currentNet >= 0)) return false;
  return CREDIT_STRUCTURES.includes(structure) ? currentNet >= stopPrice : currentNet <= stopPrice;
}

export interface OptionBar { date: string; close: number }

/**
 * Current absolute net premium per share for a position, from each leg's latest daily bar.
 * Null when any leg has no fresh, positive price: an unmarked option is reported, never guessed.
 */
export async function optionNetPremium(
  underlying: string, legs: OptionLeg[] | undefined, bars: (ticker: string) => Promise<OptionBar[]>, now: Date,
): Promise<number | null> {
  if (!legs || legs.length === 0) return null;
  let net = 0;
  for (const leg of legs) {
    const t = occTicker(underlying, leg);
    if (!t) return null;
    const last = (await bars(t)).at(-1);
    if (!last || !assessQuote({ price: last.close, asOf: last.date }, "stock", now).fresh) return null;
    net += (leg.action === "buy" ? 1 : -1) * leg.ratio * last.close;
  }
  return Math.abs(net);
}
