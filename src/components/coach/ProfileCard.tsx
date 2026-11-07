import { useResolveProposal } from "@/hooks/useCoachPlan";
import type { StrategyRow } from "@/lib/coachTypes";
import { ProposalBanner } from "./ProposalBanner";

export function ProfileCard({ strategy }: { strategy: StrategyRow }) {
  const resolve = useResolveProposal();
  const rows: [string, string | number | null][] = [
    ["Main goal", strategy.primary_goal],
    ["Time horizon", strategy.time_horizon_years ? `${strategy.time_horizon_years} years` : null],
    ["Comfort with ups and downs", strategy.risk_tolerance],
  ];
  return (
    <section className="rounded-lg border border-border bg-card p-3" aria-label="Your profile">
      <h3 className="text-sm font-semibold">About you</h3>
      <dl className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd>{v ?? "Not set yet"}</dd>
          </div>
        ))}
      </dl>
      {strategy.summary && <p className="mt-2 text-sm text-muted-foreground">{strategy.summary}</p>}
      {strategy.summary_proposal && (
        <ProposalBanner
          preview={strategy.summary_proposal}
          busy={resolve.isPending}
          onAccept={() => resolve.mutate({ kind: "summary", id: strategy.id, accept: true })}
          onDismiss={() => resolve.mutate({ kind: "summary", id: strategy.id, accept: false })}
        />
      )}
    </section>
  );
}
