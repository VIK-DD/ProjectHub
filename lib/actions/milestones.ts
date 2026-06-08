"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { toDate, type Result } from "@/lib/actions/helpers";

async function ownsProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return Boolean(project);
}

async function milestoneOwnerProject(userId: string, id: string) {
  const m = await prisma.milestone.findUnique({
    where: { id },
    include: { project: { select: { userId: true, id: true } } },
  });
  if (!m || m.project.userId !== userId) return null;
  return m.project.id;
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function addMilestone(
  projectId: string,
  title: string,
  dueDate?: string,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const clean = title.trim();
  if (!clean) return { ok: false, error: "Milestone title is required" };
  if (!(await ownsProject(user.id, projectId)))
    return { ok: false, error: "Project not found" };

  const count = await prisma.milestone.count({ where: { projectId } });
  const milestone = await prisma.milestone.create({
    data: { projectId, title: clean, order: count, dueDate: toDate(dueDate) },
  });

  revalidate(projectId);
  return { ok: true, id: milestone.id };
}

export async function toggleMilestone(id: string): Promise<Result> {
  const user = await requireUser();
  const projectId = await milestoneOwnerProject(user.id, id);
  if (!projectId) return { ok: false, error: "Milestone not found" };

  const m = await prisma.milestone.findUnique({ where: { id } });
  await prisma.milestone.update({
    where: { id },
    data: { completed: !m!.completed },
  });

  revalidate(projectId);
  return { ok: true };
}

export async function deleteMilestone(id: string): Promise<Result> {
  const user = await requireUser();
  const projectId = await milestoneOwnerProject(user.id, id);
  if (!projectId) return { ok: false, error: "Milestone not found" };

  await prisma.milestone.delete({ where: { id } });

  revalidate(projectId);
  return { ok: true };
}
