import type { Numeric } from "./types";

export const toNum = (v: Numeric | null | undefined): number => {
  if (v === null || v === undefined || v === "") return NaN;
  return typeof v === "number" ? v : Number(v);
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (v: Numeric | null | undefined): string => {
  const n = toNum(v);
  return Number.isFinite(n) ? usd.format(n) : "n/a";
};

export const price = (v: Numeric | null | undefined): string => {
  const n = toNum(v);
  return Number.isFinite(n) ? plain.format(n) : "n/a";
};

export const signedMoney = (v: Numeric | null | undefined): string => {
  const n = toNum(v);
  if (!Number.isFinite(n)) return "n/a";
  return `${n > 0 ? "+" : ""}${usd.format(n)}`;
};

/** Takes a fraction (0.015) and returns "1.50%". */
export const pct = (fraction: number | null | undefined, dp = 2): string =>
  typeof fraction === "number" && Number.isFinite(fraction) ? `${(fraction * 100).toFixed(dp)}%` : "n/a";

export const signedPct = (fraction: number | null | undefined, dp = 2): string =>
  typeof fraction === "number" && Number.isFinite(fraction) ? `${fraction > 0 ? "+" : ""}${(fraction * 100).toFixed(dp)}%` : "n/a";

export const qtyText = (v: Numeric | null | undefined): string => {
  const n = toNum(v);
  return Number.isFinite(n) ? String(n) : "n/a";
};

export const shortTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const pnlClass = (n: number | null | undefined): string =>
  typeof n !== "number" || !Number.isFinite(n) || n === 0 ? "text-muted-foreground" : n > 0 ? "text-bullish" : "text-bearish";

export const isSafeUrl = (url: string): boolean => /^https?:\/\//i.test(url);

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
