"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import type { Result } from "@/lib/actions/helpers";

function revalidateAll() {
  for (const p of [
    "/trash",
    "/dashboard",
    "/today",
    "/projects",
    "/tasks",
    "/bugs",
    "/notes",
    "/calendar",
    "/analytics",
  ])
    safeRevalidatePath(p);
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("static generation store missing")) throw error;
  }
}

// --- Restore ---------------------------------------------------------------
export async function restoreTask(id: string): Promise<Result> {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id },
    select: { title: true, userId: true },
  });
  await prisma.task.updateMany({
    where: { id, userId: user.id },
    data: { deletedAt: null },
  });
  if (task?.userId === user.id) {
    await logActivity({
      userId: user.id,
      action: "restored",
      entityType: "task",
      entityId: id,
      entityTitle: task.title,
    });
  }
  revalidateAll();
  return { ok: true };
}

export async function restoreBug(id: string): Promise<Result> {
  const user = await requireUser();
  const bug = await prisma.bug.findUnique({
    where: { id },
    select: { title: true, userId: true },
  });
  await prisma.bug.updateMany({
    where: { id, userId: user.id },
    data: { deletedAt: null },
  });
  if (bug?.userId === user.id) {
    await logActivity({
      userId: user.id,
      action: "restored",
      entityType: "bug",
      entityId: id,
      entityTitle: bug.title,
    });
  }
  revalidateAll();
  return { ok: true };
}

export async function restoreNoteForUser(userId: string, id: string): Promise<Result> {
  const note = await prisma.note.findUnique({
    where: { id },
    select: { title: true, userId: true },
  });
  await prisma.note.updateMany({
    where: { id, userId },
    data: { deletedAt: null },
  });
  if (note?.userId === userId) {
    await logActivity({
      userId,
      action: "restored",
      entityType: "note",
      entityId: id,
      entityTitle: note.title,
    });
  }
  revalidateAll();
  return { ok: true };
}

export async function restoreNote(id: string): Promise<Result> {
  const user = await requireUser();
  return restoreNoteForUser(user.id, id);
}

export async function restoreProject(id: string): Promise<Result> {
  const user = await requireUser();
  const existing = await prisma.project.findUnique({
    where: { id },
    select: { name: true, userId: true },
  });
  const project = await prisma.project.updateMany({
    where: { id, userId: user.id },
    data: { deletedAt: null },
  });
  if (project.count === 0) return { ok: false, error: "Not found" };
  // Bring back its content too.
  await Promise.all([
    prisma.task.updateMany({ where: { projectId: id }, data: { deletedAt: null } }),
    prisma.bug.updateMany({ where: { projectId: id }, data: { deletedAt: null } }),
    prisma.note.updateMany({ where: { projectId: id }, data: { deletedAt: null } }),
  ]);
  if (existing?.userId === user.id) {
    await logActivity({
      userId: user.id,
      action: "restored",
      entityType: "project",
      entityId: id,
      entityTitle: existing.name,
    });
  }
  revalidateAll();
  return { ok: true };
}

// --- Permanent delete ------------------------------------------------------
export async function purgeTask(id: string): Promise<Result> {
  const user = await requireUser();
  await prisma.task.deleteMany({ where: { id, userId: user.id } });
  safeRevalidatePath("/trash");
  return { ok: true };
}

export async function purgeBug(id: string): Promise<Result> {
  const user = await requireUser();
  await prisma.bug.deleteMany({ where: { id, userId: user.id } });
  safeRevalidatePath("/trash");
  return { ok: true };
}

export async function purgeNote(id: string): Promise<Result> {
  const user = await requireUser();
  await prisma.note.deleteMany({ where: { id, userId: user.id } });
  safeRevalidatePath("/trash");
  return { ok: true };
}

export async function purgeProject(id: string): Promise<Result> {
  const user = await requireUser();
  const owned = await prisma.project.findFirst({
    where: { id, userId: user.id, deletedAt: { not: null } },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Not found" };
  await Promise.all([
    prisma.task.deleteMany({ where: { projectId: id } }),
    prisma.bug.deleteMany({ where: { projectId: id } }),
    prisma.note.deleteMany({ where: { projectId: id } }),
  ]);
  await prisma.project.delete({ where: { id } });
  safeRevalidatePath("/trash");
  return { ok: true };
}
