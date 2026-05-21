import { useMemo, useState } from "react";
import { Task, TaskStatus } from "@/integrations/supabase/household-types";
import { KanbanColumn } from "./KanbanColumn";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { TaskCard } from "./TaskCard";

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (
    taskId: string,
    newStatus: TaskStatus,
    newPosition: number,
  ) => void;
  showAssigneeHighlight?: boolean;
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export function KanbanBoard({
  tasks,
  onTaskMove,
  showAssigneeHighlight = false,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const tasksByStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    tasks.forEach((task) => {
      groups[task.status].push(task);
    });
    Object.keys(groups).forEach((status) => {
      groups[status as TaskStatus].sort((a, b) => a.position - b.position);
    });
    return groups;
  }, [tasks]);

  // Build a map of unique assignees to consistent color indices
  const assigneeColorMap = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    tasks.forEach((task) => {
      if (task.assignedTo && !map.has(task.assignedTo)) {
        map.set(task.assignedTo, index++);
      }
    });
    return map;
  }, [tasks]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    let newStatus: TaskStatus;
    let newPosition: number;

    if (overId === "todo" || overId === "in_progress" || overId === "done") {
      newStatus = overId as TaskStatus;
      const tasksInColumn = tasksByStatus[newStatus];
      newPosition =
        tasksInColumn.length > 0
          ? Math.max(...tasksInColumn.map((t) => t.position)) + 1000
          : 0;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      newStatus = overTask.status;
      newPosition = overTask.position;
    }

    onTaskMove(taskId, newStatus, newPosition);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={tasksByStatus[column.id]}
            count={tasksByStatus[column.id].length}
            assigneeColorMap={assigneeColorMap}
            showAssigneeHighlight={showAssigneeHighlight}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            isDragging
            assigneeColorMap={assigneeColorMap}
            showAssigneeHighlight={showAssigneeHighlight}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
