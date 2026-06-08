"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { resolveAccessibleProjectId } from "@/lib/access";
import { BUG_SEVERITY_VALUES, BUG_STATUS_VALUES } from "@/lib/constants";
import { firstError, type Result } from "@/lib/actions/helpers";

const RESOLVED = ["FIXED", "CLOSED"];

const bugSchema = z.object({
  title: z.string().trim().min(1, "Bug title is required").max(200),
  description: z.string().trim().max(4000).optional().default(""),
  severity: z.enum(BUG_SEVERITY_VALUES as [string, ...string[]]),
  status: z.enum(BUG_STATUS_VALUES as [string, ...string[]]),
  projectId: z.string().optional().default(""),
  stepsToReproduce: z.string().trim().max(4000).optional().default(""),
  fixNotes: z.string().trim().max(4000).optional().default(""),
});

export type BugInput = z.input<typeof bugSchema>;

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/bugs");
  revalidatePath("/projects");
  revalidatePath("/analytics");
}

async function resolveProjectId(userId: string, projectId?: string) {
  return resolveAccessibleProjectId(userId, projectId);
}

export async function createBug(
  input: BugInput,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = bugSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const projectId = await resolveProjectId(user.id, d.projectId);

  const bug = await prisma.bug.create({
    data: {
      title: d.title,
      description: d.description || null,
      severity: d.severity,
      status: d.status,
      projectId,
      stepsToReproduce: d.stepsToReproduce || null,
      fixNotes: d.fixNotes || null,
      resolvedAt: RESOLVED.includes(d.status) ? new Date() : null,
      userId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    action: "created",
    entityType: "bug",
    entityId: bug.id,
    entityTitle: bug.title,
  });

  revalidate();
  return { ok: true, id: bug.id };
}

export async function updateBug(id: string, input: BugInput): Promise<Result> {
  const user = await requireUser();
  const parsed = bugSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const existing = await prisma.bug.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { ok: false, error: "Bug not found" };

  const d = parsed.data;
  const projectId = await resolveProjectId(user.id, d.projectId);
  const nowResolved = RESOLVED.includes(d.status);

  await prisma.bug.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description || null,
      severity: d.severity,
      status: d.status,
      projectId,
      stepsToReproduce: d.stepsToReproduce || null,
      fixNotes: d.fixNotes || null,
      resolvedAt: nowResolved ? existing.resolvedAt ?? new Date() : null,
    },
  });

  await logActivity({
    userId: user.id,
    action:
      !RESOLVED.includes(existing.status) && nowResolved ? "fixed" : "updated",
    entityType: "bug",
    entityId: id,
    entityTitle: d.title,
  });

  revalidate();
  return { ok: true };
}

export async function updateBugStatus(
  id: string,
  status: string,
): Promise<Result> {
  const user = await requireUser();
  if (!BUG_STATUS_VALUES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  const existing = await prisma.bug.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { ok: false, error: "Bug not found" };

  const nowResolved = RESOLVED.includes(status);
  await prisma.bug.update({
    where: { id },
    data: {
      status,
      resolvedAt: nowResolved ? existing.resolvedAt ?? new Date() : null,
    },
  });

  await logActivity({
    userId: user.id,
    action: nowResolved ? "fixed" : "updated",
    entityType: "bug",
    entityId: id,
    entityTitle: existing.title,
  });

  revalidate();
  return { ok: true };
}

export async function bulkUpdateBugStatus(
  ids: string[],
  status: string,
): Promise<Result> {
  const user = await requireUser();
  if (!BUG_STATUS_VALUES.includes(status))
    return { ok: false, error: "Invalid status" };
  if (ids.length === 0) return { ok: true };

  await prisma.bug.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: {
      status,
      resolvedAt: RESOLVED.includes(status) ? new Date() : null,
    },
  });
  revalidate();
  return { ok: true };
}

export async function bulkDeleteBugs(ids: string[]): Promise<Result> {
  const user = await requireUser();
  if (ids.length === 0) return { ok: true };

  await prisma.bug.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: { deletedAt: new Date() },
  });
  revalidate();
  revalidatePath("/trash");
  return { ok: true };
}

export async function bulkRestoreBugs(ids: string[]): Promise<Result> {
  const user = await requireUser();
  if (ids.length === 0) return { ok: true };

  await prisma.bug.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: { deletedAt: null },
  });
  revalidate();
  revalidatePath("/trash");
  return { ok: true };
}

export async function bulkUpdateBugSeverity(
  ids: string[],
  severity: string,
): Promise<Result> {
  const user = await requireUser();
  if (!BUG_SEVERITY_VALUES.includes(severity))
    return { ok: false, error: "Invalid severity" };
  if (ids.length === 0) return { ok: true };

  await prisma.bug.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: { severity },
  });
  revalidate();
  return { ok: true };
}

export async function deleteBug(id: string): Promise<Result> {
  const user = await requireUser();
  const existing = await prisma.bug.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { ok: false, error: "Bug not found" };

  await prisma.bug.update({ where: { id }, data: { deletedAt: new Date() } });

  await logActivity({
    userId: user.id,
    action: "deleted",
    entityType: "bug",
    entityId: id,
    entityTitle: existing.title,
  });

  revalidate();
  revalidatePath("/trash");
  return { ok: true };
}
