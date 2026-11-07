import { Link } from "react-router-dom";

export interface StrategyBlockData {
  /** Top live item of the section, or null when there is none. */
  topItem: { title: string; body: string } | null;
  openActionCount: number;
}

/** Compact, presentational strategy block for the home panels. Empty state links to the coach. */
export function StrategyBlock({ data }: { data: StrategyBlockData }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3" data-testid="strategy-block">
      <p className="text-xs font-semibold text-muted-foreground">Your strategy</p>
      {data.topItem ? (
        <>
          <p className="mt-0.5 text-sm font-semibold">{data.topItem.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.openActionCount} open {data.openActionCount === 1 ? "action" : "actions"}.{" "}
            <Link to="/invs/strategy" className="text-primary hover:underline">
              See my plan
            </Link>
          </p>
        </>
      ) : (
        <p className="mt-0.5 text-sm text-muted-foreground">
          No plan here yet.{" "}
          <Link to="/invs/strategy" className="font-semibold text-primary hover:underline">
            Start with the coach
          </Link>
        </p>
      )}
    </div>
  );
}
