import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useArchiveItem, useResolveProposal, useUpdateItem } from "@/hooks/useCoachPlan";
import type { StrategyItemRow } from "@/lib/coachTypes";
import { ProposalBanner } from "./ProposalBanner";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function PlanItemCard({ item }: { item: StrategyItemRow }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const update = useUpdateItem();
  const archive = useArchiveItem();
  const resolve = useResolveProposal();

  const gain = typeof item.metrics?.monthly_gain_estimate === "number" ? item.metrics.monthly_gain_estimate : null;
  const effort = typeof item.metrics?.effort === "string" ? item.metrics.effort : null;
  const first = typeof item.metrics?.time_to_first_dollar === "string" ? item.metrics.time_to_first_dollar : null;

  return (
    <article className="rounded-lg border border-border bg-card p-3" data-testid="plan-item">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} aria-label="Title" className="h-8 flex-1" />
        ) : (
          <h3 className="flex-1 text-sm font-semibold">{item.title}</h3>
        )}
        {item.source === "ai" && !item.edited_by_user && <Badge variant="outline">AI draft</Badge>}
        {item.edited_by_user && <Badge variant="secondary">Edited</Badge>}
      </div>

      {editing ? (
        <Textarea value={body} maxLength={1200} onChange={(e) => setBody(e.target.value)} aria-label="Details" className="mt-2" />
      ) : (
        item.body && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
      )}

      {item.section === "income" && (gain !== null || effort || first) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {gain !== null && <>About {money(gain)} a month (illustrative, not a promise). </>}
          {effort && <>Effort: {effort}. </>}
          {first && <>First dollar: {first}.</>}
        </p>
      )}

      {item.pending_ai_proposal && (
        <ProposalBanner
          preview={item.pending_ai_proposal.title}
          busy={resolve.isPending}
          onAccept={() => resolve.mutate({ kind: "item", id: item.id, accept: true })}
          onDismiss={() => resolve.mutate({ kind: "item", id: item.id, accept: false })}
        />
      )}

      <div className="mt-2 flex gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={!title.trim() || update.isPending}
              onClick={() => update.mutate({ id: item.id, patch: { title: title.trim(), body } }, { onSuccess: () => setEditing(false) })}
            >
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => archive.mutate({ id: item.id, source: item.source })}>
              Remove
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
