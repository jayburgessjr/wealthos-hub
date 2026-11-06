import { attributeByAgent, byHorizon, summarize, type ScoreRow } from "../../../supabase/functions/_shared/desk/scorecard.ts";
import { toNum } from "./format";
import type { ScorecardRow } from "./types";

/** desk_scorecard stores fractions (0.05 means 5%), the same unit as ScoreRow, so values map straight across. */
export function toScoreRows(rows: ScorecardRow[]): ScoreRow[] {
  const out: ScoreRow[] = [];
  for (const r of rows) {
    const h = r.horizon_days;
    if (h !== 1 && h !== 5 && h !== 20) continue;
    const ret = toNum(r.return_pct);
    const bench = toNum(r.benchmark_return_pct);
    const alpha = toNum(r.alpha_pct);
    if (![ret, bench, alpha].every(Number.isFinite)) continue;
    out.push({
      itemId: r.subject_id,
      kind: r.subject_kind === "trade" ? "trade" : "signal",
      agent: r.agent_name,
      symbol: "",
      horizonDays: h,
      scoredOn: r.tn_date,
      returnPct: ret,
      benchmarkReturnPct: bench,
      alphaPct: alpha,
    });
  }
  return out;
}

export type SubjectFilter = "all" | ScorecardRow["subject_kind"];

export function computeScorecard(rows: ScorecardRow[], subject: SubjectFilter = "all") {
  const scored = toScoreRows(subject === "all" ? rows : rows.filter((r) => r.subject_kind === subject));
  return { overall: summarize(scored), horizons: byHorizon(scored), agents: attributeByAgent(scored) };
}
