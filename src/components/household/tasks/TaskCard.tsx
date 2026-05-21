import { Task } from "@/integrations/supabase/household-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  User,
  Tag,
  Pencil,
  Trash2,
  GripVertical,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskForm } from "./TaskForm";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useDeleteTaskMutation } from "@/hooks/useHouseholdBudgetData";
import { useDemoMode } from "@/hooks/useHouseholdDemoMode";
import { toast } from "sonner";

// Generate a consistent color for a given assignee ID
const ASSIGNEE_COLORS = [
  "border-l-blue-500",
  "border-l-green-500",
  "border-l-purple-500",
  "border-l-orange-500",
  "border-l-pink-500",
  "border-l-cyan-500",
  "border-l-yellow-500",
  "border-l-red-500",
];

export function getAssigneeColor(
  assigneeId: string | null | undefined,
  assigneeMap?: Map<string, number>,
): string {
  if (!assigneeId) return "border-l-muted-foreground/30";
  if (assigneeMap && assigneeMap.has(assigneeId)) {
    return ASSIGNEE_COLORS[
      assigneeMap.get(assigneeId)! % ASSIGNEE_COLORS.length
    ];
  }
  // Fallback: hash the ID to get consistent color
  let hash = 0;
  for (let i = 0; i < assigneeId.length; i++) {
    hash = assigneeId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ASSIGNEE_COLORS[Math.abs(hash) % ASSIGNEE_COLORS.length];
}

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  assigneeColorMap?: Map<string, number>;
  showAssigneeHighlight?: boolean;
}

export function TaskCard({
  task,
  isDragging = false,
  assigneeColorMap,
  showAssigneeHighlight = false,
}: TaskCardProps) {
  const { householdId, deleteTaskLocal } = useHouseholdBudget();
  const { demoMode } = useDemoMode();
  const deleteTask = useDeleteTaskMutation(householdId);
  const [editOpen, setEditOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const priorityColors = {
    low: "bg-blue-100 text-blue-800 border-blue-300",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
    high: "bg-red-100 text-red-800 border-red-300",
  };

  const isOverdue =
    task.dueDate &&
    isPast(new Date(task.dueDate)) &&
    !isToday(new Date(task.dueDate));
  const isDueToday = task.dueDate && isToday(new Date(task.dueDate));

  const handleDelete = () => {
    if (!confirm("Delete this task?")) return;
    if (demoMode || !householdId) {
      deleteTaskLocal(task.id);
      toast.success("Task deleted (demo)");
    } else {
      deleteTask.mutate(task.id, {
        onSuccess: () => toast.success("Task deleted"),
        onError: () => toast.error("Failed to delete task"),
      });
    }
  };

  const assigneeColor = showAssigneeHighlight
    ? getAssigneeColor(task.assignedTo, assigneeColorMap)
    : "";

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative p-3 border-2 border-border bg-background hover:shadow-md transition-shadow",
          isDragging && "opacity-50 shadow-lg",
          showAssigneeHighlight && `border-l-4 ${assigneeColor}`,
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="absolute left-1 top-1 cursor-grab active:cursor-grabbing text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="pl-4">
          <h4 className="font-medium mb-2 pr-16">{task.title}</h4>

          {task.description && (
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="space-y-1.5">
            <Badge
              variant="outline"
              className={cn("text-xs font-mono", priorityColors[task.priority])}
            >
              {task.priority.toUpperCase()}
            </Badge>

            {task.dueDate && (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  isOverdue && "text-red-600 font-semibold",
                  isDueToday && "text-orange-600 font-semibold",
                )}
              >
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(task.dueDate), "MMM d, yyyy")}</span>
                {isOverdue && <span className="font-bold">(OVERDUE)</span>}
                {isDueToday && <span className="font-bold">(TODAY)</span>}
              </div>
            )}

            {task.assignedToName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span>{task.assignedToName}</span>
              </div>
            )}

            {task.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-3 h-3 text-muted-foreground" />
                {task.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs px-1.5 py-0"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold">Edit Task</DialogTitle>
          </DialogHeader>
          <TaskForm task={task} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
