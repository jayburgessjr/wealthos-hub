// Scorecard maths. Pure: bars in, rows and stats out. Scores signals and approved trades at 1, 5 and 20
// trading days against a benchmark (SPY), then attributes results agent by agent.

export const HORIZONS = [1, 5, 20] as const;
export type Horizon = (typeof HORIZONS)[number];

export interface Bar {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  close: number;
}

export interface ScoredItem {
  /** signal id or approved-trade id */
  id: string;
  kind: "signal" | "trade";
  agent: string;
  symbol: string;
  direction: "long" | "short";
  /** Date the signal fired or the trade was approved. */
  refDate: string;
  /** Price at that date (entry for trades, close for signals). */
  refPrice: number;
}

export interface ScoreRow {
  itemId: string;
  kind: "signal" | "trade";
  agent: string;
  symbol: string;
  horizonDays: Horizon;
  scoredOn: string;
  /** Direction-adjusted return of the idea. */
  returnPct: number;
  benchmarkReturnPct: number;
  /** returnPct minus benchmarkReturnPct. */
  alphaPct: number;
}

export interface Stats {
  n: number;
  hitRate: number;
  alphaHitRate: number;
  expectancy: number;
  avgAlpha: number;
  maxDrawdown: number;
}

const EMPTY: Stats = { n: 0, hitRate: 0, alphaHitRate: 0, expectancy: 0, avgAlpha: 0, maxDrawdown: 0 };

/** Close of the Nth trading bar after the first bar on or after refDate. Null if the history has not reached it yet. */
export function closeAfter(bars: Bar[], refDate: string, tradingDays: number): Bar | null {
  const start = bars.findIndex((b) => b.date >= refDate);
  if (start < 0) return null;
  const target = bars[start + tradingDays];
  return target ?? null;
}

export function scoreItem(item: ScoredItem, symbolBars: Bar[], benchBars: Bar[], horizons: readonly Horizon[] = HORIZONS): ScoreRow[] {
  const rows: ScoreRow[] = [];
  if (!(item.refPrice > 0)) return rows;
  const benchStartIdx = benchBars.findIndex((b) => b.date >= item.refDate);
  if (benchStartIdx < 0) return rows;
  const benchRef = benchBars[benchStartIdx].close;
  const sign = item.direction === "long" ? 1 : -1;

  for (const h of horizons) {
    const end = closeAfter(symbolBars, item.refDate, h);
    const benchEnd = closeAfter(benchBars, item.refDate, h);
    if (!end || !benchEnd) continue; // horizon not reached yet: stays unscored, never guessed
    const ret = sign * (end.close / item.refPrice - 1);
    const bret = sign * (benchEnd.close / benchRef - 1);
    rows.push({
      itemId: item.id,
      kind: item.kind,
      agent: item.agent,
      symbol: item.symbol,
      horizonDays: h,
      scoredOn: end.date,
      returnPct: ret,
      benchmarkReturnPct: bret,
      alphaPct: ret - bret,
    });
  }
  return rows;
}

/** Max drawdown of a compounded equity curve built from sequential returns, as a positive fraction. */
export function maxDrawdownOf(returns: number[]): number {
  let equity = 1;
  let peak = 1;
  let worst = 0;
  for (const r of returns) {
    equity *= 1 + r;
    peak = Math.max(peak, equity);
    worst = Math.max(worst, (peak - equity) / peak);
  }
  return worst;
}

export function summarize(rows: ScoreRow[]): Stats {
  if (rows.length === 0) return { ...EMPTY };
  const ordered = [...rows].sort((a, b) => (a.scoredOn < b.scoredOn ? -1 : a.scoredOn > b.scoredOn ? 1 : 0));
  const n = ordered.length;
  const sum = (f: (r: ScoreRow) => number) => ordered.reduce((s, r) => s + f(r), 0);
  return {
    n,
    hitRate: ordered.filter((r) => r.returnPct > 0).length / n,
    alphaHitRate: ordered.filter((r) => r.alphaPct > 0).length / n,
    // Expectancy = average return per idea = winRate x avgWin - lossRate x avgLoss.
    expectancy: sum((r) => r.returnPct) / n,
    avgAlpha: sum((r) => r.alphaPct) / n,
    maxDrawdown: maxDrawdownOf(ordered.map((r) => r.returnPct)),
  };
}

export function byHorizon(rows: ScoreRow[]): Record<Horizon, Stats> {
  const out = {} as Record<Horizon, Stats>;
  for (const h of HORIZONS) out[h] = summarize(rows.filter((r) => r.horizonDays === h));
  return out;
}

export function attributeByAgent(rows: ScoreRow[], horizon?: Horizon): Record<string, Stats> {
  const scoped = horizon ? rows.filter((r) => r.horizonDays === horizon) : rows;
  const agents = [...new Set(scoped.map((r) => r.agent))].sort();
  const out: Record<string, Stats> = {};
  for (const a of agents) out[a] = summarize(scoped.filter((r) => r.agent === a));
  return out;
}
