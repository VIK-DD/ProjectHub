"use server";

import { revalidatePath } from "next/cache";
import { addDays, addMonths, addWeeks } from "date-fns";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import {
  getProjectMemberUsers,
  resolveAccessibleProjectId,
} from "@/lib/access";
import { notify } from "@/lib/notify";
import { errorMessage, errorStack, logAppError } from "@/lib/error-logger";
import {
  PRIORITY_VALUES,
  RECURRENCE_VALUES,
  TASK_STATUS_VALUES,
} from "@/lib/constants";
import { firstError, toDate, type Result } from "@/lib/actions/helpers";

const taskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required").max(200),
  description: z.string().trim().max(4000).optional().default(""),
  status: z.enum(TASK_STATUS_VALUES as [string, ...string[]]),
  priority: z.enum(PRIORITY_VALUES as [string, ...string[]]),
  projectId: z.string().optional().default(""),
  dueDate: z.string().optional().default(""),
  notes: z.string().trim().max(4000).optional().default(""),
  recurrence: z.string().optional().default(""),
  recurrenceInterval: z.coerce.number().int().min(1).max(365).optional().default(1),
  recurrenceUntil: z.string().optional().default(""),
  assigneeId: z.string().optional().default(""),
});

export type TaskInput = z.input<typeof taskSchema>;

function normalizeRecurrence(value?: string): string | null {
  return value && RECURRENCE_VALUES.includes(value) ? value : null;
}

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/projects");
  revalidatePath("/analytics");
  revalidatePath("/trash");
}

async function recomputeProjectProgress(projectId: string | null | undefined) {
  if (!projectId) return;
  try {
    const [total, done] = await Promise.all([
      prisma.task.count({ where: { projectId } }),
      prisma.task.count({ where: { projectId, status: "DONE" } }),
    ]);
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    await prisma.project.update({ where: { id: projectId }, data: { progress } });
    revalidatePath(`/projects/${projectId}`);
  } catch (err) {
    void logAppError({
      area: "tasks.recompute-project-progress",
      message: errorMessage(err),
      stack: errorStack(err),
      metadata: { projectId },
    });
  }
}

async function resolveProjectId(userId: string, projectId?: string) {
  // Members (not just owners) can attach tasks to projects they can access.
  return resolveAccessibleProjectId(userId, projectId);
}

// An assignee is valid only if they belong to the task's project (or it's a
// personal task assigned to yourself).
async function resolveAssignee(
  actorId: string,
  projectId: string | null,
  assigneeId?: string,
): Promise<string | null> {
  if (!assigneeId) return null;
  if (projectId) {
    const members = await getProjectMemberUsers(projectId);
    return members.some((u) => u.id === assigneeId) ? assigneeId : null;
  }
  return assigneeId === actorId ? actorId : null;
}

/** When a recurring task is completed, create its next occurrence. */
async function spawnNextOccurrence(task: {
  userId: string;
  title: string;
  description: string | null;
  priority: string;
  projectId: string | null;
  assigneeId: string | null;
  notes: string | null;
  recurrence: string | null;
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
  dueDate: Date | null;
}) {
  if (!task.recurrence) return;
  const step = Math.max(1, task.recurrenceInterval || 1);
  const base = task.dueDate ?? new Date();
  const next =
    task.recurrence === "DAILY"
      ? addDays(base, step)
      : task.recurrence === "WEEKLY"
        ? addWeeks(base, step)
        : addMonths(base, step);

  // Stop if we've passed the recurrence end date.
  if (task.recurrenceUntil && next > task.recurrenceUntil) return;

  await prisma.task.create({
    data: {
      userId: task.userId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      projectId: task.projectId,
      assigneeId: task.assigneeId,
      notes: task.notes,
      recurrence: task.recurrence,
      recurrenceInterval: task.recurrenceInterval,
      recurrenceUntil: task.recurrenceUntil,
      status: "TODO",
      dueDate: next,
    },
  });
  await recomputeProjectProgress(task.projectId);
}

