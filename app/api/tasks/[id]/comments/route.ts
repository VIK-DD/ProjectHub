import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/access";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { userId: true, projectId: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let allowed = task.userId === userId;
  if (!allowed && task.projectId)
    allowed = Boolean(await getProjectAccess(userId, task.projectId));
  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comments = await prisma.comment.findMany({
    where: { taskId: params.id },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: c.user,
    })),
  });
}
