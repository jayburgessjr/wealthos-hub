import { ReactNode } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";

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
  const toneClasses = {
    default: "bg-card border-border",
    success:
      "border-[hsl(var(--status-safe))] bg-[hsl(var(--status-safe)/0.06)]",
    warning:
      "border-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.06)]",
    danger:
      "border-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger)/0.06)]",
    info: "border-[hsl(var(--chart-2))] bg-[hsl(var(--chart-2)/0.06)]",
  } as const;

  return (
    <Card className={toneClasses[tone] + " border-2"}>
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        {icon}
        <CardDescription className="text-xs md:text-sm">
          {title}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CardTitle className="text-lg md:text-3xl font-mono">{value}</CardTitle>
        {description && (
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
