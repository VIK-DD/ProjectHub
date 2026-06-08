import {
  addDays,
  endOfDay,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
  format,
} from "date-fns";

import { prisma } from "@/lib/prisma";
import { getArchivedProjectIds } from "@/lib/feature-store";
import {
  OPEN_BUG_STATUSES,
  OPEN_TASK_STATUSES,
  TASK_STATUSES,
  PROJECT_STATUSES,
  BUG_SEVERITIES,
  findMeta,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function getDashboardData(userId: string) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
  const archivedIds = [...(await getArchivedProjectIds(userId))];
  const activeProjectFilter =
    archivedIds.length > 0 ? { id: { notIn: archivedIds } } : {};
  const activeTaskFilter =
    archivedIds.length > 0
      ? {
          OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }],
        }
      : {};
  const activeBugFilter =
    archivedIds.length > 0
      ? {
          OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }],
        }
      : {};

  const [
    activeProjects,
    openTasks,
    openBugs,
    completedTasks,
    tasksDoneThisWeek,
    upcomingTasks,
    upcomingProjects,
    progressProjects,
    weekCompleted,
  ] = await Promise.all([
    prisma.project.count({ where: { userId, status: "ACTIVE", ...activeProjectFilter } }),
    prisma.task.count({
      where: { userId, status: { in: OPEN_TASK_STATUSES }, ...activeTaskFilter },
    }),
    prisma.bug.count({
      where: { userId, status: { in: OPEN_BUG_STATUSES }, ...activeBugFilter },
    }),
    prisma.task.count({ where: { userId, status: "DONE", ...activeTaskFilter } }),
    prisma.task.count({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: weekStart },
        ...activeTaskFilter,
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { not: "DONE" },
        dueDate: { not: null },
        ...activeTaskFilter,
      },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { project: { select: { name: true, color: true } } },
    }),
    prisma.project.findMany({
      where: {
        userId,
        status: { not: "COMPLETED" },
        dueDate: { not: null },
        ...activeProjectFilter,
      },
      orderBy: { dueDate: "asc" },
      take: 4,
    }),
    prisma.project.findMany({
      where: {
        userId,
        status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] },
        ...activeProjectFilter,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: sevenDaysAgo },
        ...activeTaskFilter,
      },
      select: { completedAt: true },
    }),
  ]);

  // Merge upcoming tasks + projects into one sorted deadline list.
  const deadlines = [
    ...upcomingTasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      dueDate: t.dueDate!,
      context: t.project?.name ?? null,
    })),
    ...upcomingProjects.map((p) => ({
      id: p.id,
      type: "project" as const,
      title: p.name,
      dueDate: p.dueDate!,
      context: null,
    })),
  ]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 6);

  // 7-day completion sparkline.
  const days = Array.from({ length: 7 }, (_, i) =>
    startOfDay(subDays(new Date(), 6 - i)),
  );
  const completionSeries = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const count = weekCompleted.filter(
      (t) => t.completedAt && format(t.completedAt, "yyyy-MM-dd") === key,
    ).length;
    return { label: format(day, "EEE"), count };
  });

  return {
    stats: { activeProjects, openTasks, openBugs, completedTasks },
    tasksDoneThisWeek,
    deadlines,
    progressProjects,
    completionSeries,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export async function getAnalyticsData(userId: string) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const archivedIds = [...(await getArchivedProjectIds(userId))];
  const activeProjectFilter =
    archivedIds.length > 0 ? { id: { notIn: archivedIds } } : {};
  const activeTaskFilter =
    archivedIds.length > 0
      ? {
          OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }],
        }
      : {};
  const activeBugFilter =
    archivedIds.length > 0
      ? {
          OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }],
        }
      : {};

  const [
    totalProjects,
    totalTasks,
    totalBugs,
    totalNotes,
    completedTasks,
    tasksThisWeek,
    taskByStatus,
    projectByStatus,
    bugBySeverity,
    openBugs,
    closedBugs,
    recentDoneTasks,
    recentCreatedTasks,
  ] = await Promise.all([
    prisma.project.count({ where: { userId, ...activeProjectFilter } }),
    prisma.task.count({ where: { userId, ...activeTaskFilter } }),
    prisma.bug.count({ where: { userId, ...activeBugFilter } }),
    prisma.note.count({
      where:
        archivedIds.length > 0
          ? {
              userId,
              OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }],
            }
          : { userId },
    }),
    prisma.task.count({ where: { userId, status: "DONE", ...activeTaskFilter } }),
    prisma.task.count({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: weekStart },
        ...activeTaskFilter,
      },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { userId, ...activeTaskFilter },
      _count: { _all: true },
    }),
    prisma.project.groupBy({
      by: ["status"],
      where: { userId, ...activeProjectFilter },
      _count: { _all: true },
    }),
    prisma.bug.groupBy({
      by: ["severity"],
      where: { userId, ...activeBugFilter },
      _count: { _all: true },
    }),
    prisma.bug.count({
      where: { userId, status: { in: OPEN_BUG_STATUSES }, ...activeBugFilter },
    }),
    prisma.bug.count({
      where: { userId, status: { in: ["FIXED", "CLOSED"] }, ...activeBugFilter },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: "DONE",
        completedAt: { gte: startOfDay(subWeeks(new Date(), 8)) },
        ...activeTaskFilter,
      },
      select: { completedAt: true },
    }),
    prisma.task.findMany({
      where: {
        userId,
        createdAt: { gte: startOfDay(subDays(new Date(), 13)) },
        ...activeTaskFilter,
      },
      select: { createdAt: true },
    }),
  ]);

  const taskStatus = TASK_STATUSES.map((m) => ({
    value: m.value,
    label: m.label,
    count: taskByStatus.find((r) => r.status === m.value)?._count._all ?? 0,
  }));

  const projectStatus = PROJECT_STATUSES.map((m) => ({
    value: m.value,
    label: m.label,
    count: projectByStatus.find((r) => r.status === m.value)?._count._all ?? 0,
  }));

  const bugSeverity = BUG_SEVERITIES.map((m) => ({
    value: m.value,
    label: m.label,
    count: bugBySeverity.find((r) => r.severity === m.value)?._count._all ?? 0,
  }));

  // Last 8 weeks of completed tasks.
  const weeks = Array.from({ length: 8 }, (_, i) =>
    startOfWeek(subWeeks(new Date(), 7 - i), { weekStartsOn: 1 }),
  );
  const weeklyCompletions = weeks.map((w, idx) => {
    const next = weeks[idx + 1] ?? new Date(8.64e15);
    const count = recentDoneTasks.filter(
      (t) => t.completedAt && t.completedAt >= w && t.completedAt < next,
    ).length;
    return { label: format(w, "MMM d"), count };
  });

  // Last 14 days: tasks completed vs created.
  const days = Array.from({ length: 14 }, (_, i) =>
    startOfDay(subDays(new Date(), 13 - i)),
  );
  const dailyActivity = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const completed = recentDoneTasks.filter(
      (t) => t.completedAt && format(t.completedAt, "yyyy-MM-dd") === key,
    ).length;
    const created = recentCreatedTasks.filter(
      (t) => format(t.createdAt, "yyyy-MM-dd") === key,
    ).length;
    return { label: format(day, "MMM d"), completed, created };
  });

  const completionRate =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return {
    totals: {
      projects: totalProjects,
      tasks: totalTasks,
      bugs: totalBugs,
      notes: totalNotes,
    },
    completion: { completedTasks, totalTasks, rate: completionRate },
    tasksThisWeek,
    taskStatus,
    projectStatus,
    bugSeverity,
    bugs: { open: openBugs, closed: closedBugs },
    weeklyCompletions,
    dailyActivity,
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsData>>;

// ---------------------------------------------------------------------------
// Reminders (in-app notifications): things due soon or overdue.
// ---------------------------------------------------------------------------
export async function getReminders(userId: string) {
  // Respect the "deadline reminders" preference.
  const prefs = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyReminders: true },
  });
  if (prefs && !prefs.notifyReminders) return [];

  const now = new Date();
  const taskHorizon = endOfDay(addDays(now, 3));
  const projectHorizon = endOfDay(addDays(now, 7));
  const archivedIds = [...(await getArchivedProjectIds(userId))];

  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        status: { not: "DONE" },
        dueDate: { not: null, lte: taskHorizon },
        ...(archivedIds.length > 0
          ? { OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }] }
          : {}),
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: { project: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: {
        userId,
        status: { not: "COMPLETED" },
        dueDate: { not: null, lte: projectHorizon },
        ...(archivedIds.length > 0 ? { id: { notIn: archivedIds } } : {}),
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const items = [
    ...tasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      dueDate: t.dueDate!,
      context: t.project?.name ?? null,
    })),
    ...projects.map((p) => ({
      id: p.id,
      type: "project" as const,
      title: p.name,
      dueDate: p.dueDate!,
      context: null,
    })),
  ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return items.slice(0, 10);
}

