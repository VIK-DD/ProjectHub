"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canManageMembers, getProjectAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import {
  archiveProjectRecord,
  unarchiveProjectRecord,
} from "@/lib/feature-store";
import {
  PRIORITY_VALUES,
  PROJECT_STATUS_VALUES,
} from "@/lib/constants";
import { firstError, toDate, type Result } from "@/lib/actions/helpers";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120),
  description: z.string().trim().max(4000).optional().default(""),
  status: z.enum(PROJECT_STATUS_VALUES as [string, ...string[]]),
  priority: z.enum(PRIORITY_VALUES as [string, ...string[]]),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  tags: z.string().trim().max(300).optional().default(""),
  color: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  dueDate: z.string().optional().default(""),
});

export type ProjectInput = z.input<typeof projectSchema>;

function revalidate(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/analytics");
  if (id) revalidatePath(`/projects/${id}`);
}

export async function createProject(
  input: ProjectInput,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const project = await prisma.project.create({
    data: {
      name: d.name,
      description: d.description || null,
      status: d.status,
      priority: d.priority,
      progress: d.progress,
      tags: d.tags ?? "",
      color: d.color || null,
      startDate: toDate(d.startDate),
      dueDate: toDate(d.dueDate),
      userId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    action: "created",
    entityType: "project",
    entityId: project.id,
    entityTitle: project.name,
  });

  revalidate(project.id);
  return { ok: true, id: project.id };
}

export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<Result> {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  // Owners and admins can edit project settings.
  const access = await getProjectAccess(user.id, id);
  if (!access || !canManageMembers(access.role))
    return { ok: false, error: "Not allowed to edit this project" };
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Project not found" };

  const d = parsed.data;
  await prisma.project.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description || null,
      status: d.status,
      priority: d.priority,
      progress: d.progress,
      tags: d.tags ?? "",
      color: d.color || null,
      startDate: toDate(d.startDate),
      dueDate: toDate(d.dueDate),
    },
  });

  await logActivity({
    userId: user.id,
    action: existing.status !== d.status && d.status === "COMPLETED"
      ? "completed"
      : "updated",
    entityType: "project",
    entityId: id,
    entityTitle: d.name,
  });

  revalidate(id);
  return { ok: true };
}

export async function deleteProject(id: string): Promise<Result> {
  const user = await requireUser();
  const existing = await prisma.project.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { ok: false, error: "Project not found" };

  // Soft delete the project and cascade-hide its content (recoverable together).
  const now = new Date();
  await prisma.project.update({ where: { id }, data: { deletedAt: now } });
  await Promise.all([
    prisma.task.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
    prisma.bug.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
    prisma.note.updateMany({ where: { projectId: id }, data: { deletedAt: now } }),
  ]);

  await logActivity({
    userId: user.id,
    action: "deleted",
    entityType: "project",
    entityId: id,
    entityTitle: existing.name,
  });

  revalidate(id);
  revalidatePath("/trash");
  return { ok: true };
}

export async function archiveProject(id: string): Promise<Result> {
  const user = await requireUser();
  const existing = await prisma.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!existing) return { ok: false, error: "Project not found" };

  await archiveProjectRecord(user.id, id);
  await logActivity({
    userId: user.id,
    action: "archived",
    entityType: "project",
    entityId: id,
    entityTitle: existing.name,
  });

  revalidate(id);
  return { ok: true };
}

export async function unarchiveProject(id: string): Promise<Result> {
  const user = await requireUser();
  const existing = await prisma.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!existing) return { ok: false, error: "Project not found" };

  await unarchiveProjectRecord(user.id, id);
  await logActivity({
    userId: user.id,
    action: "restored",
    entityType: "project",
    entityId: id,
    entityTitle: existing.name,
    meta: { source: "archive" },
  });

  revalidate(id);
  return { ok: true };
}
