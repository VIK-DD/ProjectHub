"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  UPLOAD_DIR,
  canAccessProject,
  canAccessTask,
} from "@/lib/attachments-access";
import type { Result } from "@/lib/actions/helpers";

export async function deleteAttachment(id: string): Promise<Result> {
  const user = await requireUser();
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return { ok: false, error: "Attachment not found" };

  let allowed = att.userId === user.id;
  if (!allowed && att.taskId) allowed = await canAccessTask(user.id, att.taskId);
  if (!allowed && att.projectId)
    allowed = await canAccessProject(user.id, att.projectId);
  if (!allowed) return { ok: false, error: "Not allowed" };

  await prisma.attachment.delete({ where: { id } });
  try {
    await unlink(path.join(UPLOAD_DIR, att.storedName));
  } catch {
    /* file already gone — ignore */
  }

  if (att.taskId) revalidatePath(`/tasks/${att.taskId}`);
  if (att.projectId) revalidatePath(`/projects/${att.projectId}`);
  return { ok: true };
}
