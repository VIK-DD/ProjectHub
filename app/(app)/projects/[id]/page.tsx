import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Bug,
  CalendarDays,
  CheckSquare,
  StickyNote,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  findMeta,
  OPEN_BUG_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
} from "@/lib/constants";
import { parseTags } from "@/lib/utils";
import {
  accessibleProjectsWhere,
  canManageMembers,
  getProjectAccess,
} from "@/lib/access";
import { getArchivedProjectIds } from "@/lib/feature-store";
import { MembersTab } from "@/components/projects/members-tab";
import { getT } from "@/lib/i18n/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty-state";
import { TaskRow } from "@/components/tasks/task-row";
import { BugRow } from "@/components/bugs/bug-row";
import { NoteCard } from "@/components/notes/note-card";
import { TaskCreateButton } from "@/components/tasks/task-create-button";
import { BugCreateButton } from "@/components/bugs/bug-create-button";
import { NoteCreateButton } from "@/components/notes/note-create-button";
import { ProjectDetailActions } from "@/components/projects/project-detail-actions";
import { MilestoneList } from "@/components/projects/milestone-list";
import { Attachments } from "@/components/attachments/attachments";

export const metadata: Metadata = { title: "Project" };

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof CheckSquare;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const t = await getT();

  const [project, projectOptions, archivedIds] = await Promise.all([
    prisma.project.findFirst({
      where: { id: (await params).id, ...accessibleProjectsWhere(user.id) },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        members: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        tasks: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "desc" }],
          include: {
            subtasks: {
              orderBy: { order: "asc" },
              select: { id: true, title: true, completed: true },
            },
            assignee: { select: { id: true, name: true, image: true } },
          },
        },
        bugs: { where: { deletedAt: null }, orderBy: [{ createdAt: "desc" }] },
        notes: {
          where: { deletedAt: null },
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        },
        milestones: { orderBy: { order: "asc" } },
        attachments: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.project.findMany({
      where: accessibleProjectsWhere(user.id),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getArchivedProjectIds(user.id),
  ]);

  if (!project) notFound();

  const access = await getProjectAccess(user.id, project.id);
  const isOwner = access?.isOwner ?? false;
  const canManage = canManageMembers(access?.role ?? "MEMBER");
  const archived = archivedIds.has(project.id);
  const activeProjectOptions = projectOptions.filter((option) => !archivedIds.has(option.id));

  const members = [
    {
      id: "owner",
      userId: project.user.id,
      name: project.user.name,
      email: project.user.email,
      image: project.user.image,
      role: "OWNER",
      isOwner: true,
    },
    ...project.members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      isOwner: false,
    })),
  ];

  const tags = parseTags(project.tags);
  const tasksDone = project.tasks.filter((t) => t.status === "DONE").length;
  const bugsOpen = project.bugs.filter((b) =>
    OPEN_BUG_STATUSES.includes(b.status),
  ).length;

  const projectDTO = {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    priority: project.priority,
    progress: project.progress,
    tags: project.tags,
    color: project.color,
    startDate: project.startDate,
    dueDate: project.dueDate,
  };

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("page.projects.title")}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: project.color || "#6366f1" }}
            />
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill meta={findMeta(PROJECT_STATUSES, project.status)} />
            <StatusPill meta={findMeta(PRIORITIES, project.priority)} />
            {archived ? <Badge variant="soft">Archived</Badge> : null}
            {tags.map((t) => (
              <Badge key={t} variant="soft">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage ? (
            <ProjectDetailActions
              project={projectDTO}
              canDelete={isOwner}
              archived={archived}
            />
          ) : null}
        </div>
      </div>

      {archived ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            This project is archived. It stays accessible, but it is hidden from
            the main project list until you unarchive it.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="grid gap-6 p-5 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("proj.progressLabel")}</span>
              <span className="font-medium tabular-nums">
                {project.progress}%
              </span>
            </div>
            <Progress value={project.progress} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("proj.start")}</span>
            <span className="font-medium">
              {project.startDate
                ? format(project.startDate, "MMM d, yyyy")
                : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("proj.due")}</span>
            <span className="font-medium">
              {project.dueDate
                ? format(project.dueDate, "MMM d, yyyy")
                : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t("proj.overview")}</TabsTrigger>
          <TabsTrigger value="tasks">
            {t("nav.tasks")} · {project.tasks.length}
          </TabsTrigger>
          <TabsTrigger value="milestones">
            {t("proj.milestones")} · {project.milestones.length}
          </TabsTrigger>
          <TabsTrigger value="bugs">
            {t("nav.bugs")} · {project.bugs.length}
          </TabsTrigger>
          <TabsTrigger value="notes">
            {t("nav.notes")} · {project.notes.length}
          </TabsTrigger>
          <TabsTrigger value="members">
            {t("proj.members")} · {members.length}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("proj.about")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">
                {project.description || t("td.noDescription")}
              </p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MiniStat
              label={t("proj.tasksDone")}
              value={`${tasksDone}/${project.tasks.length}`}
              icon={CheckSquare}
            />
            <MiniStat
              label={t("proj.openTasks")}
              value={project.tasks.length - tasksDone}
              icon={CheckSquare}
            />
            <MiniStat label={t("proj.openBugs")} value={bugsOpen} icon={Bug} />
            <MiniStat
              label={t("proj.notes")}
              value={project.notes.length}
              icon={StickyNote}
            />
          </div>

          <Card>
            <CardContent className="p-5">
              <Attachments
                projectId={project.id}
                attachments={project.attachments.map((a) => ({
                  id: a.id,
                  filename: a.filename,
                  mimeType: a.mimeType,
                  size: a.size,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          {!archived ? (
            <div className="flex justify-end">
              <TaskCreateButton
                projects={activeProjectOptions}
                defaultProjectId={project.id}
              />
            </div>
          ) : null}
          {project.tasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title={t("empty.proj.tasks.t")}
              description={t("empty.proj.tasks.d")}
            />
          ) : (
            <div className="space-y-2">
              {project.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={{
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
                    projectName: project.name,
                    subtasks: t.subtasks,
                  }}
                  projects={activeProjectOptions}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <CardContent className="p-5">
              <MilestoneList
                projectId={project.id}
                milestones={project.milestones.map((m) => ({
                  id: m.id,
                  title: m.title,
                  completed: m.completed,
                  dueDate: m.dueDate,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bugs" className="space-y-3">
          {!archived ? (
            <div className="flex justify-end">
              <BugCreateButton
                projects={activeProjectOptions}
                defaultProjectId={project.id}
              />
            </div>
          ) : null}
          {project.bugs.length === 0 ? (
            <EmptyState
              icon={Bug}
              title={t("empty.proj.bugs.t")}
              description={t("empty.proj.bugs.d")}
            />
          ) : (
            <div className="space-y-2">
              {project.bugs.map((b) => (
                <BugRow
                  key={b.id}
                  bug={{
                    id: b.id,
                    title: b.title,
                    description: b.description,
                    severity: b.severity,
                    status: b.status,
                    projectId: b.projectId,
                    stepsToReproduce: b.stepsToReproduce,
                    fixNotes: b.fixNotes,
                    projectName: project.name,
                  }}
                  projects={activeProjectOptions}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-3">
          {!archived ? (
            <div className="flex justify-end">
              <NoteCreateButton
                projects={activeProjectOptions}
                defaultProjectId={project.id}
              />
            </div>
          ) : null}
          {project.notes.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              title={t("empty.proj.notes.t")}
              description={t("empty.proj.notes.d")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {project.notes.map((n) => (
                <NoteCard
                  key={n.id}
                  note={{
                    id: n.id,
                    title: n.title,
                    content: n.content,
                    pinned: n.pinned,
                    projectId: n.projectId,
                    projectName: project.name,
                    updatedAt: n.updatedAt,
                  }}
                  projects={activeProjectOptions}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardContent className="p-5">
              <MembersTab
                projectId={project.id}
                members={members}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
