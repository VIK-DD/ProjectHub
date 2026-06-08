import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, FolderKanban, Repeat } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { accessibleProjectsWhere } from "@/lib/access";
import { getT } from "@/lib/i18n/server";
import { findMeta, PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { getInitials } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusPill } from "@/components/status-pill";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { TaskComments } from "@/components/tasks/task-comments";
import { Attachments } from "@/components/attachments/attachments";
import { TaskTimer } from "@/components/tasks/task-timer";
import { TaskDetailActions } from "@/components/tasks/task-detail-actions";

export const metadata: Metadata = { title: "Task" };

function fmtTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return seconds > 0 ? `${seconds}s` : "—";
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default async function TaskDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const t = getT();

  const [task, projectOptions] = await Promise.all([
    prisma.task.findFirst({
      where: {
        id: params.id,
        OR: [
          { userId: user.id },
          { assigneeId: user.id },
          { project: accessibleProjectsWhere(user.id) },
        ],
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, image: true } },
        subtasks: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, completed: true },
        },
        attachments: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.project.findMany({
      where: accessibleProjectsWhere(user.id),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!task) notFound();

  const dto = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    projectId: task.projectId,
    dueDate: task.dueDate,
    notes: task.notes,
    recurrence: task.recurrence,
    recurrenceInterval: task.recurrenceInterval,
    recurrenceUntil: task.recurrenceUntil,
    timeSpent: task.timeSpent,
    timerStartedAt: task.timerStartedAt,
    assigneeId: task.assigneeId,
  };

  const recurrenceUnit =
    task.recurrence === "DAILY"
      ? "day"
      : task.recurrence === "WEEKLY"
        ? "week"
        : "month";

  return (
    <div className="space-y-6">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("nav.tasks")}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
        <TaskDetailActions task={dto} projects={projectOptions} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("td.description")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {task.description || t("td.noDescription")}
              </p>
              {task.notes ? (
                <div className="mt-4 rounded-lg border bg-muted/20 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("td.notes")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">
                    {task.notes}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("td.subtasks")}</CardTitle>
            </CardHeader>
            <CardContent>
              <SubtaskList taskId={task.id} subtasks={task.subtasks} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <Attachments
                taskId={task.id}
                attachments={task.attachments.map((a) => ({
                  id: a.id,
                  filename: a.filename,
                  mimeType: a.mimeType,
                  size: a.size,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <TaskComments taskId={task.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="divide-y p-5 pt-2">
              <MetaRow label={t("form.status")}>
                <StatusPill meta={findMeta(TASK_STATUSES, task.status)} />
              </MetaRow>
              <MetaRow label={t("form.priority")}>
                <StatusPill meta={findMeta(PRIORITIES, task.priority)} />
              </MetaRow>
              <MetaRow label={t("form.project")}>
                {task.project ? (
                  <Link
                    href={`/projects/${task.project.id}`}
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    {task.project.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </MetaRow>
              <MetaRow label={t("td.assignee")}>
                {task.assignee ? (
                  <span className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      {task.assignee.image ? (
                        <AvatarImage src={task.assignee.image} alt="" />
                      ) : null}
                      <AvatarFallback className="text-[9px]">
                        {getInitials(task.assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                    {task.assignee.name || t("role.MEMBER")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {t("td.unassigned")}
                  </span>
                )}
              </MetaRow>
              <MetaRow label={t("td.due")}>
                {task.dueDate ? (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(task.dueDate, "MMM d, yyyy")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </MetaRow>
              {task.recurrence ? (
                <MetaRow label={t("td.repeats")}>
                  <span className="flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("form.every")} {task.recurrenceInterval}{" "}
                    {t(
                      task.recurrenceInterval > 1
                        ? `unit.${recurrenceUnit}s`
                        : `unit.${recurrenceUnit}`,
                    )}
                  </span>
                </MetaRow>
              ) : null}
              <MetaRow label={t("td.timeTracked")}>
                <span className="tabular-nums">{fmtTime(task.timeSpent)}</span>
              </MetaRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("td.timer")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskTimer
                taskId={task.id}
                timeSpent={task.timeSpent}
                timerStartedAt={task.timerStartedAt}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
