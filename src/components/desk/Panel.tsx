import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const ORANGE_TEXT = "text-[hsl(20,82%,51%)]";
export const ORANGE_BG = "bg-[hsl(20,82%,51%)] text-[hsl(240,6%,10%)] hover:bg-[hsl(20,82%,45%)]";
export const MICRO = "text-[10px] font-medium uppercase tracking-wider text-white/60";
export const NUM = "font-mono tabular-nums";
export const FIELD = "h-7 rounded-sm border border-white/10 bg-[hsl(240,6%,7%)] px-2 text-xs text-white placeholder:text-white/40";
export const GHOST_BTN = "h-7 rounded-sm border border-white/10 bg-transparent px-2 text-xs text-white/80 hover:bg-white/10 hover:text-white";

interface PanelProps {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, aside, className, children }: PanelProps) {
  return (
    <section aria-label={title} className={cn("flex min-h-0 flex-col border border-white/10 bg-[hsl(240,6%,10%)]", className)}>
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
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
      <p role="status" className="px-3 py-4 text-white/60">
        Loading...
      </p>
    );
  }
  if (error) {
    return (
      <div role="alert" className="px-3 py-4 text-white/80">
        <p>Could not load this panel: {error.message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={cn(GHOST_BTN, "mt-2")}>
            Retry
          </button>
        )}
      </div>
    );
  }
  if (isEmpty) return <p className="px-3 py-4 text-white/60">{empty}</p>;
  return <>{children}</>;
}
