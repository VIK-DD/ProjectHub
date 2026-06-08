"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { Result } from "@/lib/actions/helpers";

// Unambiguous alphabet (no 0/O/1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export async function generateTelegramCode(): Promise<Result<{ code: string }>> {
  const user = await requireUser();

  // One active code at a time.
  await prisma.telegramLinkToken.deleteMany({ where: { userId: user.id } });

  const code = makeCode();
  await prisma.telegramLinkToken.create({
    data: {
      code,
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    },
  });

  return { ok: true, code };
}

export async function disconnectTelegram(): Promise<Result> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: null, telegramLinkedAt: null },
  });
  await prisma.telegramLinkToken.deleteMany({ where: { userId: user.id } });
  revalidatePath("/settings");
  return { ok: true };
}
