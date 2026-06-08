import path from "node:path";

import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/access";

// Files live on the Pi's disk, outside the build, so they survive redeploys.
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
export const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function canAccessTask(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true, assigneeId: true, projectId: true },
  });
  if (!task) return false;
  if (task.userId === userId || task.assigneeId === userId) return true;
  if (task.projectId)
    return Boolean(await getProjectAccess(userId, task.projectId));
  return false;
}

export async function canAccessProject(userId: string, projectId: string) {
  return Boolean(await getProjectAccess(userId, projectId));
}
