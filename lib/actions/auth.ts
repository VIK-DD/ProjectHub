"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { seedStarterData } from "@/lib/starter";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterResult = { ok: true } | { ok: false; error: string };

export async function registerUser(
  values: z.input<typeof registerSchema>,
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  // Give the new account a friendly starting point (best-effort).
  try {
    await seedStarterData(user.id);
  } catch (err) {
    console.error("[register] starter data failed:", err);
  }

  return { ok: true };
}
