import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { sortActions, useResolveProposal, useToggleAction } from "@/hooks/useCoachPlan";
import type { StrategyActionRow } from "@/lib/coachTypes";
import { ProposalBanner } from "./ProposalBanner";

export function ActionList({ actions }: { actions: StrategyActionRow[] }) {
  const toggle = useToggleAction();
  const resolve = useResolveProposal();
  const sorted = sortActions(actions);
  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">No actions yet. The coach adds them when your plan is ready.</p>;
  return (
    <ul className="space-y-2" data-testid="action-list">
      {sorted.map((a) => (
        <li key={a.id} className="rounded-lg border border-border bg-card p-3" data-testid="action-row">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={a.status === "done"}
              onCheckedChange={(v) => toggle.mutate({ id: a.id, done: v === true })}
              aria-label={`Mark done: ${a.title}`}
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className={`text-sm font-medium ${a.status === "done" ? "text-muted-foreground line-through" : ""}`}>{a.title}</p>
              {a.detail && <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="outline">Priority {a.priority}</Badge>
                {a.track !== "general" && <Badge variant="secondary">{a.track === "earn" ? "Earn more" : a.track}</Badge>}
                {a.edited_by_user && <Badge variant="secondary">Edited</Badge>}
                {a.due_hint && <span className="text-xs text-muted-foreground">{a.due_hint}</span>}
              </div>
              {a.pending_ai_proposal && (
                <ProposalBanner
                  preview={a.pending_ai_proposal.title}
                  busy={resolve.isPending}
                  onAccept={() => resolve.mutate({ kind: "action", id: a.id, accept: true })}
                  onDismiss={() => resolve.mutate({ kind: "action", id: a.id, accept: false })}
                />
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
