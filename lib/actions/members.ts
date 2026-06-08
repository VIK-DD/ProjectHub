"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canManageMembers, getProjectAccess } from "@/lib/access";
import { notify } from "@/lib/notify";
import type { Result } from "@/lib/actions/helpers";

const ROLES = ["ADMIN", "MEMBER", "VIEWER"];

export async function addProjectMember(
  projectId: string,
  identifier: string,
  role: string = "MEMBER",
): Promise<Result> {
  const user = await requireUser();
  const access = await getProjectAccess(user.id, projectId);
  if (!access) return { ok: false, error: "Project not found" };
  if (!canManageMembers(access.role))
    return { ok: false, error: "Only owners and admins can add members" };

  const memberRole = ROLES.includes(role) ? role : "MEMBER";
  const id = identifier.trim().toLowerCase();
  if (!id) return { ok: false, error: "Enter an email or username" };

  const invitee = await prisma.user.findFirst({
    where: { OR: [{ email: id }, { username: id }] },
    select: { id: true, name: true, email: true },
  });
  if (!invitee)
    return {
      ok: false,
      error: "No ProjectHub user with that email or username (they must register first)",
    };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, name: true },
  });
  if (!project) return { ok: false, error: "Project not found" };
  if (invitee.id === project.userId)
    return { ok: false, error: "That user already owns this project" };

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: invitee.id } },
  });
  if (existing) return { ok: false, error: "Already a member" };

  await prisma.projectMember.create({
    data: { projectId, userId: invitee.id, role: memberRole },
  });

  await notify(invitee.id, {
    type: "PROJECT",
    title: `You were added to “${project.name}”`,
    body: `${user.name ?? "Someone"} added you as ${memberRole.toLowerCase()}.`,
    entityType: "project",
    entityId: projectId,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { ok: true };
}

async function loadManagedMember(userId: string, memberId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { id: memberId },
    select: { id: true, projectId: true, userId: true },
  });
  if (!member) return null;
  const access = await getProjectAccess(userId, member.projectId);
  if (!access || !canManageMembers(access.role)) return null;
  return member;
}

export async function removeProjectMember(memberId: string): Promise<Result> {
  const user = await requireUser();
  const member = await loadManagedMember(user.id, memberId);
  if (!member) return { ok: false, error: "Not allowed" };

  await prisma.projectMember.delete({ where: { id: memberId } });
  revalidatePath(`/projects/${member.projectId}`);
  return { ok: true };
}

export async function updateMemberRole(
  memberId: string,
  role: string,
): Promise<Result> {
  const user = await requireUser();
  if (!ROLES.includes(role)) return { ok: false, error: "Invalid role" };
  const member = await loadManagedMember(user.id, memberId);
  if (!member) return { ok: false, error: "Not allowed" };

  await prisma.projectMember.update({ where: { id: memberId }, data: { role } });
  revalidatePath(`/projects/${member.projectId}`);
  return { ok: true };
}
