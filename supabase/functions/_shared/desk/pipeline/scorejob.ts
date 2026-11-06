// Scorecard job: scores directional signals, theses and executed trades at 1, 5 and 20 trading days
// against SPY. Idempotent and immutable: a (kind, id, horizon) row is written once, only after the horizon is reached.
import { HORIZONS, closeAfter, type Bar, type Horizon } from "../scorecard.ts";
import type { OhlcBar } from "../scanners.ts";
import type { DeskRepo, ScoreDbRow, SubjectKind } from "./repo.ts";
import type { MarketData } from "./agents.ts";
import { etDate } from "./time.ts";

interface Subject {
  kind: SubjectKind;
  id: string;
  agent: string;
  symbol: string;
  direction: "long" | "short";
  /** ET date the idea was created / the trade filled */
  refDate: string;
  /** When set (trades), the fill price is the reference; otherwise the t0 close is. */
  refPrice?: number;
  stop?: number | null;
  target?: number | null;
}

function firstTouch(bars: OhlcBar[], from: number, to: number, dir: "long" | "short", stop?: number | null, target?: number | null) {
  let targetHit = false, stopHit = false, first: "target" | "stop" | "none" = "none";
  for (let i = from; i <= to && i < bars.length; i++) {
    const b = bars[i];
    const t = target != null && (dir === "long" ? b.high >= target : b.low <= target);
    const s = stop != null && (dir === "long" ? b.low <= stop : b.high >= stop);
    if (t) targetHit = true;
    if (s) stopHit = true;
    if (first === "none" && (t || s)) first = s ? "stop" : "target"; // same-day touch of both counts as the stop (conservative)
  }
  return { targetHit, stopHit, first };
}

export async function runScorecard(d: { repo: DeskRepo; market: MarketData; now: Date }): Promise<{ scored: number; subjects: number }> {
  const [signals, theses, positions, done] = await Promise.all([d.repo.listSignals(), d.repo.listTheses(), d.repo.listAllPositions(), d.repo.listScoredKeys()]);

  const subjects: Subject[] = [];
  for (const s of signals) if (s.direction !== "neutral") subjects.push({ kind: "signal", id: s.id, agent: s.agentName, symbol: s.symbol, direction: s.direction, refDate: etDate(new Date(s.createdAt)) });
  for (const t of theses) subjects.push({ kind: "thesis", id: t.id, agent: t.agentName, symbol: t.symbol, direction: t.direction, refDate: etDate(new Date(t.createdAt)), stop: t.stopPrice, target: t.targetPrice });
  for (const p of positions.filter((x) => x.structure === "stock" || x.structure === "crypto")) subjects.push({ kind: "trade", id: p.id, agent: p.agentName ?? "system", symbol: p.symbol, direction: "long", refDate: etDate(new Date(p.openedAt)), refPrice: p.avgPrice, stop: p.stopPrice, target: p.targetPrice ?? null });

  const pendingFor = (s: Subject) => HORIZONS.filter((h) => !done.has(`${s.kind}:${s.id}:${h}`));
  const todo = subjects.filter((s) => pendingFor(s).length > 0);
  if (todo.length === 0) return { scored: 0, subjects: subjects.length };

  const barCache = new Map<string, OhlcBar[]>();
  const barsFor = async (sym: string) => {
    if (!barCache.has(sym)) barCache.set(sym, await d.market.bars(sym, 140));
    return barCache.get(sym)!;
  };
  const spy = await barsFor("SPY");

  const out: ScoreDbRow[] = [];
  for (const s of todo) {
    let bars: OhlcBar[];
    try { bars = await barsFor(s.symbol); } catch { continue; }
    const t0i = bars.findIndex((b) => b.date >= s.refDate);
    const spy0i = spy.findIndex((b) => b.date >= s.refDate);
    if (t0i < 0 || spy0i < 0) continue;
    const refPrice = s.refPrice ?? bars[t0i].close;
    const sign = s.direction === "long" ? 1 : -1;

    for (const h of pendingFor(s) as Horizon[]) {
      const end = closeAfter(bars as Bar[], s.refDate, h);
      const bEnd = closeAfter(spy as Bar[], s.refDate, h);
      if (!end || !bEnd) continue; // horizon not reached: never guessed
      const ret = sign * (end.close / refPrice - 1);
      const bret = sign * (bEnd.close / spy[spy0i].close - 1);
      const tni = bars.findIndex((b) => b.date === end.date);
      const touch = firstTouch(bars, t0i + 1, tni, s.direction, s.stop, s.target);
      out.push({
        itemId: s.id, kind: s.kind === "trade" ? "trade" : "signal", agent: s.agent, symbol: s.symbol, horizonDays: h, scoredOn: end.date,
        returnPct: ret, benchmarkReturnPct: bret, alphaPct: ret - bret,
        subjectKind: s.kind, subjectId: s.id, t0Date: bars[t0i].date, t0Price: refPrice, tnDate: end.date, tnPrice: end.close,
        targetHit: touch.targetHit, stopHit: touch.stopHit, firstTouch: touch.first,
      });
    }
  }
  await d.repo.insertScores(out);
  return { scored: out.length, subjects: subjects.length };
}
