import { formatDistanceToNow } from "date-fns";

import { prisma } from "@/lib/prisma";
import { getArchivedProjectIds } from "@/lib/feature-store";
import { OPEN_BUG_STATUSES, OPEN_TASK_STATUSES } from "@/lib/constants";

export type WeeklyReview = {
  stats: {
    tasksDone: number;
    overdue: number;
    openBugs: number;
    bugsCreated: number;
    projectsActive: number;
  };
  topCompleted: string[];
  topOverdue: string[];
};

export async function buildWeeklyReview(userId: string): Promise<WeeklyReview> {
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const day = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - day);
  const archivedIds = [...(await getArchivedProjectIds(userId))];
  const activeTaskFilter =
    archivedIds.length > 0
      ? { OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }] }
      : {};
  const activeBugFilter =
    archivedIds.length > 0
      ? { OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }] }
      : {};
  const activeProjectFilter =
    archivedIds.length > 0 ? { id: { notIn: archivedIds } } : {};

  const [tasksDone, overdue, openBugs, bugsCreated, projectsActive, completed, late] =
    await Promise.all([
      prisma.task.count({
        where: {
          userId,
          status: "DONE",
          completedAt: { gte: weekStart },
          ...activeTaskFilter,
        },
      }),
      prisma.task.count({
        where: {
          userId,
          status: { in: OPEN_TASK_STATUSES },
          dueDate: { lt: new Date() },
          ...activeTaskFilter,
        },
      }),
      prisma.bug.count({
        where: { userId, status: { in: OPEN_BUG_STATUSES }, ...activeBugFilter },
      }),
      prisma.bug.count({
        where: { userId, createdAt: { gte: weekStart }, ...activeBugFilter },
      }),
      prisma.project.count({
        where: { userId, status: "ACTIVE", ...activeProjectFilter },
      }),
      prisma.task.findMany({
        where: {
          userId,
          status: "DONE",
          completedAt: { gte: weekStart },
          ...activeTaskFilter,
        },
        orderBy: { completedAt: "desc" },
        take: 3,
        select: { title: true, completedAt: true },
      }),
      prisma.task.findMany({
        where: {
          userId,
          status: { in: OPEN_TASK_STATUSES },
          dueDate: { lt: new Date() },
          ...activeTaskFilter,
        },
        orderBy: { dueDate: "asc" },
        take: 3,
        select: { title: true, dueDate: true },
      }),
    ]);

  return {
    stats: { tasksDone, overdue, openBugs, bugsCreated, projectsActive },
    topCompleted: completed.map((task) =>
      task.completedAt
        ? `${task.title} (${formatDistanceToNow(task.completedAt, { addSuffix: true })})`
        : task.title,
    ),
    topOverdue: late.map((task) =>
      task.dueDate
        ? `${task.title} (${formatDistanceToNow(task.dueDate, { addSuffix: true })})`
        : task.title,
    ),
  };
}

export function weeklyReviewSummary(review: WeeklyReview) {
  return `${review.stats.tasksDone} done · ${review.stats.overdue} overdue · ${review.stats.bugsCreated} new bugs`;
}

export function weeklyReviewBody(review: WeeklyReview) {
  const completed =
    review.topCompleted.length > 0
      ? `Done: ${review.topCompleted.join(", ")}`
      : "Done: no completed tasks yet";
  const overdue =
    review.topOverdue.length > 0
      ? `Overdue: ${review.topOverdue.join(", ")}`
      : "Overdue: nothing overdue";
  return `${completed}\n${overdue}\nOpen bugs: ${review.stats.openBugs} · Active projects: ${review.stats.projectsActive}`;
}
