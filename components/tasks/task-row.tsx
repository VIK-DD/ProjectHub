"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, isPast, isToday } from "date-fns";
import {
  CalendarDays,
  ChevronRight,
  ListTree,
  MoreHorizontal,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteTask, updateTaskStatus } from "@/lib/actions/tasks";
import { restoreTask } from "@/lib/actions/trash";
import { useUndoToast } from "@/components/use-undo-toast";
import { findMeta, PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { cn, getInitials } from "@/lib/utils";
import type { ProjectOption, SubtaskDTO, TaskDTO } from "@/types/entities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { SubtaskList } from "@/components/tasks/subtask-list";
import { TaskTimer } from "@/components/tasks/task-timer";

type TaskRowData = TaskDTO & {
  projectName?: string | null;
  subtasks?: SubtaskDTO[];
};

export function TaskRow({
  task,
  projects,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  task: TaskRowData;
  projects: ProjectOption[];
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (checked: boolean) => void;
}) {
  const router = useRouter();
  const undoToast = useUndoToast();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [optimisticStatus, setOptimisticStatus] = React.useState(task.status);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setOptimisticStatus(task.status);
  }, [task.id, task.status]);

  const done = optimisticStatus === "DONE";
  const subtasks = task.subtasks ?? [];
  const doneSubs = subtasks.filter((s) => s.completed).length;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due ? isPast(due) && !isToday(due) && !done : false;

  function toggleDone(checked: boolean) {
    const nextStatus = checked ? "DONE" : "TODO";
    setOptimisticStatus(nextStatus);
    startTransition(async () => {
      const res = await updateTaskStatus(task.id, nextStatus);
      if (!res.ok) {
        setOptimisticStatus(task.status);
        toast.error(res.error);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div
        className={cn(
          "rounded-lg border bg-card transition-colors hover:border-border/80",
          selected && "border-primary/50 bg-primary/5",
        )}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          {selectionMode ? (
            <Checkbox
              checked={selected}
              onCheckedChange={(c) => onToggleSelect?.(Boolean(c))}
              aria-label="Select task"
            />
          ) : (
            <Checkbox
              checked={done}
              onCheckedChange={(c) => toggleDone(Boolean(c))}
            />
          )}

          <button
            onClick={() => setEditOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <span className="flex items-center gap-1.5">
              {task.recurrence ? (
                <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : null}
              <span
                className={cn(
                  "truncate text-sm",
                  done && "text-muted-foreground line-through",
                )}
              >
                {task.title}
              </span>
            </span>
            {(task.projectName || subtasks.length > 0) && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {task.projectName ? (
                  <span className="truncate">{task.projectName}</span>
                ) : null}
                {subtasks.length > 0 ? (
                  <span className="flex items-center gap-1">
                    <ListTree className="h-3 w-3" />
                    {doneSubs}/{subtasks.length}
                  </span>
                ) : null}
              </span>
            )}
          </button>

          <div className="hidden md:block">
            <TaskTimer
              taskId={task.id}
              timeSpent={task.timeSpent}
              timerStartedAt={task.timerStartedAt}
            />
          </div>

          {task.assignee ? (
            <Avatar
              className="hidden h-5 w-5 sm:flex"
              title={task.assignee.name ?? ""}
            >
              {task.assignee.image ? (
                <AvatarImage src={task.assignee.image} alt="" />
              ) : null}
              <AvatarFallback className="text-[9px]">
                {getInitials(task.assignee.name)}
              </AvatarFallback>
            </Avatar>
          ) : null}

          <div className="hidden items-center gap-2 sm:flex">
            <StatusPill meta={findMeta(TASK_STATUSES, task.status)} />
            <StatusPill meta={findMeta(PRIORITIES, task.priority)} />
          </div>

          {due ? (
            <span
              className={cn(
                "hidden items-center gap-1 text-xs text-muted-foreground lg:flex",
                overdue && "text-red-400",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {format(due, "MMM d")}
            </span>
          ) : null}

          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Toggle subtasks"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
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

        {expanded ? (
          <div className="space-y-3 border-t px-4 py-3 pl-10">
            <div className="md:hidden">
              <TaskTimer
                taskId={task.id}
                timeSpent={task.timeSpent}
                timerStartedAt={task.timerStartedAt}
              />
            </div>
            <SubtaskList taskId={task.id} subtasks={subtasks} />
          </div>
        ) : null}
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
