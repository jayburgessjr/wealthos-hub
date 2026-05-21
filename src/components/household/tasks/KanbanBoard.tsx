import { Task, TaskStatus } from "@/integrations/supabase/household-types";

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (
    taskId: string,
    newStatus: TaskStatus,
    newPosition: number,
  ) => void;
  showAssigneeHighlight?: boolean;
}

export function KanbanBoard(_props: KanbanBoardProps) {
  return (
    <div className="border-2 border-border rounded-lg p-6 text-center text-muted-foreground">
      <p className="text-sm">Kanban board coming soon.</p>
    </div>
  );
}
