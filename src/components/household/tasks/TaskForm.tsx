import { useState } from "react";
import { Task } from "@/integrations/supabase/household-types";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  useCreateTaskMutation,
  useUpdateTaskMutation,
} from "@/hooks/useHouseholdBudgetData";
import { useDemoMode } from "@/hooks/useHouseholdDemoMode";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

interface TaskFormProps {
  task?: Task;
  onSuccess?: () => void;
}

export function TaskForm({ task, onSuccess }: TaskFormProps) {
  const { budget, householdId, addTaskLocal, updateTaskLocal } =
    useHouseholdBudget();
  const { demoMode } = useDemoMode();
  const { user } = useAuth();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<"todo" | "in_progress" | "done">(
    task?.status ?? "todo",
  );
  const [priority, setPriority] = useState<"low" | "medium" | "high">(
    task?.priority ?? "medium",
  );
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? "");
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [newTag, setNewTag] = useState("");

  const createTask = useCreateTaskMutation(householdId, user?.id ?? null);
  const updateTask = useUpdateTaskMutation(householdId);

  // Build a list of household members from tasks and expenses
  const memberMap = new Map<string, string>();
  budget.tasks.forEach((t) => {
    if (t.createdBy && t.createdByName)
      memberMap.set(t.createdBy, t.createdByName);
    if (t.assignedTo && t.assignedToName)
      memberMap.set(t.assignedTo, t.assignedToName);
  });
  budget.expenses.forEach((e) => {
    if (e.userId && e.userName) memberMap.set(e.userId, e.userName);
  });
  const householdMembers = Array.from(memberMap.entries()).map(
    ([id, name]) => ({ id, name }),
  );

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      status: status as any,
      priority: priority as any,
      dueDate: dueDate || undefined,
      assignedTo: assignedTo || undefined,
      tags,
    };

    try {
      if (task) {
        if (demoMode || !householdId) {
          updateTaskLocal(task.id, input);
          toast.success("Task updated (demo)");
        } else {
          await updateTask.mutateAsync({ id: task.id, updates: input });
          toast.success("Task updated");
        }
      } else {
        if (demoMode || !householdId) {
          addTaskLocal(input);
          toast.success("Task created (demo)");
        } else {
          await createTask.mutateAsync(input);
          toast.success("Task created");
        }
      }

      onSuccess?.();

      if (!task) {
        setTitle("");
        setDescription("");
        setStatus("todo");
        setPriority("medium");
        setDueDate("");
        setAssignedTo("");
        setTags([]);
      }
    } catch (error) {
      console.error("Failed to save task:", error);
      toast.error("Failed to save task");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title" className="font-mono text-xs uppercase">
          Title *
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="font-mono text-xs uppercase">
          Description
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add more details..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status" className="font-mono text-xs uppercase">
            Status
          </Label>
          <Select
            value={status}
            onValueChange={(v) =>
              setStatus(v as "todo" | "in_progress" | "done")
            }
          >
            <SelectTrigger className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo" className="font-mono">
                To Do
              </SelectItem>
              <SelectItem value="in_progress" className="font-mono">
                In Progress
              </SelectItem>
              <SelectItem value="done" className="font-mono">
                Done
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority" className="font-mono text-xs uppercase">
            Priority
          </Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as "low" | "medium" | "high")}
          >
            <SelectTrigger className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low" className="font-mono">
                Low
              </SelectItem>
              <SelectItem value="medium" className="font-mono">
                Medium
              </SelectItem>
              <SelectItem value="high" className="font-mono">
                High
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dueDate" className="font-mono text-xs uppercase">
            Due Date
          </Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignedTo" className="font-mono text-xs uppercase">
            Assign To
          </Label>
          <Select
            value={assignedTo || "unassigned"}
            onValueChange={(v) => setAssignedTo(v === "unassigned" ? "" : v)}
          >
            <SelectTrigger className="font-mono">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned" className="font-mono">
                Unassigned
              </SelectItem>
              {householdMembers.map((member) => (
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
      </div>

      <div className="space-y-2">
        <Label className="font-mono text-xs uppercase">Tags</Label>
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add a tag..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={handleAddTag}>
            Add
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:bg-destructive/20 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" className="w-full font-mono">
        {task ? "UPDATE TASK" : "CREATE TASK"}
      </Button>
    </form>
  );
}
