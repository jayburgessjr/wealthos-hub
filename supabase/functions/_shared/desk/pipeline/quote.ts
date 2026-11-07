// Quote freshness. Phase 0 prices off the latest DAILY bar, so "fresh" means the bar is recent enough that the
// price is still meaningful, not real time. Pure: the clock is passed in. Anything unknown or malformed is stale.
import { etDate } from "./time.ts";

export interface Quote {
  price: number;
  /** Bar date, YYYY-MM-DD. */
  asOf: string;
}

/** Calendar days a daily bar may lag the current New York date: 4 covers a long weekend for stocks, 2 for 24/7 crypto. */
export const MAX_QUOTE_AGE_DAYS = { stock: 4, crypto: 2 } as const;

export interface QuoteAssessment {
  fresh: boolean;
  ageDays: number | null;
  message: string;
}

export function assessQuote(q: Quote | null | undefined, structure: string, now: Date): QuoteAssessment {
  if (!q || !Number.isFinite(q.price) || q.price <= 0) return { fresh: false, ageDays: null, message: "No usable quote." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.asOf ?? "")) return { fresh: false, ageDays: null, message: "Quote has no valid date, so its age is unknown." };
  const age = Math.round((Date.parse(`${etDate(now)}T00:00:00Z`) - Date.parse(`${q.asOf}T00:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(age) || age < 0) return { fresh: false, ageDays: null, message: "Quote date is in the future or invalid." };
  const max = structure === "crypto" ? MAX_QUOTE_AGE_DAYS.crypto : MAX_QUOTE_AGE_DAYS.stock;
  return age > max
    ? { fresh: false, ageDays: age, message: `Quote is from ${q.asOf} (${age} days old, limit ${max}).` }
    : { fresh: true, ageDays: age, message: `Quote from ${q.asOf}.` };
}
