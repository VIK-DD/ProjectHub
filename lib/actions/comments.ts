"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProjectAccess } from "@/lib/access";
import { notify } from "@/lib/notify";
import type { Result } from "@/lib/actions/helpers";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("static generation store missing")) throw error;
  }
}

async function accessibleTask(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      userId: true,
      projectId: true,
      title: true,
      assigneeId: true,
    },
  });
  if (!task) return null;
  if (task.userId === userId) return task;
  if (task.projectId) {
    const access = await getProjectAccess(userId, task.projectId);
    if (access) return task;
  }
  return null;
}

export async function addCommentForUser(
  userId: string,
  userName: string | null,
  taskId: string,
  body: string,
): Promise<Result<{ id: string }>> {
  const clean = body.trim();
  if (!clean) return { ok: false, error: "Comment can't be empty" };
  if (clean.length > 4000) return { ok: false, error: "Comment too long" };

  const task = await accessibleTask(userId, taskId);
  if (!task) return { ok: false, error: "Task not found" };

  const comment = await prisma.comment.create({
    data: { taskId, userId, body: clean },
  });

  // Notify owner + assignee (not the commenter).
  const recipients = new Set<string>();
  if (task.userId !== userId) recipients.add(task.userId);
  if (task.assigneeId && task.assigneeId !== userId)
    recipients.add(task.assigneeId);
  const snippet = clean.length > 120 ? clean.slice(0, 120) + "…" : clean;
  for (const uid of recipients) {
    await notify(uid, {
      type: "COMMENT",
      title: `New comment on “${task.title}”`,
      body: snippet,
      entityType: "task",
      entityId: taskId,
    });
  }

  // @mentions
  const handles = [...clean.matchAll(/@([a-z0-9_]+)/gi)].map((m) =>
    m[1].toLowerCase(),
  );
  if (handles.length) {
    const mentioned = await prisma.user.findMany({
      where: { username: { in: handles } },
      select: { id: true },
    });
    for (const m of mentioned) {
      if (m.id === userId || recipients.has(m.id)) continue;
      await notify(m.id, {
        type: "MENTION",
        title: `${userName ?? "Someone"} mentioned you`,
        body: snippet,
        entityType: "task",
        entityId: taskId,
      });
    }
  }

  if (task.projectId) safeRevalidatePath(`/projects/${task.projectId}`);
  safeRevalidatePath("/tasks");
  return { ok: true, id: comment.id };
}

export async function addComment(
  taskId: string,
  body: string,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  return addCommentForUser(user.id, user.name ?? null, taskId, body);
}

export async function deleteComment(id: string): Promise<Result> {
  const user = await requireUser();
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { task: { select: { userId: true, projectId: true } } },
  });
  if (!comment) return { ok: false, error: "Comment not found" };
  if (comment.userId !== user.id && comment.task.userId !== user.id)
    return { ok: false, error: "Not allowed" };

  await prisma.comment.delete({ where: { id } });
  if (comment.task.projectId)
    safeRevalidatePath(`/projects/${comment.task.projectId}`);
  return { ok: true };
}
