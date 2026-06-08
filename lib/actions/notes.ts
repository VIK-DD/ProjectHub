"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { resolveAccessibleProjectId } from "@/lib/access";
import { firstError, type Result } from "@/lib/actions/helpers";

const noteSchema = z.object({
  title: z.string().trim().min(1, "Note title is required").max(200),
  content: z.string().max(50000).optional().default(""),
  projectId: z.string().optional().default(""),
  pinned: z.boolean().optional().default(false),
});

export type NoteInput = z.input<typeof noteSchema>;

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("static generation store missing")) throw error;
  }
}

function revalidate() {
  safeRevalidatePath("/dashboard");
  safeRevalidatePath("/notes");
  safeRevalidatePath("/projects");
}

function revalidateTaskTargets(projectId?: string | null) {
  safeRevalidatePath("/tasks");
  safeRevalidatePath("/dashboard");
  safeRevalidatePath("/today");
  safeRevalidatePath("/calendar");
  safeRevalidatePath("/analytics");
  safeRevalidatePath("/projects");
  if (projectId) safeRevalidatePath(`/projects/${projectId}`);
}

function revalidateBugTargets(projectId?: string | null) {
  safeRevalidatePath("/bugs");
  safeRevalidatePath("/dashboard");
  safeRevalidatePath("/analytics");
  safeRevalidatePath("/projects");
  if (projectId) safeRevalidatePath(`/projects/${projectId}`);
}

async function resolveProjectId(userId: string, projectId?: string) {
  return resolveAccessibleProjectId(userId, projectId);
}

export async function createNoteForUser(
  userId: string,
  input: NoteInput,
): Promise<Result<{ id: string }>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const projectId = await resolveProjectId(userId, d.projectId);
  const note = await prisma.note.create({
    data: {
      title: d.title,
      content: d.content ?? "",
      pinned: d.pinned ?? false,
      projectId,
      userId,
    },
  });

  await logActivity({
    userId,
    action: "created",
    entityType: "note",
    entityId: note.id,
    entityTitle: note.title,
  });

  revalidate();
  return { ok: true, id: note.id };
}

export async function createNote(
  input: NoteInput,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  return createNoteForUser(user.id, input);
}

export async function updateNoteForUser(
  userId: string,
  id: string,
  input: NoteInput,
): Promise<Result> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const existing = await prisma.note.findFirst({
    where: { id, userId },
  });
  if (!existing) return { ok: false, error: "Note not found" };

  const d = parsed.data;
  const projectId = await resolveProjectId(userId, d.projectId);

  await prisma.note.update({
    where: { id },
    data: {
      title: d.title,
      content: d.content ?? "",
      pinned: d.pinned ?? false,
      projectId,
    },
  });

  revalidate();
  return { ok: true };
}

export async function updateNote(id: string, input: NoteInput): Promise<Result> {
  const user = await requireUser();
  return updateNoteForUser(user.id, id, input);
}

export async function toggleNotePin(id: string): Promise<Result> {
  const user = await requireUser();
  const existing = await prisma.note.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { ok: false, error: "Note not found" };

  await prisma.note.update({
    where: { id },
    data: { pinned: !existing.pinned },
  });

  revalidate();
  return { ok: true };
}

export async function deleteNoteForUser(
  userId: string,
  id: string,
): Promise<Result> {
  const existing = await prisma.note.findFirst({
    where: { id, userId },
  });
  if (!existing) return { ok: false, error: "Note not found" };

  await prisma.note.update({ where: { id }, data: { deletedAt: new Date() } });

  await logActivity({
    userId,
    action: "deleted",
    entityType: "note",
    entityId: id,
    entityTitle: existing.title,
  });

  revalidate();
  safeRevalidatePath("/trash");
  return { ok: true };
}

export async function deleteNote(id: string): Promise<Result> {
  const user = await requireUser();
  return deleteNoteForUser(user.id, id);
}

export async function convertNoteToTask(
  id: string,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const note = await prisma.note.findFirst({
    where: { id, userId: user.id },
    select: { id: true, title: true, content: true, projectId: true },
  });
  if (!note) return { ok: false, error: "Note not found" };

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title: note.title,
      description: note.content.slice(0, 4000) || null,
      status: "TODO",
      priority: "MEDIUM",
      projectId: note.projectId,
      notes: `Created from note "${note.title}"`,
    },
  });

  await logActivity({
    userId: user.id,
    action: "converted",
    entityType: "task",
    entityId: task.id,
    entityTitle: task.title,
    meta: { fromType: "note", fromId: note.id, fromTitle: note.title },
  });

  revalidateTaskTargets(note.projectId);
  return { ok: true, id: task.id };
}

export async function convertNoteToBug(
  id: string,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const note = await prisma.note.findFirst({
    where: { id, userId: user.id },
    select: { id: true, title: true, content: true, projectId: true },
  });
  if (!note) return { ok: false, error: "Note not found" };

  const bug = await prisma.bug.create({
    data: {
      userId: user.id,
      title: note.title,
      description: note.content.slice(0, 4000) || null,
      severity: "MAJOR",
      status: "OPEN",
      projectId: note.projectId,
      stepsToReproduce: note.content.slice(0, 4000) || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "converted",
    entityType: "bug",
    entityId: bug.id,
    entityTitle: bug.title,
    meta: { fromType: "note", fromId: note.id, fromTitle: note.title },
  });

  revalidateBugTargets(note.projectId);
  return { ok: true, id: bug.id };
}
