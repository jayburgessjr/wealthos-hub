import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  to: string;
}

export function StarterChecklist({ items }: { items: ChecklistItem[] }) {
  const doneCount = items.filter((i) => i.done).length;
  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="checklist-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="checklist-heading" className="font-display text-base font-bold">
          Getting started
        </h2>
        <p className="text-xs text-muted-foreground">
          {doneCount} of {items.length} done
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.id}>
            <Link
              to={i.to}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              {i.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className={i.done ? "text-muted-foreground line-through" : ""}>{i.label}</span>
              <span className="sr-only">{i.done ? "(done)" : "(not done yet)"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
