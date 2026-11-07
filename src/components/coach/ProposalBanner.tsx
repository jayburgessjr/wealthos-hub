import { Button } from "@/components/ui/button";

interface Props {
  /** Short preview of what the coach suggests. */
  preview?: string;
  onAccept: () => void;
  onDismiss: () => void;
  busy?: boolean;
}

export function ProposalBanner({ preview, onAccept, onDismiss, busy }: Props) {
  return (
    <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs" role="status" data-testid="proposal-banner">
      <p className="font-semibold text-foreground">The coach suggests a change</p>
      {preview && <p className="mt-0.5 text-muted-foreground">{preview}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={onAccept} disabled={busy}>
          Accept
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
