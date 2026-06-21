import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getArchivedProjectIds } from "@/lib/feature-store";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CalendarView } from "@/components/calendar/calendar-view";
import { TaskCreateButton } from "@/components/tasks/task-create-button";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const user = await requireUser();
  const t = await getT();

  const [tasks, projectsWithDue, projectOptions, archivedIds] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, dueDate: { not: null } },
      include: { project: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { userId: user.id, dueDate: { not: null } },
      select: { id: true, name: true, dueDate: true, color: true },
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
  const visibleProjectDeadlines = projectsWithDue.filter(
    (project) => !archivedIds.has(project.id),
  );
  const visibleProjectOptions = projectOptions.filter(
    (project) => !archivedIds.has(project.id),
  );

  const taskData = visibleTasks.map((t) => ({
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
  }));

  const projectDeadlines = visibleProjectDeadlines.map((p) => ({
    id: p.id,
    name: p.name,
    dueDate: p.dueDate as Date,
    color: p.color,
  }));

  const hasAny = taskData.length > 0 || projectDeadlines.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.calendar.title")}
        description={t("page.calendar.desc")}
      >
        <TaskCreateButton projects={visibleProjectOptions} />
      </PageHeader>

      {hasAny ? (
        <CalendarView
          tasks={taskData}
          projectDeadlines={projectDeadlines}
          projects={visibleProjectOptions}
        />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title={t("empty.calendar.t")}
          description={t("empty.calendar.d")}
          action={<TaskCreateButton projects={visibleProjectOptions} />}
        />
      )}
    </div>
  );
}
