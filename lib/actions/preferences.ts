"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ACCENT_KEYS } from "@/lib/accents";
import { firstError, type Result } from "@/lib/actions/helpers";

const prefsSchema = z.object({
  notifyMorning: z.boolean(),
  morningHour: z.coerce.number().int().min(0).max(23),
  notifyEvening: z.boolean(),
  eveningHour: z.coerce.number().int().min(0).max(23),
  notifyAssigned: z.boolean(),
  notifyComments: z.boolean(),
  notifyMentions: z.boolean(),
  notifyReminders: z.boolean(),
});

export type PrefsInput = z.input<typeof prefsSchema>;

export async function updateNotificationPrefs(
  input: PrefsInput,
): Promise<Result> {
  const user = await requireUser();
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateAccent(accent: string): Promise<Result> {
  const user = await requireUser();
  if (!ACCENT_KEYS.includes(accent as never))
    return { ok: false, error: "Invalid accent" };
  await prisma.user.update({
    where: { id: user.id },
    data: { accentColor: accent },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
