import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { LadderResult } from "@/lib/wealthLadder";
import type { EarnTrack } from "@/lib/earnTrack";
import { EarnTrackRow } from "@/components/coach/EarnTrackRow";

export function WealthLadder({ result, earn }: { result: LadderResult; earn?: EarnTrack }) {
  const pct = Math.round(result.progress * 100);
  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="ladder-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ladder-heading" className="font-display text-base font-bold">
          Your wealth ladder
        </h2>
        <p className="text-xs text-muted-foreground" data-testid="ladder-stage">
          Step {result.stageIndex + 1} of {result.stages.length}: {result.stage.title}
        </p>
      </div>

      <div className="mt-3">
        <div
          className="h-2 w-full rounded-full bg-muted"
          role="progressbar"
          aria-label={`Progress on ${result.stage.title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{pct}% of this step</p>
      </div>

      <ol className="mt-4 space-y-2">
        {result.stages.map((s) => (
          <li
            key={s.id}
            className={`flex items-start gap-2 text-sm ${s.current ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            aria-current={s.current ? "step" : undefined}
          >
            {s.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : s.current ? (
              <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {s.title}
              <span className="ml-2 text-xs font-normal">
                {s.done ? "(done)" : s.current ? "(you are here)" : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {earn && <EarnTrackRow earn={earn} />}
    </section>
  );
}
