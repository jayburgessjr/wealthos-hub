import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

export function StatCard({
  title,
  value,
  description,
  icon,
  tone = "default",
}: StatCardProps) {
  const toneAccent = {
    default: "text-foreground",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-red-500",
    info: "text-sky-500",
  } as const;

  const iconAccent = {
    default: "text-muted-foreground",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-red-500",
    info: "text-sky-500",
  } as const;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={`inline-flex h-3.5 w-3.5 items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5 ${iconAccent[tone]}`}
          >
            {icon}
          </span>
        )}
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <div
          className={`font-display text-[22px] font-extrabold leading-none ${toneAccent[tone]}`}
        >
          {value}
        </div>
        {description && (
          <div className="text-xs text-muted-foreground">{description}</div>
        )}
      </div>
    </div>
  );
}
