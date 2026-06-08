"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { firstError, type Result } from "@/lib/actions/helpers";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  image: z.string().trim().url("Enter a valid image URL").or(z.literal("")),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3–20 chars: letters, numbers, underscore")
    .or(z.literal("")),
});

export type ProfileInput = z.input<typeof profileSchema>;

export async function updateProfile(
  input: ProfileInput,
): Promise<Result<{ name: string; email: string; image: string | null }>> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, email, image, username } = parsed.data;

  // If the email changed, make sure it isn't taken by someone else.
  if (email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== user.id) {
      return { ok: false, error: "That email is already in use" };
    }
  }

  // Username must be unique (used for @mentions and project invites).
  if (username) {
    const taken = await prisma.user.findFirst({
      where: { username, id: { not: user.id } },
      select: { id: true },
    });
    if (taken) return { ok: false, error: "That username is taken" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, email, image: image || null, username: username || null },
  });

  return { ok: true, name, email, image: image || null };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must be different",
    path: ["newPassword"],
  });

export type PasswordInput = z.input<typeof passwordSchema>;

export async function changePassword(
  input: PasswordInput,
): Promise<Result> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return { ok: false, error: "Account not found" };

  const valid = await bcrypt.compare(
    parsed.data.currentPassword,
    record.passwordHash,
  );
  if (!valid) return { ok: false, error: "Current password is incorrect" };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return { ok: true };
}
