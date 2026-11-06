import { useMemo, useState } from "react";
import { HORIZONS, type Stats } from "../../../supabase/functions/_shared/desk/scorecard.ts";
import { useScorecardRows } from "@/lib/desk/hooks";
import { computeScorecard, type SubjectFilter } from "@/lib/desk/scorecard";
import { pct, pnlClass, signedPct } from "@/lib/desk/format";
import { MICRO, NUM, Panel, PanelState } from "./Panel";
import { cn } from "@/lib/utils";

function StatRow({ label, s }: { label: string; s: Stats }) {
  return (
    <tr className="border-t border-white/10">
      <th scope="row" className="px-3 py-1 text-left font-medium text-white">
        {label}
      </th>
      <td className={cn(NUM, "px-2 py-1 text-right text-white/80")}>{s.n}</td>
      <td className={cn(NUM, "px-2 py-1 text-right text-white/80")}>{s.n ? pct(s.hitRate, 1) : "n/a"}</td>
      <td className={cn(NUM, "px-2 py-1 text-right", pnlClass(s.expectancy))}>{s.n ? signedPct(s.expectancy) : "n/a"}</td>
      <td className={cn(NUM, "px-2 py-1 text-right", pnlClass(s.avgAlpha))}>{s.n ? signedPct(s.avgAlpha) : "n/a"}</td>
      <td className={cn(NUM, "px-3 py-1 text-right text-white/80")}>{s.n ? pct(s.maxDrawdown, 1) : "n/a"}</td>
    </tr>
  );
}

function Head({ first }: { first: string }) {
  return (
    <thead className="text-[10px] uppercase text-white/60">
      <tr>
        <th scope="col" className="px-3 py-1 text-left font-medium">{first}</th>
        <th scope="col" className="px-2 py-1 text-right font-medium">N</th>
        <th scope="col" className="px-2 py-1 text-right font-medium">Hit rate</th>
        <th scope="col" className="px-2 py-1 text-right font-medium">Expectancy</th>
        <th scope="col" className="px-2 py-1 text-right font-medium">Avg alpha</th>
        <th scope="col" className="px-3 py-1 text-right font-medium">Max DD</th>
      </tr>
    </thead>
  );
}

export function ScorecardView({ stats }: { stats: ReturnType<typeof computeScorecard> }) {
  const agents = Object.entries(stats.agents);
  return (
    <div>
      <dl className="grid grid-cols-2 gap-px border-b border-white/10 bg-white/10 md:grid-cols-4">
        {[
          ["Hit rate", pct(stats.overall.hitRate, 1)],
          ["Expectancy", signedPct(stats.overall.expectancy)],
          ["Max drawdown", pct(stats.overall.maxDrawdown, 1)],
          ["Scored ideas", String(stats.overall.n)],
        ].map(([k, v]) => (
          <div key={k} className="bg-[hsl(240,6%,10%)] px-3 py-1.5">
            <dt className={MICRO}>{k}</dt>
            <dd className={cn(NUM, "text-sm text-white")}>{v}</dd>
          </div>
        ))}
      </dl>
      <table className="w-full">
        <caption className="sr-only">Scorecard by horizon</caption>
        <Head first="Horizon" />
        <tbody>
          {HORIZONS.map((h) => (
            <StatRow key={h} label={`${h} day${h > 1 ? "s" : ""}`} s={stats.horizons[h]} />
          ))}
        </tbody>
      </table>
      <table className="mt-2 w-full">
        <caption className="sr-only">Scorecard by agent</caption>
        <Head first="Agent" />
        <tbody>
          {agents.map(([name, s]) => (
            <StatRow key={name} label={name} s={s} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Scorecard() {
  const rows = useScorecardRows();
  const [subject, setSubject] = useState<SubjectFilter>("all");
  const stats = useMemo(() => computeScorecard(rows.data ?? [], subject), [rows.data, subject]);
  return (
    <Panel
      title="Scorecard"
      aside={
        <select
          aria-label="Scorecard subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value as SubjectFilter)}
          className="h-6 rounded-sm border border-white/10 bg-[hsl(240,6%,7%)] px-1 text-xs text-white"
        >
          <option value="all">All</option>
          <option value="signal">Signals</option>
          <option value="thesis">Theses</option>
          <option value="trade">Trades</option>
        </select>
      }
    >
      <PanelState
        isLoading={rows.isLoading}
        error={rows.error as Error | null}
        onRetry={() => rows.refetch()}
        isEmpty={stats.overall.n === 0}
        empty="Agent ideas are scored against SPY at 1, 5 and 20 trading days after each thesis is published."
      >
        <ScorecardView stats={stats} />
      </PanelState>
    </Panel>
  );
}
