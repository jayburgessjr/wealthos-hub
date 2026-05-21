import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Filter } from "lucide-react";
import { TaskForm } from "@/components/household/tasks/TaskForm";
import { KanbanBoard } from "@/components/household/tasks/KanbanBoard";
import { TaskFilters } from "@/components/household/tasks/TaskFilters";
import { TaskStatus } from "@/integrations/supabase/household-types";
import { toast } from "sonner";
import { useUpdateTaskPositionsMutation } from "@/hooks/useHouseholdBudgetData";

export default function HouseholdTasks() {
  const { budget, householdId } = useHouseholdBudget();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"manual" | "dueDate" | "priority">(
    "dueDate",
  );

  const updatePositions = useUpdateTaskPositionsMutation(householdId);

  const filteredTasks = useMemo(() => {
    const priorityMap = { high: 2, medium: 1, low: 0 };
    let result = budget.tasks.filter((task) => {
      if (filterAssignee !== "all" && task.assignedTo !== filterAssignee)
        return false;
      if (filterPriority !== "all" && task.priority !== filterPriority)
        return false;
      if (
        filterTags.length > 0 &&
        !filterTags.some((tag) => task.tags.includes(tag))
      )
        return false;
      return true;
    });

    if (sortBy === "dueDate") {
      result.sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
      });
    } else if (sortBy === "priority") {
      result.sort((a, b) => {
        const pDiff =
          (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
        if (pDiff !== 0) return pDiff;
        if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        return a.dueDate ? -1 : 1;
      });
    } else {
      result.sort((a, b) => (a.position || 0) - (b.position || 0));
    }

    return result;
  }, [budget.tasks, filterAssignee, filterPriority, filterTags, sortBy]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    budget.tasks.forEach((task) => task.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [budget.tasks]);

  const householdMembers = useMemo(() => {
    const members = new Map<string, string>();
    budget.tasks.forEach((task) => {
      if (task.assignedTo && task.assignedToName) {
        members.set(task.assignedTo, task.assignedToName);
      }
      members.set(task.createdBy, task.createdByName);
    });
    return Array.from(members.entries()).map(([id, name]) => ({ id, name }));
  }, [budget.tasks]);

  const handleTaskMove = async (
    taskId: string,
    newStatus: TaskStatus,
    newPosition: number,
  ) => {
    const tasksInColumn = filteredTasks
      .filter((t) => t.status === newStatus)
      .sort((a, b) => a.position - b.position);

    const updates: { id: string; status: string; position: number }[] = [];
    let currentPosition = 0;

    for (const task of tasksInColumn) {
      if (task.id === taskId) {
        updates.push({ id: taskId, status: newStatus, position: newPosition });
      } else {
        if (currentPosition === newPosition) currentPosition += 1000;
        updates.push({
          id: task.id,
          status: newStatus,
          position: currentPosition,
        });
        currentPosition += 1000;
      }
    }

    try {
      await updatePositions.mutateAsync(updates);
      toast.success("Task moved");
    } catch (error) {
      toast.error("Failed to move task");
    }
  };

  const stats = useMemo(() => {
    const todo = filteredTasks.filter((t) => t.status === "todo").length;
    const inProgress = filteredTasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const done = filteredTasks.filter((t) => t.status === "done").length;
    return { todo, inProgress, done, total: todo + inProgress + done };
  }, [filteredTasks]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Todos</h1>
            <p className="text-muted-foreground font-mono text-xs md:text-sm mt-1">
              {stats.total} tasks · {stats.todo} to do · {stats.inProgress} in
              progress · {stats.done} done
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="font-mono"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              FILTERS
            </Button>
            <div className="flex bg-muted rounded-lg p-1">
              <Button
                variant={sortBy === "dueDate" ? "secondary" : "ghost"}
                size="sm"
                className="text-xs px-2 h-8"
                onClick={() => setSortBy("dueDate")}
              >
                DATE
              </Button>
              <Button
                variant={sortBy === "priority" ? "secondary" : "ghost"}
                size="sm"
                className="text-xs px-2 h-8"
                onClick={() => setSortBy("priority")}
              >
                PRIORITY
              </Button>
              <Button
                variant={sortBy === "manual" ? "secondary" : "ghost"}
                size="sm"
                className="text-xs px-2 h-8"
                onClick={() => setSortBy("manual")}
              >
                MANUAL
              </Button>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="font-mono shadow-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  ADD TASK
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-bold">Create Task</DialogTitle>
                </DialogHeader>
                <TaskForm onSuccess={() => setDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {showFilters && (
          <TaskFilters
            assigneeFilter={filterAssignee}
            onAssigneeChange={setFilterAssignee}
            priorityFilter={filterPriority}
            onPriorityChange={setFilterPriority}
            selectedTags={filterTags}
            onTagsChange={setFilterTags}
            members={householdMembers}
            allTags={allTags}
          />
        )}

        <KanbanBoard tasks={filteredTasks} onTaskMove={handleTaskMove} />

        {budget.tasks.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border">
            <p className="text-muted-foreground mb-4">
              No tasks yet. Create your first task!
            </p>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="font-mono"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create task
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
