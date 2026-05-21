import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface TaskFiltersProps {
  assigneeFilter: string;
  onAssigneeChange: (value: string) => void;
  priorityFilter: string;
  onPriorityChange: (value: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  members: { id: string; name: string }[];
  allTags: string[];
}

export function TaskFilters({
  assigneeFilter,
  onAssigneeChange,
  priorityFilter,
  onPriorityChange,
  selectedTags,
  onTagsChange,
  members,
  allTags,
}: TaskFiltersProps) {
  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="border-2 border-border p-4 bg-card space-y-4">
      <h3 className="font-bold text-sm uppercase tracking-wide">Filters</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase">Assignee</Label>
          <Select value={assigneeFilter} onValueChange={onAssigneeChange}>
            <SelectTrigger className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-mono">
                All members
              </SelectItem>
              {members.map((member) => (
                <SelectItem
                  key={member.id}
                  value={member.id}
                  className="font-mono"
                >
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase">Priority</Label>
          <Select value={priorityFilter} onValueChange={onPriorityChange}>
            <SelectTrigger className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-mono">
                All priorities
              </SelectItem>
              <SelectItem value="high" className="font-mono">
                High
              </SelectItem>
              <SelectItem value="medium" className="font-mono">
                Medium
              </SelectItem>
              <SelectItem value="low" className="font-mono">
                Low
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase">Tags</Label>
          {allTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                    {isSelected && <X className="ml-1 h-3 w-3" />}
                  </Badge>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No tags yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
