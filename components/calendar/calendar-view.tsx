"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { rescheduleTask } from "@/lib/actions/tasks";
import { findMeta, TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProjectOption, TaskDTO } from "@/types/entities";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useT } from "@/components/i18n-provider";

type CalTask = TaskDTO & { projectName?: string | null };
type ProjectDeadline = {
  id: string;
  name: string;
  dueDate: Date;
  color: string | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({
  tasks,
  projectDeadlines,
  projects,
}: {
  tasks: CalTask[];
  projectDeadlines: ProjectDeadline[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const t = useT();
  const [, startTransition] = React.useTransition();
  const [cursor, setCursor] = React.useState(() => new Date());
  const [items, setItems] = React.useState<CalTask[]>(tasks);
  const [selected, setSelected] = React.useState<CalTask | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createDate, setCreateDate] = React.useState<string>("");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overKey, setOverKey] = React.useState<string | null>(null);

  React.useEffect(() => setItems(tasks), [tasks]);

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function openTask(task: CalTask) {
    setSelected(task);
    setEditOpen(true);
  }

  function openCreate(day: Date) {
    setCreateDate(format(day, "yyyy-MM-dd"));
    setCreateOpen(true);
  }

  function reschedule(taskId: string, day: Date) {
    const existing = items.find((t) => t.id === taskId);
    if (existing && existing.dueDate && isSameDay(new Date(existing.dueDate), day))
      return;
    setItems((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, dueDate: day } : t)),
    );
    startTransition(async () => {
      const res = await rescheduleTask(taskId, format(day, "yyyy-MM-dd"));
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tabular-nums">
          {format(cursor, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            {t("view.today")}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setCursor((c) => subMonths(c, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = day.toISOString();
            const inMonth = isSameMonth(day, cursor);
            const today = isToday(day);
            const dayProjects = projectDeadlines.filter((p) =>
              isSameDay(new Date(p.dueDate), day),
            );
            const dayTasks = items.filter(
              (t) => t.dueDate && isSameDay(new Date(t.dueDate), day),
            );
            const total = dayProjects.length + dayTasks.length;
            const visibleProjects = dayProjects.slice(0, 3);
            const visibleTasks = dayTasks.slice(
              0,
              Math.max(0, 3 - visibleProjects.length),
            );
            const hidden = total - visibleProjects.length - visibleTasks.length;

            return (
              <div
                key={key}
                onClick={() => openCreate(day)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overKey !== key) setOverKey(key);
                }}
                onDragLeave={() =>
                  setOverKey((k) => (k === key ? null : k))
                }
                onDrop={() => {
                  if (dragId) reschedule(dragId, day);
                  setDragId(null);
                  setOverKey(null);
                }}
                title="Click to add a task"
                className={cn(
                  "group relative min-h-[96px] cursor-pointer border-b border-r p-1.5 transition-colors last:border-r-0 hover:bg-accent/30 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/20",
                  overKey === key && "bg-primary/10 ring-1 ring-inset ring-primary/40",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                      today
                        ? "bg-primary font-semibold text-primary-foreground"
                        : inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                <div className="space-y-1">
                  {visibleProjects.map((p) => (
                    <Link
                      key={`p-${p.id}`}
                      href={`/projects/${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 rounded-md border bg-card px-1.5 py-1 text-[11px] leading-tight transition-colors hover:bg-accent"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: p.color || "#6366f1" }}
                      />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  ))}

                  {visibleTasks.map((t) => {
                    const meta = findMeta(TASK_STATUSES, t.status);
                    const done = t.status === "DONE";
                    return (
                      <button
                        key={`t-${t.id}`}
                        draggable
                        onDragStart={(e) => {
                          setDragId(t.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverKey(null);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openTask(t);
                        }}
                        className={cn(
                          "flex w-full cursor-grab items-center gap-1.5 rounded-md border bg-card px-1.5 py-1 text-left text-[11px] leading-tight transition-colors hover:bg-accent active:cursor-grabbing",
                          dragId === t.id && "opacity-50",
                        )}
                      >
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)}
                        />
                        <span
                          className={cn(
                            "truncate",
                            done && "text-muted-foreground line-through",
                          )}
                        >
                          {t.title}
                        </span>
                      </button>
                    );
                  })}

                  {hidden > 0 ? (
                    <p
                      onClick={(e) => e.stopPropagation()}
                      className="px-1 text-[11px] text-muted-foreground"
                    >
                      +{hidden} more
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("view.calendarTip")}</p>

      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={selected}
        projects={projects}
      />
      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projects={projects}
        defaultDueDate={createDate}
      />
    </div>
  );
}