export async function createTask(
  input: TaskInput,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const projectId = await resolveProjectId(user.id, d.projectId);
  const assigneeId = await resolveAssignee(user.id, projectId, d.assigneeId);

  const task = await prisma.task.create({
    data: {
      title: d.title,
      description: d.description || null,
      status: d.status,
      priority: d.priority,
      projectId,
      assigneeId,
      dueDate: toDate(d.dueDate),
      notes: d.notes || null,
      recurrence: normalizeRecurrence(d.recurrence),
      recurrenceInterval: d.recurrenceInterval,
      recurrenceUntil: toDate(d.recurrenceUntil),
      completedAt: d.status === "DONE" ? new Date() : null,
      userId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    action: "created",
    entityType: "task",
    entityId: task.id,
    entityTitle: task.title,
  });
  if (assigneeId && assigneeId !== user.id) {
    await notify(assigneeId, {
      type: "ASSIGNED",
      title: `You were assigned “${task.title}”`,
      body: `${user.name ?? "Someone"} assigned this to you.`,
      entityType: "task",
      entityId: task.id,
    });
  }
  await recomputeProjectProgress(projectId);

  revalidate();
  return { ok: true, id: task.id };
}

export async function updateTask(
  id: string,
  input: TaskInput,
): Promise<Result> {
  const user = await requireUser();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const existing = await prisma.task.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { ok: false, error: "Task not found" };

  const d = parsed.data;
  const projectId = await resolveProjectId(user.id, d.projectId);
  const assigneeId = await resolveAssignee(user.id, projectId, d.assigneeId);
  const recurrence = normalizeRecurrence(d.recurrence);
  const becomingDone = existing.status !== "DONE" && d.status === "DONE";
  const assigneeChanged = assigneeId !== existing.assigneeId;

  await prisma.task.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description || null,
      status: d.status,
      priority: d.priority,
      projectId,
      assigneeId,
      dueDate: toDate(d.dueDate),
      notes: d.notes || null,
      recurrence,
      recurrenceInterval: d.recurrenceInterval,
      recurrenceUntil: toDate(d.recurrenceUntil),
      completedAt:
        d.status === "DONE" ? existing.completedAt ?? new Date() : null,
    },
  });

  if (assigneeChanged && assigneeId && assigneeId !== user.id) {
    await notify(assigneeId, {
      type: "ASSIGNED",
      title: `You were assigned “${d.title}”`,
      body: `${user.name ?? "Someone"} assigned this to you.`,
      entityType: "task",
      entityId: id,
    });
  }

  if (becomingDone && recurrence) {
    await spawnNextOccurrence({
      userId: user.id,
      title: d.title,
      description: d.description || null,
      priority: d.priority,
      projectId,
      assigneeId,
      notes: d.notes || null,
      recurrence,
      recurrenceInterval: d.recurrenceInterval,
      recurrenceUntil: toDate(d.recurrenceUntil),
      dueDate: toDate(d.dueDate),
    });
  }

  await logActivity({
    userId: user.id,
    action: becomingDone ? "completed" : "updated",
    entityType: "task",
    entityId: id,
    entityTitle: d.title,
  });

  await recomputeProjectProgress(existing.projectId);
  if (projectId !== existing.projectId) await recomputeProjectProgress(projectId);

  revalidate();
  return { ok: true };
}

export async function updateTaskStatus(
  id: string,
  status: string,
): Promise<Result> {
  const user = await requireUser();
  if (!TASK_STATUS_VALUES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  const existing = await prisma.task.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { ok: false, error: "Task not found" };

  const becomingDone = existing.status !== "DONE" && status === "DONE";

  await prisma.task.update({
    where: { id },
    data: {
      status,
      completedAt:
        status === "DONE" ? existing.completedAt ?? new Date() : null,
    },
  });

  if (becomingDone && existing.recurrence) {
    await spawnNextOccurrence({
      userId: user.id,
      title: existing.title,
      description: existing.description,
      priority: existing.priority,
      projectId: existing.projectId,
      assigneeId: existing.assigneeId,
      notes: existing.notes,
      recurrence: existing.recurrence,
      recurrenceInterval: existing.recurrenceInterval,
      recurrenceUntil: existing.recurrenceUntil,
      dueDate: existing.dueDate,
    });
  }

  await logActivity({
    userId: user.id,
    action: status === "DONE" ? "completed" : "updated",
    entityType: "task",
    entityId: id,
    entityTitle: existing.title,
  });
  await recomputeProjectProgress(existing.projectId);

  revalidate();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<Result> {
  const user = await requireUser();
  const existing = await prisma.task.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { ok: false, error: "Task not found" };

  // Soft delete → recoverable from Trash.
  await prisma.task.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: user.id,
    action: "deleted",
    entityType: "task",
    entityId: id,
    entityTitle: existing.title,
  });
  await recomputeProjectProgress(existing.projectId);

  revalidate();
  return { ok: true };
}

// --- Bulk actions ----------------------------------------------------------

async function affectedProjectIds(userId: string, ids: string[]) {
  const rows = await prisma.task.findMany({
    where: { id: { in: ids }, userId },
    select: { projectId: true },
  });
  return [...new Set(rows.map((r) => r.projectId).filter(Boolean))] as string[];
}

export async function bulkUpdateTaskStatus(
  ids: string[],
  status: string,
): Promise<Result> {
  const user = await requireUser();
  if (!TASK_STATUS_VALUES.includes(status))
    return { ok: false, error: "Invalid status" };
  if (ids.length === 0) return { ok: true };

  const projectIds = await affectedProjectIds(user.id, ids);
  await prisma.task.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });

  await Promise.all(projectIds.map((pid) => recomputeProjectProgress(pid)));
  revalidate();
  return { ok: true };
}

export async function bulkDeleteTasks(ids: string[]): Promise<Result> {
  const user = await requireUser();
  if (ids.length === 0) return { ok: true };

  const projectIds = await affectedProjectIds(user.id, ids);
  await prisma.task.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: { deletedAt: new Date() },
  });

  await Promise.all(projectIds.map((pid) => recomputeProjectProgress(pid)));
  revalidate();
  return { ok: true };
}

