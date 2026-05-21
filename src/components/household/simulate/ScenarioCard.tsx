import { Scenario } from "@/services/householdAiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, TrendingUp, TrendingDown, DollarSign, Target } from "lucide-react";

interface ScenarioCardProps {
  scenario: Scenario;
  categories: {
    id: string;
    name: string;
    icon: string;
    monthlyLimit: number;
  }[];
  onUpdate: (scenario: Scenario) => void;
  onRemove: () => void;
  result?: {
    newSurplus: number;
    surplusChange: number;
    isStressed: boolean;
  };
}

const SCENARIO_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--status-safe))",
  "hsl(var(--status-warning))",
  "hsl(var(--accent))",
];

export function ScenarioCard({
  scenario,
  categories,
  onUpdate,
  onRemove,
  result,
}: ScenarioCardProps) {
  const getTypeIcon = () => {
    switch (scenario.type) {
      case "income_change":
        return <TrendingUp className="w-4 h-4" />;
      case "expense_change":
      case "new_expense":
        return <TrendingDown className="w-4 h-4" />;
      case "goal_contribution":
        return <Target className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  return (
    <div
      className="border-2 border-border p-4 bg-card relative"
      style={{ borderLeftWidth: "4px", borderLeftColor: scenario.color }}
    >
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-6 w-6 p-0"
        onClick={onRemove}
      >
        <X className="w-4 h-4" />
      </Button>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 border border-border"
            style={{ color: scenario.color }}
          >
            {getTypeIcon()}
          </div>
          <Input
            value={scenario.name}
            onChange={(e) => onUpdate({ ...scenario, name: e.target.value })}
            placeholder="Scenario name"
            className="font-mono text-sm h-8"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase text-muted-foreground">
              Type
            </Label>
            <Select
              value={scenario.type}
              onValueChange={(v) =>
                onUpdate({ ...scenario, type: v as Scenario["type"] })
              }
            >
              <SelectTrigger className="font-mono text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income_change" className="font-mono text-xs">
                  Income ↑↓
                </SelectItem>
                <SelectItem
                  value="expense_change"
                  className="font-mono text-xs"
                >
                  Expense ↑↓
                </SelectItem>
                <SelectItem value="new_expense" className="font-mono text-xs">
                  New Expense
                </SelectItem>
                <SelectItem
                  value="goal_contribution"
                  className="font-mono text-xs"
                >
                  Goal Boost
                </SelectItem>
                <SelectItem value="one_time" className="font-mono text-xs">
                  One-time
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase text-muted-foreground">
              Amount
            </Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                value={scenario.amount}
                onChange={(e) =>
                  onUpdate({
                    ...scenario,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                className="pl-5 font-mono text-xs h-8"
              />
            </div>
          </div>
        </div>

        {(scenario.type === "expense_change" ||
          scenario.type === "new_expense") && (
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase text-muted-foreground">
              Category
            </Label>
            <Select
              value={scenario.categoryId || ""}
              onValueChange={(v) => {
                const cat = categories.find((c) => c.id === v);
                onUpdate({
                  ...scenario,
                  categoryId: v,
                  categoryName: cat?.name,
                });
              }}
            >
              <SelectTrigger className="font-mono text-xs h-8">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem
                    key={cat.id}
                    value={cat.id}
                    className="font-mono text-xs"
                  >
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center justify-between py-2 px-3 border border-border bg-secondary">
          <span className="font-mono text-[10px] uppercase">
            Recurring Monthly
          </span>
          <Switch
            checked={scenario.isRecurring}
            onCheckedChange={(checked) =>
              onUpdate({ ...scenario, isRecurring: checked })
            }
          />
        </div>

        {result && (
          <div
            className={`p-3 border-2 ${result.isStressed ? "border-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger)/0.1)]" : "border-border"}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                New Surplus
              </span>
              <span
                className={`font-mono font-bold ${result.newSurplus >= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
              >
                ${result.newSurplus.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                Change
              </span>
              <span
                className={`font-mono text-sm ${result.surplusChange >= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
              >
                {result.surplusChange >= 0 ? "+" : ""}
                {result.surplusChange.toLocaleString()}/mo
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
