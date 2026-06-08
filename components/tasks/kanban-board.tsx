"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reorderColumn, updateTaskStatus } from "@/lib/actions/tasks";
import { TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProjectOption } from "@/types/entities";
import { KanbanCard, type KanbanTask } from "@/components/tasks/kanban-card";
import { TaskCreateButton } from "@/components/tasks/task-create-button";
import { useT } from "@/components/i18n-provider";

const byOrder = (a: KanbanTask, b: KanbanTask) =>
  (a.order ?? 0) - (b.order ?? 0);

export function KanbanBoard({
  tasks,
  projects,
}: {
  tasks: KanbanTask[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const t = useT();
  const [items, setItems] = React.useState<KanbanTask[]>(tasks);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<{ status: string; index: number } | null>(
    null,
  );
  const [, startTransition] = React.useTransition();

  React.useEffect(() => setItems(tasks), [tasks]);

  function handleDrop(status: string) {
    const id = dragId;
    const target = over;
    setDragId(null);
    setOver(null);
    if (!id) return;
    const dragged = items.find((t) => t.id === id);
    if (!dragged) return;

    if (dragged.status === status) {
      // Reorder within the same column.
      const colTasks = items.filter((t) => t.status === status).sort(byOrder);
      const without = colTasks.filter((t) => t.id !== id);
      const index =
        target && target.status === status ? target.index : without.length;
      without.splice(Math.min(index, without.length), 0, dragged);
      const orderedIds = without.map((t) => t.id);

      setItems((prev) =>
        prev.map((t) => {
          const i = orderedIds.indexOf(t.id);
          return i >= 0 ? { ...t, order: i } : t;
        }),
      );
      startTransition(async () => {
        const res = await reorderColumn(status, orderedIds);
        if (!res.ok) toast.error(res.error);
        router.refresh();
      });
    } else {
      // Move to another column (status change).
      setItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status } : t)),
      );
      startTransition(async () => {
        const res = await updateTaskStatus(id, status);
        if (!res.ok) toast.error(res.error);
        router.refresh();
      });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((col) => {
        const colTasks = items
          .filter((t) => t.status === col.value)
          .sort(byOrder);
        const isOver = over?.status === col.value;
        return (
          <div
            key={col.value}
            onDragOver={(e) => {
              e.preventDefault();
              setOver({ status: col.value, index: colTasks.length });
            }}
            onDrop={() => handleDrop(col.value)}
            className={cn(
              "flex flex-col rounded-xl border bg-muted/20 transition-colors",
              isOver && "border-primary/40 bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                <span className="text-sm font-medium">
                  {t(`meta.${col.value}`)}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {colTasks.length}
                </span>
              </div>
              <TaskCreateButton
                projects={projects}
                defaultStatus={col.value}
                variant="ghost"
                size="icon-sm"
                label={t(`meta.${col.value}`)}
              />
            </div>

            <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2 pt-0">
              {colTasks.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-6 text-xs text-muted-foreground">
                  Drop tasks here
                </div>
              ) : (
                colTasks.map((task, index) => (
                  <div
                    key={task.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOver({ status: col.value, index });
                    }}
                    className={cn(
                      "rounded-lg",
                      isOver &&
                        over?.index === index &&
                        "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
                    )}
                  >
                    <KanbanCard
                      task={task}
                      projects={projects}
                      dragging={dragId === task.id}
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
