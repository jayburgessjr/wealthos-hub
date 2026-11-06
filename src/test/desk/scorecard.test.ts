import { describe, expect, it } from "vitest";
import { attributeByAgent, byHorizon, closeAfter, maxDrawdownOf, scoreItem, summarize, type Bar, type ScoredItem } from "../../../supabase/functions/_shared/desk/scorecard.ts";

const days = (start: string, closes: number[]): Bar[] =>
  closes.map((close, i) => ({ date: new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10), close }));

const spy = days("2026-01-01", Array.from({ length: 30 }, (_, i) => 100 + i * 0.1)); // +0.1%/day-ish
const item = (over: Partial<ScoredItem> = {}): ScoredItem => ({
  id: "s1", kind: "signal", agent: "gap-scanner", symbol: "XYZ", direction: "long", refDate: "2026-01-01", refPrice: 100, ...over,
});

describe("scorecard", () => {
  it("finds the Nth bar after the reference date", () => {
    expect(closeAfter(spy, "2026-01-01", 5)?.date).toBe("2026-01-06");
    expect(closeAfter(spy, "2026-01-01", 99)).toBeNull();
    expect(closeAfter(spy, "2030-01-01", 1)).toBeNull();
  });

  it("scores 1, 5 and 20 day horizons against the benchmark", () => {
    const sym = days("2026-01-01", Array.from({ length: 30 }, (_, i) => 100 + i)); // +1%/day
    const rows = scoreItem(item(), sym, spy);
    expect(rows.map((r) => r.horizonDays)).toEqual([1, 5, 20]);
    const r5 = rows.find((r) => r.horizonDays === 5)!;
    expect(r5.returnPct).toBeCloseTo(0.05);
    expect(r5.benchmarkReturnPct).toBeCloseTo(0.005, 3);
    expect(r5.alphaPct).toBeCloseTo(r5.returnPct - r5.benchmarkReturnPct);
  });

  it("does not score a horizon the history has not reached", () => {
    const rows = scoreItem(item(), days("2026-01-01", [100, 101, 102]), spy);
    expect(rows.map((r) => r.horizonDays)).toEqual([1]);
  });

  it("flips sign for shorts", () => {
    const falling = days("2026-01-01", [100, 90, 90, 90, 90, 90, 90]);
    const r1 = scoreItem(item({ direction: "short" }), falling, spy).find((r) => r.horizonDays === 1)!;
    expect(r1.returnPct).toBeCloseTo(0.1);
  });

  it("computes hit rate, expectancy and drawdown", () => {
    expect(maxDrawdownOf([0.1, -0.2, 0.05])).toBeCloseTo(0.2);
    const rows = [0.1, -0.05, 0.02, -0.01].map((ret, i) => ({
      itemId: `i${i}`, kind: "signal" as const, agent: "a", symbol: "X", horizonDays: 5 as const,
      scoredOn: `2026-02-0${i + 1}`, returnPct: ret, benchmarkReturnPct: 0.01, alphaPct: ret - 0.01,
    }));
    const s = summarize(rows);
    expect(s.n).toBe(4);
    expect(s.hitRate).toBe(0.5);
    expect(s.alphaHitRate).toBe(0.5);
    expect(s.expectancy).toBeCloseTo(0.015);
  });

  it("attributes by agent and groups by horizon", () => {
    const mk = (agent: string, ret: number, h: 1 | 5 | 20) => ({
      itemId: agent + ret + h, kind: "signal" as const, agent, symbol: "X", horizonDays: h,
      scoredOn: "2026-02-01", returnPct: ret, benchmarkReturnPct: 0, alphaPct: ret,
    });
    const rows = [mk("a", 0.1, 5), mk("a", -0.1, 5), mk("b", 0.2, 5), mk("b", 0.1, 1)];
    const att = attributeByAgent(rows, 5);
    expect(Object.keys(att)).toEqual(["a", "b"]);
    expect(att.a.hitRate).toBe(0.5);
    expect(att.b.hitRate).toBe(1);
    expect(byHorizon(rows)[1].n).toBe(1);
    expect(summarize([]).n).toBe(0);
  });
});
