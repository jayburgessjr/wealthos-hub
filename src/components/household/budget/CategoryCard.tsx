import { Category } from "@/integrations/supabase/household-types";
import { ProgressBar } from "./ProgressBar";
import { cn } from "@/lib/utils";

interface CategoryCardProps {
  category: Category;
  onClick?: () => void;
}

const typeColors = {
  fixed: "border-l-[hsl(var(--category-fixed))]",
  variable: "border-l-[hsl(var(--category-variable))]",
  savings: "border-l-[hsl(var(--category-savings))]",
  debt: "border-l-[hsl(var(--category-debt))]",
};

const typeLabels = {
  fixed: "Fixed",
  variable: "Variable",
  savings: "Savings",
  debt: "Debt",
};

export function CategoryCard({ category, onClick }: CategoryCardProps) {
  const remaining = category.monthlyLimit - category.spent;
  const isOverBudget = remaining < 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left border-2 border-border border-l-4 p-4 bg-card transition-all",
        "hover:shadow-sm hover:translate-x-0.5 hover:-translate-y-0.5",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        typeColors[category.type],
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{category.icon}</span>
          <div>
            <h3 className="font-bold text-sm">{category.name}</h3>
            <span className="text-xs font-mono text-muted-foreground uppercase">
              {typeLabels[category.type]}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "font-mono font-bold text-sm",
              isOverBudget
                ? "text-[hsl(var(--status-danger))]"
                : "text-foreground",
            )}
          >
            ${Math.abs(remaining).toFixed(0)}
            {isOverBudget ? " over" : " left"}
          </p>
        </div>
      </div>

      <ProgressBar
        value={category.spent}
        max={category.monthlyLimit}
        size="sm"
      />

      <div className="flex justify-between mt-2 text-xs font-mono text-muted-foreground">
        <span>${category.spent.toFixed(0)} spent</span>
        <span>${category.monthlyLimit.toFixed(0)} limit</span>
      </div>
    </button>
  );
}
