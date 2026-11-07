import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

export function CoachDisclaimer() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3" data-testid="coach-disclaimer">
      <button className="flex w-full items-center gap-2 text-left" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <AlertTriangle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="flex-1 text-xs font-semibold text-foreground">AI coach, not a registered adviser</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Education and planning only.</strong> AJE Coach is an AI tool that helps you think through
            money choices. It is not a registered investment adviser, broker, tax professional or attorney, and nothing here is
            personalized financial, tax or legal advice.
          </p>
          <p>
            <strong className="text-foreground">You decide.</strong> Consider a licensed professional for big decisions such as taxes,
            retirement or large purchases.
          </p>
          <p>
            <strong className="text-foreground">No promises.</strong> Investing involves risk, including losing money. Any numbers shown are
            illustrative estimates, never a promise of returns.
          </p>
        </div>
      )}
    </div>
  );
}
