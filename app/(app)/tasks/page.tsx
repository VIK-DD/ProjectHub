import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { accessibleProjectsWhere } from "@/lib/access";
import { getArchivedProjectIds, getSavedViews } from "@/lib/feature-store";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TaskCreateButton } from "@/components/tasks/task-create-button";
import { TasksView, type ViewTask } from "@/components/tasks/tasks-view";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: {
    new?: string;
    title?: string;
    search?: string;
    project?: string;
    priority?: string;
    viewMode?: string;
  };
}) {
  const user = await requireUser();
  const t = getT();
  // Lets ⌘K "New task in project X" open the create dialog pre-scoped.
  const createProjectId =
    searchParams.project && searchParams.project !== "all"
      ? searchParams.project
      : undefined;

  const [tasks, projects, archivedIds, savedViews] = await Promise.all([
    prisma.task.findMany({
      where: { OR: [{ userId: user.id }, { assigneeId: user.id }] },
      orderBy: [{ createdAt: "desc" }],
      include: {
        project: { select: { name: true } },
        assignee: { select: { id: true, name: true, image: true } },
        subtasks: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, completed: true },
        },
      },
    }),
    prisma.project.findMany({
      where: accessibleProjectsWhere(user.id),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getArchivedProjectIds(user.id),
    getSavedViews(user.id, "tasks"),
  ]);

  const visibleTasks = tasks.filter(
    (task) => !task.projectId || !archivedIds.has(task.projectId),
  );

  const data: ViewTask[] = visibleTasks.map((t) => ({
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
    assigneeId: t.assigneeId,
    assignee: t.assignee,
    order: t.order,
    projectName: t.project?.name ?? null,
    subtasks: t.subtasks,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.tasks.title")}
        description={t("page.tasks.desc")}
      >
        <TaskCreateButton
          projects={projects.filter((project) => !archivedIds.has(project.id))}
          defaultOpen={searchParams.new === "1"}
          defaultProjectId={createProjectId}
          defaultTitle={searchParams.title}
        />
      </PageHeader>

      {visibleTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={t("empty.tasks.t")}
          description={t("empty.tasks.d")}
          action={
            <TaskCreateButton
              projects={projects.filter((project) => !archivedIds.has(project.id))}
              defaultProjectId={createProjectId}
              defaultTitle={searchParams.title}
            />
          }
        />
      ) : (
        <TasksView
          tasks={data}
          projects={projects.filter((project) => !archivedIds.has(project.id))}
          savedViews={savedViews}
          initialFilters={{
            search: searchParams.search ?? "",
            project: searchParams.project ?? "all",
            priority: searchParams.priority ?? "all",
            viewMode: searchParams.viewMode ?? "board",
          }}
        />
      )}
    </div>
  );
}
