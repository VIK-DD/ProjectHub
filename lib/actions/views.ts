"use server";

import { requireUser } from "@/lib/session";
import { firstError, type Result } from "@/lib/actions/helpers";
import {
  createSavedView,
  deleteSavedView,
  getSavedViews,
} from "@/lib/feature-store";
import { z } from "zod";

const entitySchema = z.enum(["tasks", "bugs", "projects", "notes"]);
type SavedViewEntity = z.infer<typeof entitySchema>;
const savedViewSchema = z.object({
  entityType: entitySchema,
  name: z.string().trim().min(1).max(60),
  filters: z.record(z.string()).default({}),
});

export async function listSavedViews(
  entityType: SavedViewEntity,
): Promise<Result<{ views: Awaited<ReturnType<typeof getSavedViews>> }>> {
  const user = await requireUser();
  const parsed = entitySchema.safeParse(entityType);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const views = await getSavedViews(user.id, parsed.data);
  return { ok: true, views };
}

export async function saveView(
  input: z.input<typeof savedViewSchema>,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = savedViewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const id = await createSavedView(
    user.id,
    parsed.data.entityType,
    parsed.data.name,
    parsed.data.filters,
  );
  return { ok: true, id };
}

export async function removeSavedView(id: string): Promise<Result> {
  const user = await requireUser();
  await deleteSavedView(user.id, id);
  return { ok: true };
}
