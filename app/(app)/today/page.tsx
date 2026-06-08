import type { Metadata } from "next";
import { endOfDay, format, startOfDay } from "date-fns";
import { Sun } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getArchivedProjectIds } from "@/lib/feature-store";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskCreateButton } from "@/components/tasks/task-create-button";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const t = getT();
  const now = new Date();

  const [tasks, projectOptions, archivedIds] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: user.id,
        status: { not: "DONE" },
        dueDate: { not: null, lte: endOfDay(now) },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
      include: {
        project: { select: { name: true } },
        subtasks: { orderBy: { order: "asc" } },
      },
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getArchivedProjectIds(user.id),
  ]);

  const visibleTasks = tasks.filter(
    (task) => !task.projectId || !archivedIds.has(task.projectId),
  );
  const visibleProjects = projectOptions.filter((project) => !archivedIds.has(project.id));

  const toRow = (t: (typeof tasks)[number]) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    projectId: t.projectId,
    dueDate: t.dueDate,
    notes: t.notes,
    recurrence: t.recurrence,
    recurrenceInterval: t.recurrenceInterval,
    recurrenceUntil: t.recurrenceUntil,
    timeSpent: t.timeSpent,
    timerStartedAt: t.timerStartedAt,
    projectName: t.project?.name ?? null,
    subtasks: t.subtasks,
  });

  const start = startOfDay(now);
  const overdue = visibleTasks.filter((t) => t.dueDate! < start).map(toRow);
  const today = visibleTasks.filter((t) => t.dueDate! >= start).map(toRow);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.today.title")}
        description={format(now, "EEEE, MMMM d")}
      >
        <TaskCreateButton projects={visibleProjects} label="Quick add" />
      </PageHeader>

      {overdue.length === 0 && today.length === 0 ? (
        <EmptyState
          icon={Sun}
          title={t("empty.today.t")}
          description={t("empty.today.d")}
          action={<TaskCreateButton projects={visibleProjects} />}
        />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 ? (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-medium text-red-400">
                Overdue
                <span className="rounded-full bg-red-500/10 px-1.5 text-xs tabular-nums">
                  {overdue.length}
                </span>
              </h2>
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} projects={visibleProjects} />
              ))}
            </section>
          ) : null}

          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
              Due today
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {today.length}
              </span>
            </h2>
            {today.length > 0 ? (
              today.map((t) => (
                <TaskRow key={t.id} task={t} projects={visibleProjects} />
              ))
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                Nothing due today.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
