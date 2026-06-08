import type { z } from "zod";

// A consistent result shape for every server action.
export type Result<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export function firstError(error: z.ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

/** Convert a form date string ("YYYY-MM-DD" or ISO) into a Date or null. */
export function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