export async function bulkRestoreTasks(ids: string[]): Promise<Result> {
  const user = await requireUser();
  if (ids.length === 0) return { ok: true };

  await prisma.task.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: { deletedAt: null },
  });

  revalidate();
  return { ok: true };
}

export async function bulkUpdateTaskPriority(
  ids: string[],
  priority: string,
): Promise<Result> {
  const user = await requireUser();
  if (!PRIORITY_VALUES.includes(priority))
    return { ok: false, error: "Invalid priority" };
  if (ids.length === 0) return { ok: true };

  await prisma.task.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: { priority },
  });

  revalidate();
  return { ok: true };
}

/** Persist the order (and status) of tasks within a Kanban column. */
export async function reorderColumn(
  status: string,
  orderedIds: string[],
): Promise<Result> {
  const user = await requireUser();
  if (!TASK_STATUS_VALUES.includes(status))
    return { ok: false, error: "Invalid status" };

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.task.updateMany({
        where: { id, userId: user.id },
        data: { order: index, status },
      }),
    ),
  );

  revalidate();
  return { ok: true };
}

/** Move a task to a new due date (used by drag-and-drop on the calendar). */
export async function rescheduleTask(
  id: string,
  dueDate: string,
): Promise<Result> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not found" };
  await prisma.task.update({
    where: { id },
    data: { dueDate: toDate(dueDate) },
  });
  revalidate();
  return { ok: true };
}

// --- Time tracking ---------------------------------------------------------

async function logTimeEntry(
  userId: string,
  taskId: string,
  startedAt: Date,
  seconds: number,
) {
  if (seconds <= 0) return;
  try {
    await prisma.timeEntry.create({
      data: { userId, taskId, startedAt, endedAt: new Date(), seconds },
    });
  } catch (err) {
    void logAppError({
      area: "tasks.log-time-entry",
      message: errorMessage(err),
      stack: errorStack(err),
      metadata: { userId, taskId, seconds },
    });
  }
}

export async function startTimer(id: string): Promise<Result> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return { ok: false, error: "Task not found" };

  // Only one timer runs at a time — stop any others first.
  const running = await prisma.task.findMany({
    where: { userId: user.id, timerStartedAt: { not: null } },
  });
  for (const r of running) {
    if (!r.timerStartedAt) continue;
    const elapsed = Math.floor((Date.now() - r.timerStartedAt.getTime()) / 1000);
    await prisma.task.update({
      where: { id: r.id },
      data: { timeSpent: r.timeSpent + Math.max(0, elapsed), timerStartedAt: null },
    });
    await logTimeEntry(user.id, r.id, r.timerStartedAt, Math.max(0, elapsed));
  }

  await prisma.task.update({
    where: { id },
    data: { timerStartedAt: new Date() },
  });

  revalidate();
  return { ok: true };
}

export async function stopTimer(id: string): Promise<Result> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return { ok: false, error: "Task not found" };
  if (!task.timerStartedAt) return { ok: true };

  const elapsed = Math.floor(
    (Date.now() - task.timerStartedAt.getTime()) / 1000,
  );
  await prisma.task.update({
    where: { id },
    data: {
      timeSpent: task.timeSpent + Math.max(0, elapsed),
      timerStartedAt: null,
    },
  });
  await logTimeEntry(user.id, id, task.timerStartedAt, Math.max(0, elapsed));

  revalidate();
  return { ok: true };
}

// --- Subtasks --------------------------------------------------------------

async function ownsTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });
  return Boolean(task);
}

export async function addSubtask(
  taskId: string,
  title: string,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const clean = title.trim();
  if (!clean) return { ok: false, error: "Subtask title is required" };
  if (!(await ownsTask(user.id, taskId)))
    return { ok: false, error: "Task not found" };

  const count = await prisma.subtask.count({ where: { taskId } });
  const subtask = await prisma.subtask.create({
    data: { taskId, title: clean, order: count },
  });

  revalidate();
  return { ok: true, id: subtask.id };
}

export async function toggleSubtask(id: string): Promise<Result> {
  const user = await requireUser();
  const subtask = await prisma.subtask.findUnique({
    where: { id },
    include: { task: { select: { userId: true } } },
  });
  if (!subtask || subtask.task.userId !== user.id)
    return { ok: false, error: "Subtask not found" };

  await prisma.subtask.update({
    where: { id },
    data: { completed: !subtask.completed },
  });

  revalidate();
  return { ok: true };
}

export async function deleteSubtask(id: string): Promise<Result> {
  const user = await requireUser();
  const subtask = await prisma.subtask.findUnique({
    where: { id },
    include: { task: { select: { userId: true } } },
  });
  if (!subtask || subtask.task.userId !== user.id)
    return { ok: false, error: "Subtask not found" };

  await prisma.subtask.delete({ where: { id } });

  revalidate();
  return { ok: true };
}
