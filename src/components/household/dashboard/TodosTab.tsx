import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useAuth } from "@/components/AuthProvider";
import { useDemoMode } from "@/hooks/useHouseholdDemoMode";
import {
  useCreateTaskMutation,
  useUpdateTaskPositionsMutation,
} from "@/hooks/useHouseholdBudgetData";
import { KanbanBoard } from "@/components/household/tasks/KanbanBoard";
import { TaskStatus } from "@/integrations/supabase/household-types";
import { toast } from "sonner";

export const TodosTab = () => {
  const { budget, householdId } = useHouseholdBudget();
  const { user } = useAuth();
  const { demoMode } = useDemoMode();
  const createTask = useCreateTaskMutation(householdId, user?.id ?? null);
  const updateTaskPositions = useUpdateTaskPositionsMutation(householdId);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "low" | "medium" | "high"
  >("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    budget.tasks.forEach((t) => {
      if (t.createdBy && t.createdByName) map.set(t.createdBy, t.createdByName);
      if (t.assignedTo && t.assignedToName)
        map.set(t.assignedTo, t.assignedToName);
    });
    budget.expenses.forEach((e) => {
      if (e.userId && e.userName) map.set(e.userId, e.userName);
    });
    return map;
  }, [budget.tasks, budget.expenses]);

  const householdMembers = useMemo(
    () => Array.from(memberMap.entries()).map(([id, name]) => ({ id, name })),
    [memberMap],
  );

  const handleTaskMove = async (
    taskId: string,
    newStatus: TaskStatus,
    newPosition: number,
  ) => {
    if (demoMode) {
      toast.info("Demo mode: connect a household to save.");
      return;
    }
    updateTaskPositions.mutate(
      [{ id: taskId, status: newStatus, position: newPosition }],
      {
        onError: () => toast.error("Failed to move task"),
      },
    );
  };

  const handleAddTask = () => {
    if (demoMode) {
      toast.info("Demo mode: connect a household to save.");
      return;
    }
    if (!newTaskTitle.trim()) {
      toast.error("Enter a task title");
      return;
    }

    createTask.mutate(
      {
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        status: "todo",
        dueDate: newTaskDueDate || undefined,
        assignedTo: newTaskAssignedTo || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Todo added");
          setNewTaskTitle("");
          setNewTaskPriority("medium");
          setNewTaskDueDate("");
          setNewTaskAssignedTo("");
        },
        onError: () => toast.error("Failed to add todo"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Todo
          </CardTitle>
          <CardDescription>
            Create a new task for your household
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4 space-y-2">
              <Label>Task Title</Label>
              <Input
                placeholder="e.g., Call insurance company"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Priority</Label>
              <select
                className="w-full p-2 border rounded-md bg-background text-sm h-10"
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as any)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Assign To</Label>
              <select
                className="w-full p-2 border rounded-md bg-background text-sm h-10"
                value={newTaskAssignedTo}
                onChange={(e) => setNewTaskAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {householdMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <Button
                className="w-full"
                onClick={handleAddTask}
                disabled={demoMode || !newTaskTitle.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <KanbanBoard
        tasks={budget.tasks}
        onTaskMove={handleTaskMove}
        showAssigneeHighlight
      />
    </div>
  );
};
