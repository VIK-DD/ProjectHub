"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { Result } from "@/lib/actions/helpers";

function safeRevalidateLayout() {
  try {
    revalidatePath("/", "layout");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("static generation store missing")) throw error;
  }
}

export async function markNotificationReadForUser(
  userId: string,
  id: string,
): Promise<Result> {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  safeRevalidateLayout();
  return { ok: true };
}

export async function markNotificationRead(id: string): Promise<Result> {
  const user = await requireUser();
  return markNotificationReadForUser(user.id, id);
}

export async function markAllNotificationsReadForUser(
  userId: string,
): Promise<Result> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  safeRevalidateLayout();
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<Result> {
  const user = await requireUser();
  return markAllNotificationsReadForUser(user.id);
}
