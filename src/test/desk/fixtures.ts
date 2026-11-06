// Deterministic seeded market for the Desk pipeline tests. No randomness, no network.
import type { Llm, LlmRequest, MarketData } from "../../../supabase/functions/_shared/desk/pipeline/agents.ts";
import type { OhlcBar } from "../../../supabase/functions/_shared/desk/scanners.ts";

export function weekdays(start: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  while (out.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const DATES = weekdays("2026-06-01", 140);
/** Index of the signal day. 25 bars of history follow it so 1, 5 and 20 day horizons can all be scored. */
export const D0 = 95;
export const D_END = 125;

interface SeriesSpec {
  start: number;
  dailyDrift: number;
  /** day index -> gap fraction applied at the open */
  gaps?: Record<number, number>;
  /** from this index on, add this extra daily drift */
  regime?: { from: number; drift: number };
}

function series(spec: SeriesSpec): OhlcBar[] {
  const bars: OhlcBar[] = [];
  let prev = spec.start;
  DATES.forEach((date, i) => {
    const wiggle = 1 + 0.004 * Math.sin(i * 1.7);
    const gap = spec.gaps?.[i] ?? 0;
    const drift = spec.dailyDrift + (spec.regime && i >= spec.regime.from ? spec.regime.drift : 0);
    const open = prev * (1 + gap);
    const close = open * (1 + drift) * wiggle;
    bars.push({ date, open, high: Math.max(open, close) * 1.004, low: Math.min(open, close) * 0.996, close, volume: 1_000_000 });
    prev = close;
  });
  return bars;
}

export const SERIES: Record<string, OhlcBar[]> = {
  SPY: series({ start: 450, dailyDrift: 0.0004 }),
  // AAPL gaps down 8% on D0, then recovers about 1% a day: a clean mean-reversion winner.
  AAPL: series({ start: 200, dailyDrift: 0.0005, gaps: { [D0]: -0.08 }, regime: { from: D0 + 1, drift: 0.011 } }),
  // MSFT is quiet. It must produce no gap signal.
  MSFT: series({ start: 420, dailyDrift: 0.0006 }),
  XLE: series({ start: 90, dailyDrift: 0.0003 }),
};

/** Market data as of a given day index: bars() never returns the future. */
export class FakeMarket implements MarketData {
  asOf = D0;
  async bars(symbol: string, days: number): Promise<OhlcBar[]> {
    const s = SERIES[symbol];
    if (!s) throw new Error(`no fixture for ${symbol}`);
    return s.slice(Math.max(0, this.asOf + 1 - days), this.asOf + 1);
  }
  async ipos() {
    return [];
  }
  async filings() {
    return [];
  }
  price(symbol: string): number {
    return SERIES[symbol][this.asOf].close;
  }
}

/** A stand-in analyst that returns a well-formed long thesis around the supplied reference price. */
export class FakeLlm implements Llm {
  calls: LlmRequest[] = [];
  constructor(private override?: (ref: number) => Record<string, unknown>) {}
  async generate(req: LlmRequest) {
    this.calls.push(req);
    const ref = Number(/Reference price \(server quote\): ([0-9]+(?:\.[0-9]+)?)/.exec(req.user)?.[1]);
    const output = this.override
      ? this.override(ref)
      : {
          direction: "long",
          bull_case: "Oversold gap with no change to the earnings outlook. Mean reversion toward the 20-day average.",
          bear_case: "The gap reflects a real guidance cut and the drawdown continues.",
          catalysts: [{ event: "Next earnings call", date: "2026-11-20" }],
          entry: ref,
          stop: +(ref * 0.96).toFixed(2),
          target: +(ref * 1.1).toFixed(2),
          confidence: 0.7,
          invalidation: "A close below the gap-day low on rising volume.",
          horizon_days: 20,
        };
    return { output, model: "fake-analyst", inputTokens: 100, outputTokens: 50 };
  }
}
