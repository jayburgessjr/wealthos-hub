import { Task, TaskStatus } from "@/integrations/supabase/household-types";
import { TaskCard } from "./TaskCard";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  count: number;
  assigneeColorMap?: Map<string, number>;
  showAssigneeHighlight?: boolean;
}

export function KanbanColumn({
  id,
  title,
  tasks,
  count,
  assigneeColorMap,
  showAssigneeHighlight = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col border-2 border-border bg-card rounded-sm min-h-[500px]",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="p-4 border-b-2 border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase tracking-wide">{title}</h3>
          <span className="font-mono text-xs text-muted-foreground">
            {count}
          </span>
        </div>
      </div>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              assigneeColorMap={assigneeColorMap}
              showAssigneeHighlight={showAssigneeHighlight}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
