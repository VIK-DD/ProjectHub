import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getArchivedProjectIds, getSavedViews } from "@/lib/feature-store";

// Returns a compact index of the user's content for the ⌘K palette to filter
// client-side. Capped so it stays fast even with lots of data.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const archivedIds = [...(await getArchivedProjectIds(userId))];

  const [projects, tasks, bugs, notes, savedViews] = await Promise.all([
    prisma.project.findMany({
      where: archivedIds.length > 0 ? { userId, id: { notIn: archivedIds } } : { userId },
      select: { id: true, name: true, description: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.task.findMany({
      where:
        archivedIds.length > 0
          ? { userId, OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }] }
          : { userId },
      select: { id: true, title: true, description: true, notes: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.bug.findMany({
      where:
        archivedIds.length > 0
          ? { userId, OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }] }
          : { userId },
      select: { id: true, title: true, description: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.note.findMany({
      where:
        archivedIds.length > 0
          ? { userId, OR: [{ projectId: null }, { projectId: { notIn: archivedIds } }] }
          : { userId },
      select: { id: true, title: true, content: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    Promise.all([getSavedViews(userId, "tasks"), getSavedViews(userId, "bugs")]),
  ]);

  const notesOut = notes.map((n) => ({
    id: n.id,
    title: n.title,
    content: (n.content ?? "").slice(0, 300),
  }));

  return NextResponse.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description?.slice(0, 120) ?? "",
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: (task.description ?? task.notes ?? "").slice(0, 120),
    })),
    bugs: bugs.map((bug) => ({
      id: bug.id,
      title: bug.title,
      description: (bug.description ?? "").slice(0, 120),
    })),
    notes: notesOut,
    savedViews: savedViews.flat().map((view) => ({
      id: view.id,
      name: view.name,
      entityType: view.entityType,
      filters: view.filters,
    })),
  });
}
