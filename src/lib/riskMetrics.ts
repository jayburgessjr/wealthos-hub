// Ported from alfa-class (alfa/engine/metrics.py). Inputs are daily simple
// returns; annualization uses sqrt(252) trading days per year, matching the
// source engine's convention.

const TRADING_DAYS = 252;
const RISK_FREE_ANNUAL = 0.043;

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  const m = mean(xs);
  const variance = xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function quantile(sortedAsc: number[], q: number): number {
  const n = sortedAsc.length;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

export function sharpe(dailyReturns: number[], riskFreeAnnual: number = RISK_FREE_ANNUAL): number | null {
  if (dailyReturns.length < 20) return null;
  const rfDaily = riskFreeAnnual / TRADING_DAYS;
  const excess = dailyReturns.map((r) => r - rfDaily);
  const std = stdev(dailyReturns);
  if (std < 1e-12) return null;
  return (mean(excess) / std) * Math.sqrt(TRADING_DAYS);
}

export function maxDrawdown(dailyReturns: number[]): number {
  let equity = 1;
  let peak = 1;
  let worstDd = 0;
  for (const r of dailyReturns) {
    equity *= 1 + r;
    peak = Math.max(peak, equity);
    worstDd = Math.min(worstDd, (equity - peak) / peak);
  }
  return worstDd;
}

export function calmar(dailyReturns: number[]): number | null {
  const dd = maxDrawdown(dailyReturns);
  if (dd >= 0) return null;
  const annReturn = mean(dailyReturns) * TRADING_DAYS;
  return annReturn / Math.abs(dd);
}

export function maxDrawdownFromEquity(equityCurve: number[]): number {
  let peak = equityCurve[0] ?? 0;
  let worstDd = 0;
  for (const val of equityCurve) {
    if (val > peak) peak = val;
    const dd = peak > 0 ? (val - peak) / peak : 0;
    if (dd < worstDd) worstDd = dd;
  }
  return worstDd;
}

export function var95(dailyReturns: number[]): number {
  const sorted = [...dailyReturns].sort((a, b) => a - b);
  return -quantile(sorted, 0.05);
}
