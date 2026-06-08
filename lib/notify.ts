import { prisma } from "@/lib/prisma";
import { errorMessage, errorStack, logAppError } from "@/lib/error-logger";

export async function notify(
  userId: string,
  data: {
    type: string;
    title: string;
    body?: string | null;
    entityType?: string | null;
    entityId?: string | null;
  },
) {
  try {
    // Respect the recipient's notification preferences.
    const prefs = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notifyAssigned: true,
        notifyComments: true,
        notifyMentions: true,
      },
    });
    if (prefs) {
      if (data.type === "ASSIGNED" && !prefs.notifyAssigned) return;
      if (data.type === "COMMENT" && !prefs.notifyComments) return;
      if (data.type === "MENTION" && !prefs.notifyMentions) return;
    }

    await prisma.notification.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        entityType: data.entityType ?? null,
        entityId: data.entityId ?? null,
      },
    });
  } catch (err) {
    void logAppError({
      area: "notify",
      message: errorMessage(err),
      stack: errorStack(err),
      metadata: { userId, type: data.type, entityId: data.entityId ?? null },
    });
  }
}
