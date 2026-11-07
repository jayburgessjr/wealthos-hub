import { Link } from "react-router-dom";
import type { EarnTrack } from "@/lib/earnTrack";

export function EarnTrackRow({ earn }: { earn: EarnTrack }) {
  return (
    <div className="mt-4 border-t border-border pt-3" data-testid="earn-track" data-state={earn.state}>
      <p className="text-xs font-semibold text-muted-foreground">Earn more</p>
      {earn.state === "no_plan" ? (
        <Link to="/invs/strategy" className="mt-1 inline-block text-sm font-semibold text-primary hover:underline">
          {earn.headline}
        </Link>
      ) : (
        <>
          <p className="mt-1 text-sm font-semibold">{earn.headline}</p>
          {earn.next && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Next: {earn.next.title}. {earn.next.why}
            </p>
          )}
          {earn.monthlyGainDone !== undefined && (
            <p className="mt-0.5 text-xs text-muted-foreground">About ${Math.round(earn.monthlyGainDone)} a month so far (illustrative, not a promise).</p>
          )}
        </>
      )}
    </div>
  );
}
