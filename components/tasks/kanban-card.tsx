"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, isPast, isToday } from "date-fns";
import {
  CalendarDays,
  Clock,
  ListTree,
  MoreHorizontal,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";
import { useUndoToast } from "@/components/use-undo-toast";

import { deleteTask } from "@/lib/actions/tasks";
import { restoreTask } from "@/lib/actions/trash";
import { findMeta, PRIORITIES } from "@/lib/constants";
import { cn, getInitials } from "@/lib/utils";
import type { ProjectOption, TaskDTO } from "@/types/entities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDuration } from "@/components/tasks/task-timer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/status-pill";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";

export type KanbanTask = TaskDTO & {
  projectName?: string | null;
  subtaskCount?: number;
  doneSubtasks?: number;
  order?: number;
};

export function KanbanCard({
  task,
  projects,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: KanbanTask;
  projects: ProjectOption[];
  dragging?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const router = useRouter();
  const undoToast = useUndoToast();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue =
    due ? isPast(due) && !isToday(due) && task.status !== "DONE" : false;

  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={cn(
          "group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-border/80 active:cursor-grabbing",
          dragging && "opacity-40",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="min-w-0 flex-1 text-left text-sm font-medium leading-snug"
          >
            {task.title}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                aria-label="Task actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="text-red-400 focus:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {task.projectName ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {task.projectName}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <StatusPill meta={findMeta(PRIORITIES, task.priority)} />
          {task.recurrence ? (
            <Repeat className="h-3 w-3 text-muted-foreground" />
          ) : null}
          {task.timeSpent > 0 || task.timerStartedAt ? (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                task.timerStartedAt
                  ? "text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              <Clock className="h-3 w-3" />
              {formatDuration(task.timeSpent)}
            </span>
          ) : null}
          {task.subtaskCount ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ListTree className="h-3 w-3" />
              {task.doneSubtasks ?? 0}/{task.subtaskCount}
            </span>
          ) : null}
          {task.assignee ? (
            <Avatar className="ml-auto h-5 w-5" title={task.assignee.name ?? ""}>
              {task.assignee.image ? (
                <AvatarImage src={task.assignee.image} alt="" />
              ) : null}
              <AvatarFallback className="text-[9px]">
                {getInitials(task.assignee.name)}
              </AvatarFallback>
            </Avatar>
          ) : null}
          {due ? (
            <span
              className={cn(
                "flex items-center gap-1 text-xs text-muted-foreground",
                overdue && "text-red-400",
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {format(due, "MMM d")}
            </span>
          ) : null}
        </div>
      </div>

      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        projects={projects}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete task?"
        description={`"${task.title}" will be permanently removed.`}
        onConfirm={async () => {
          const res = await deleteTask(task.id);
          if (res.ok) {
            undoToast("Task deleted", () => restoreTask(task.id));
            router.refresh();
          }
          return res;
        }}
      />
    </>
  );
}
