import { Link } from "react-router-dom";
import { usePlanSummary } from "@/hooks/useCoachPlan";

/** "Your strategy" block for the Wealth dashboard. Reads the plan through the coach hooks (demo: sandbox, no calls). */
export function StrategySection() {
  const s = usePlanSummary();
  const items = s.plan.items;
  const wealth = items.filter((i) => i.section === "wealth").slice(0, 2);
  const gaps = items.filter((i) => i.section === "gap").slice(0, 2);
  const opps = items.filter((i) => i.section === "opportunity").slice(0, 2);
  const income = items.find((i) => i.section === "income");
  const next = s.openActions.slice(0, 3);

  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="your-strategy-heading" data-testid="your-strategy">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="your-strategy-heading" className="font-display text-base font-bold">
          Your strategy
        </h2>
        <Link to="/invs/strategy" className="text-sm font-semibold text-primary hover:underline">
          {s.active ? "Open my plan" : "Start with the coach"}
        </Link>
      </div>
      {!s.active && !items.length ? (
        <p className="mt-2 text-sm text-muted-foreground">You do not have a plan yet. Tell the coach your goal and it will build one with you. It works from $1.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground">Wealth</h3>
            {wealth.length ? wealth.map((i) => <p key={i.id} className="mt-1 text-sm">{i.title}</p>) : <p className="mt-1 text-sm text-muted-foreground">Nothing yet.</p>}
            {income && (
              <>
                <h3 className="mt-3 text-xs font-semibold text-muted-foreground">Earn more idea</h3>
                <p className="mt-1 text-sm">{income.title}</p>
                {typeof income.metrics?.monthly_gain_estimate === "number" && (
                  <p className="text-xs text-muted-foreground">About ${Math.round(income.metrics.monthly_gain_estimate)} a month (illustrative, not a promise)</p>
                )}
              </>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground">Opportunities and gaps</h3>
            {[...opps, ...gaps].length ? [...opps, ...gaps].map((i) => <p key={i.id} className="mt-1 text-sm">{i.title}</p>) : <p className="mt-1 text-sm text-muted-foreground">Nothing yet.</p>}
            <h3 className="mt-3 text-xs font-semibold text-muted-foreground">Next actions</h3>
            {next.length ? (
              <ol className="mt-1 list-decimal pl-4 text-sm">
                {next.map((a) => (
                  <li key={a.id}>{a.title}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Nothing open.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
