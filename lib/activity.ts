import { prisma } from "@/lib/prisma";
import { errorMessage, errorStack, logAppError } from "@/lib/error-logger";

type ActivityInput = {
  userId: string;
  action: string; // created | updated | completed | deleted | reopened ...
  entityType: "project" | "task" | "bug" | "note";
  entityTitle: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Record an activity-log entry. Best-effort: a logging failure must never break
 * the mutation that triggered it.
 */
export async function logActivity(input: ActivityInput) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityTitle: input.entityTitle,
        entityId: input.entityId ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch (err) {
    void logAppError({
      area: "activity-log",
      message: errorMessage(err),
      stack: errorStack(err),
      metadata: { entityType: input.entityType, action: input.action },
    });
  }
}
