import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddJournal, useJournal } from "@/lib/desk/hooks";
import { shortTime } from "@/lib/desk/format";
import { MICRO, ORANGE_BG, Panel, PanelState } from "./Panel";
import { cn } from "@/lib/utils";

export function Journal() {
  const journal = useJournal();
  const add = useAddJournal();
  const [body, setBody] = useState("");

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    add.mutate(text, {
      onSuccess: () => {
        setBody("");
        toast.success("Note added");
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Panel title="Journal">
      <div className="border-b border-white/10 px-3 py-2">
        <label htmlFor="desk-journal-note" className={MICRO}>
          New note
        </label>
        <Textarea
          id="desk-journal-note"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="mt-1 border-white/10 bg-[hsl(240,6%,7%)] text-xs text-white placeholder:text-white/40"
          placeholder="What did you decide, and why?"
        />
        <div className="mt-1 flex justify-end">
          <Button type="button" onClick={submit} disabled={add.isPending || body.trim() === ""} className={cn("h-7 rounded-sm px-3 text-xs", ORANGE_BG)}>
            Add note
          </Button>
        </div>
      </div>
      <PanelState
        isLoading={journal.isLoading}
        error={journal.error as Error | null}
        onRetry={() => journal.refetch()}
        isEmpty={(journal.data ?? []).length === 0}
        empty="Your notes and agent post-mortems appear here."
      >
        <ul>
          {(journal.data ?? []).map((j) => (
            <li key={j.id} className="border-t border-white/10 px-3 py-1.5 first:border-t-0">
              <div className="flex gap-2 text-[10px] text-white/60">
                <span className="uppercase">{j.entry_type}</span>
                <span>{j.author}</span>
                <span className="ml-auto">{shortTime(j.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-white/85">{j.body}</p>
            </li>
          ))}
        </ul>
      </PanelState>
    </Panel>
  );
}
