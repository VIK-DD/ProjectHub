import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  UPLOAD_DIR,
  canAccessProject,
  canAccessTask,
} from "@/lib/attachments-access";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const att = await prisma.attachment.findUnique({ where: { id: params.id } });
  if (!att)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let allowed = att.userId === userId;
  if (!allowed && att.taskId) allowed = await canAccessTask(userId, att.taskId);
  if (!allowed && att.projectId)
    allowed = await canAccessProject(userId, att.projectId);
  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const data = await readFile(path.join(UPLOAD_DIR, att.storedName));
    const isImage = att.mimeType.startsWith("image/");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename="${encodeURIComponent(att.filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
