import { prisma } from "@/lib/prisma";

export type ProjectRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

// A project is accessible if you own it or you're a member.
export function accessibleProjectsWhere(userId: string) {
  return { OR: [{ userId }, { members: { some: { userId } } }] };
}

export async function getProjectAccess(
  userId: string,
  projectId: string,
): Promise<{ role: ProjectRole; isOwner: boolean } | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleProjectsWhere(userId) },
    select: { userId: true, members: { where: { userId }, select: { role: true } } },
  });
  if (!project) return null;
  if (project.userId === userId) return { role: "OWNER", isOwner: true };
  return {
    role: (project.members[0]?.role as ProjectRole) ?? "MEMBER",
    isOwner: false,
  };
}

export function canManageMembers(role: ProjectRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canEditProject(role: ProjectRole) {
  return role !== "VIEWER";
}

// Returns the projectId only if the user may attach things to it.
export async function resolveAccessibleProjectId(
  userId: string,
  projectId?: string | null,
) {
  if (!projectId) return null;
  const p = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleProjectsWhere(userId) },
    select: { id: true },
  });
  return p?.id ?? null;
}

// All users who can be assigned within a project (owner + members).
export async function getProjectMemberUsers(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
      user: { select: { id: true, name: true, image: true } },
      members: {
        select: { user: { select: { id: true, name: true, image: true } } },
      },
    },
  });
  if (!project) return [];
  const users = [project.user, ...project.members.map((m) => m.user)];
  // de-dupe by id
  return [...new Map(users.map((u) => [u.id, u])).values()];
}
