import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  tone?: "safe" | "warning" | "danger" | "info" | null;
}

export function ProgressBar({
  value,
  max,
  className,
  showLabel = false,
  size = "md",
  tone = null,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const isOverBudget = value > max;

  const getStatusColor = () => {
    if (tone) {
      if (tone === "safe") return "bg-[hsl(var(--status-safe))]";
      if (tone === "warning") return "bg-[hsl(var(--status-warning))]";
      if (tone === "danger") return "bg-[hsl(var(--status-danger))]";
      if (tone === "info") return "bg-[hsl(var(--chart-2))]";
    }
    if (isOverBudget) return "bg-[hsl(var(--status-danger))]";
    if (percentage >= 90) return "bg-[hsl(var(--status-danger))]";
    if (percentage >= 75) return "bg-[hsl(var(--status-warning))]";
    return "bg-[hsl(var(--status-safe))]";
  };

  const heightClass = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  }[size];

  return (
    <div
      className={cn("w-full", className)}
      role="progressbar"
      aria-valuenow={Number.isFinite(percentage) ? Math.round(percentage) : 0}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "w-full bg-secondary border-2 border-border",
          heightClass,
        )}
      >
        <div
          className={cn(
            "h-full transition-[width] duration-500 ease-out",
            getStatusColor(),
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs font-mono text-muted-foreground">
          <span>${value.toLocaleString()}</span>
          <span>${max.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
