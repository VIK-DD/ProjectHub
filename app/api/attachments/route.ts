import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_SIZE,
  UPLOAD_DIR,
  canAccessProject,
  canAccessTask,
} from "@/lib/attachments-access";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const taskId = (form.get("taskId") as string) || null;
  const projectId = (form.get("projectId") as string) || null;

  if (!(file instanceof File))
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size === 0)
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  if (!taskId && !projectId)
    return NextResponse.json({ error: "Missing target" }, { status: 400 });

  const allowed = taskId
    ? await canAccessTask(userId, taskId)
    : await canAccessProject(userId, projectId!);
  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = (file.name.split(".").pop() || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toLowerCase();
  const storedName = `${randomUUID()}${ext ? "." + ext : ""}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  const attachment = await prisma.attachment.create({
    data: {
      filename: file.name.slice(0, 200),
      storedName,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      userId,
      taskId,
      projectId,
    },
  });

  return NextResponse.json({ ok: true, id: attachment.id });
}
