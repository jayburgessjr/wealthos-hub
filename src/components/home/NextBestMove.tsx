import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { NextMove } from "@/lib/wealthLadder";

export function NextBestMove({ move }: { move: NextMove }) {
  return (
    <section
      className="rounded-xl border border-primary/30 bg-card p-4"
      aria-labelledby="next-move-heading"
      data-testid="next-best-move"
    >
      <p id="next-move-heading" className="text-xs font-semibold text-primary">
        Your next best move
      </p>
      <h2 className="mt-1 font-display text-lg font-bold">{move.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Why: </span>
        {move.why}
      </p>
      <Link
        to={move.to}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {move.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <p className="mt-3 text-xs text-muted-foreground">
        General education, not personal financial advice. Investments can lose value.
      </p>
    </section>
  );
}