export type ReminderItem = Awaited<ReturnType<typeof getReminders>>[number];

// Stored notifications (assignments, comments, mentions, project changes).
export async function getNotifications(userId: string) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { items, unread };
}

export type NotificationData = Awaited<ReturnType<typeof getNotifications>>;

// ---------------------------------------------------------------------------
// Activity log feed (filterable by entity/action/date on the client).
// ---------------------------------------------------------------------------
export async function getActivityLog(userId: string, limit = 60) {
  const rows = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityTitle: true,
      createdAt: true,
      meta: true,
    },
  });
  return rows.map((row) => {
    let meta: Record<string, unknown> | null = null;
    if (row.meta) {
      try {
        meta = JSON.parse(row.meta) as Record<string, unknown>;
      } catch {
        meta = null;
      }
    }
    return { ...row, meta };
  });
}

// ---------------------------------------------------------------------------
// Time tracking report (this week, today, per project, per day).
// ---------------------------------------------------------------------------
export async function getTimeReport(userId: string) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const dayStart = startOfDay(new Date());

  const [entries, allTime] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId, endedAt: { gte: weekStart } },
      include: { task: { select: { project: { select: { name: true } } } } },
    }),
    prisma.task.aggregate({ where: { userId }, _sum: { timeSpent: true } }),
  ]);

  let weekTotal = 0;
  let todayTotal = 0;
  const perProject = new Map<string, number>();
  const perDay = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun

  for (const e of entries) {
    weekTotal += e.seconds;
    if (e.endedAt >= dayStart) todayTotal += e.seconds;
    const name = e.task?.project?.name ?? "No project";
    perProject.set(name, (perProject.get(name) ?? 0) + e.seconds);
    perDay[(new Date(e.endedAt).getDay() + 6) % 7] += e.seconds;
  }

  return {
    weekTotal,
    todayTotal,
    allTime: allTime._sum.timeSpent ?? 0,
    perProject: [...perProject.entries()]
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 6),
    perDay,
  };
}

export type TimeReport = Awaited<ReturnType<typeof getTimeReport>>;

// Small helper used by a couple of server components.
export function statusMetaFor(kind: "task" | "project", value: string) {
  return kind === "task"
    ? findMeta(TASK_STATUSES, value)
    : findMeta(PROJECT_STATUSES, value);
}
