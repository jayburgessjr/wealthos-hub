import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { VisionItem } from "@/hooks/useHouseholdVisionData";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VisionDrawer({
  open,
  onOpenChange,
  item,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: VisionItem | null;
  onSave: (patch: Partial<VisionItem>) => void;
}) {
  const { budget } = useHouseholdBudget();
  const tagsStr = (item?.tags || []).join(", ");
  if (!item) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[380px] sm:w-[420px] overflow-auto"
      >
        <SheetHeader>
          <SheetTitle>Edit Vision Item</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div>
            <Label className="font-mono text-xs uppercase">Title</Label>
            <Input
              defaultValue={item.title ?? ""}
              onBlur={(e) => onSave({ title: e.target.value })}
            />
          </div>
          <div>
            <Label className="font-mono text-xs uppercase">Note</Label>
            <Textarea
              defaultValue={item.note ?? ""}
              onBlur={(e) => onSave({ note: e.target.value })}
              className="min-h-[80px]"
            />
          </div>
          <div>
            <Label className="font-mono text-xs uppercase">
              Tags (comma separated)
            </Label>
            <Input
              defaultValue={tagsStr}
              onBlur={(e) =>
                onSave({
                  tags: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div>
            <Label className="font-mono text-xs uppercase">Link to Goal</Label>
            <Select
              defaultValue={item.linked_goal_id || ""}
              onValueChange={(v) => onSave({ linked_goal_id: v || null })}
            >
              <SelectTrigger className="font-mono">
                <SelectValue placeholder="Select goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {budget.goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={item.pinned ? "default" : "outline"}
              onClick={() => onSave({ pinned: !item.pinned })}
              className="font-mono text-xs"
            >
              {item.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button
              variant={item.favorite ? "default" : "outline"}
              onClick={() => onSave({ favorite: !item.favorite })}
              className="font-mono text-xs"
            >
              {item.favorite ? "Unfavorite" : "Favorite"}
            </Button>
          </div>
          <div className="mt-2">
            <img
              src={item.url}
              alt="preview"
              className="w-full rounded border"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
