import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const ACCENT_TEXT = "text-primary";
export const ACCENT_BG = "bg-primary text-primary-foreground hover:bg-primary/90";
export const MICRO = "text-[10px] font-medium uppercase tracking-wider text-muted-foreground";
export const NUM = "font-mono tabular-nums";
export const FIELD = "h-7 rounded-sm border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/70";
export const GHOST_BTN = "h-7 rounded-sm border border-border bg-transparent px-2 text-xs text-foreground/80 hover:bg-muted hover:text-foreground";

interface PanelProps {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, aside, className, children }: PanelProps) {
  return (
    <section aria-label={title} className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card", className)}>
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <h2 className={MICRO}>{title}</h2>
        {aside}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

interface PanelStateProps {
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  isEmpty: boolean;
  empty: string;
  children: ReactNode;
}

/** Loading, error and empty handling shared by every panel. */
export function PanelState({ isLoading, error, onRetry, isEmpty, empty, children }: PanelStateProps) {
  if (isLoading) {
    return (
      <p role="status" className="px-3 py-4 text-muted-foreground">
        Loading...
      </p>
    );
  }
  if (error) {
    return (
      <div role="alert" className="px-3 py-4 text-foreground/80">
        <p>Could not load this panel: {error.message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={cn(GHOST_BTN, "mt-2")}>
            Retry
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) return <p className="px-3 py-4 text-muted-foreground">{empty}</p>;
  return <>{children}</>;
}
