// Defined-risk test and payoff maths for option structures.
import { RISK_LIMITS } from "./limits.ts";
import type { OptionLeg, Structure } from "../types.ts";

export const OPTION_STRUCTURES: readonly Structure[] = ["long_call", "long_put", "debit_spread", "credit_spread", "iron_condor", "iron_butterfly"];
export const CREDIT_STRUCTURES: readonly Structure[] = ["credit_spread", "iron_condor", "iron_butterfly"];

export function isOptionStructure(s: Structure): boolean {
  return OPTION_STRUCTURES.includes(s);
}

export interface DefinedRisk {
  ok: boolean;
  reason?: string;
  /** dollars per contract, finite when ok */
  maxLossPerContract: number;
  /** net premium per share: positive = debit paid, negative = credit received */
  netPremium: number;
}

export function analyseOption(structure: Structure, legs: OptionLeg[] | undefined): DefinedRisk {
  const fail = (reason: string): DefinedRisk => ({ ok: false, reason, maxLossPerContract: Number.POSITIVE_INFINITY, netPremium: NaN });
  if (!OPTION_STRUCTURES.includes(structure)) return fail(`structure "${structure}" is not an allowed option structure`);
  if (!legs || legs.length === 0) return fail("option order has no legs");
  for (const l of legs) {
    if (!Number.isFinite(l.strike) || l.strike <= 0 || !Number.isFinite(l.price) || l.price < 0) return fail("leg strike or price is invalid");
    if (!Number.isInteger(l.ratio) || l.ratio <= 0) return fail("leg ratios must be positive integers");
    if (l.right !== "call" && l.right !== "put") return fail("leg right is invalid");
    if (l.action !== "buy" && l.action !== "sell") return fail("leg action is invalid");
  }
  if (new Set(legs.map((l) => l.expiry)).size !== 1) return fail("legs must share one expiry (calendars are not allowed)");

  const qty = (right: OptionLeg["right"], action: OptionLeg["action"]) =>
    legs.filter((l) => l.right === right && l.action === action).reduce((s, l) => s + l.ratio, 0);
  if (qty("call", "buy") < qty("call", "sell")) return fail("naked short call exposure");
  if (qty("put", "buy") < qty("put", "sell")) return fail("naked short put exposure");

  const payoff = (S: number) =>
    legs.reduce((sum, l) => {
      const intrinsic = l.right === "call" ? Math.max(S - l.strike, 0) : Math.max(l.strike - S, 0);
      return sum + (l.action === "buy" ? 1 : -1) * l.ratio * (intrinsic - l.price);
    }, 0);
  const strikes = legs.map((l) => l.strike);
  const points = [0, ...strikes, 2 * Math.max(...strikes)];
  const worst = Math.min(...points.map(payoff));
  const maxLossPerContract = Math.max(0, -worst) * RISK_LIMITS.OPTION_MULTIPLIER;
  if (!Number.isFinite(maxLossPerContract) || maxLossPerContract <= 0) return fail("could not establish a finite positive max loss");
  const netPremium = legs.reduce((s, l) => s + (l.action === "buy" ? 1 : -1) * l.ratio * l.price, 0);
  return { ok: true, maxLossPerContract, netPremium };
}
