import { cn } from "@/lib/utils";
import { BudgetStatus } from "@/integrations/supabase/household-types";

interface StatusIndicatorProps {
  status: BudgetStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const statusConfig = {
  safe: {
    label: "ON TRACK",
    bgClass: "bg-[hsl(var(--status-safe))]",
    textClass: "text-[hsl(var(--status-safe-foreground))]",
  },
  warning: {
    label: "APPROACHING LIMIT",
    bgClass: "bg-[hsl(var(--status-warning))]",
    textClass: "text-[hsl(var(--status-warning-foreground))]",
  },
  danger: {
    label: "OVERSPENDING",
    bgClass: "bg-[hsl(var(--status-danger))]",
    textClass: "text-[hsl(var(--status-danger-foreground))]",
  },
};

export function StatusIndicator({
  status,
  size = "md",
  showLabel = true,
}: StatusIndicatorProps) {
  const config = statusConfig[status];

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  }[size];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 font-mono font-bold border-2 border-border",
        config.bgClass,
        config.textClass,
        sizeClasses,
      )}
    >
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}
