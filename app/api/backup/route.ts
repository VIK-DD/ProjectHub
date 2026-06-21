import { NextResponse } from "next/server";
import { format } from "date-fns";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

// --- Export ----------------------------------------------------------------
export async function GET() {
  const userId = await getUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [projects, tasks, bugs, notes, milestones] = await Promise.all([
    prisma.project.findMany({ where: { userId } }),
    prisma.task.findMany({ where: { userId }, include: { subtasks: true } }),
    prisma.bug.findMany({ where: { userId } }),
    prisma.note.findMany({ where: { userId } }),
    prisma.milestone.findMany({ where: { project: { userId } } }),
  ]);

  const payload = {
    app: "ProjectHub",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { projects, tasks, bugs, notes, milestones },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="projecthub-backup-${format(new Date(), "yyyy-MM-dd")}.json"`,
    },
  });
}

// --- Import (replaces the current user's data) -----------------------------
function asDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body?.data;
  if (!data || body?.app !== "ProjectHub") {
    return NextResponse.json(
      { error: "This file is not a ProjectHub backup" },
      { status: 400 },
    );
  }

  const projects = Array.isArray(data.projects) ? data.projects : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const bugs = Array.isArray(data.bugs) ? data.bugs : [];
  const notes = Array.isArray(data.notes) ? data.notes : [];
  const milestones = Array.isArray(data.milestones) ? data.milestones : [];

  // Wipe the current user's existing content (children first).
  await prisma.subtask.deleteMany({ where: { task: { userId } } });
  await prisma.milestone.deleteMany({ where: { project: { userId } } });
  await prisma.note.deleteMany({ where: { userId } });
  await prisma.bug.deleteMany({ where: { userId } });
  await prisma.task.deleteMany({ where: { userId } });
  await prisma.project.deleteMany({ where: { userId } });
  await prisma.activityLog.deleteMany({ where: { userId } });

  // Recreate, remapping old ids → new ids.
  const projectMap = new Map<string, string>();
  for (const p of projects) {
    const created = await prisma.project.create({
      data: {
        userId,
        name: String(p.name ?? "Untitled"),
        description: p.description ?? null,
        status: p.status ?? "PLANNING",
        priority: p.priority ?? "MEDIUM",
        progress: Number(p.progress ?? 0),
        color: p.color ?? null,
        tags: p.tags ?? "",
        startDate: asDate(p.startDate),
        dueDate: asDate(p.dueDate),
      },
    });
    if (p.id) projectMap.set(p.id, created.id);
  }

  for (const t of tasks) {
    const created = await prisma.task.create({
      data: {
        userId,
        title: String(t.title ?? "Untitled"),
        description: t.description ?? null,
        status: t.status ?? "TODO",
        priority: t.priority ?? "MEDIUM",
        projectId: t.projectId ? (projectMap.get(t.projectId) ?? null) : null,
        dueDate: asDate(t.dueDate),
        notes: t.notes ?? null,
        recurrence: t.recurrence ?? null,
        timeSpent: Number(t.timeSpent ?? 0),
        completedAt: asDate(t.completedAt),
      },
    });
    const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
    for (const [i, s] of subs.entries()) {
      await prisma.subtask.create({
        data: {
          taskId: created.id,
          title: String(s.title ?? "Untitled"),
          completed: Boolean(s.completed),
          order: Number(s.order ?? i),
        },
      });
    }
  }

  for (const b of bugs) {
    await prisma.bug.create({
      data: {
        userId,
        title: String(b.title ?? "Untitled"),
        description: b.description ?? null,
        severity: b.severity ?? "MINOR",
        status: b.status ?? "OPEN",
        projectId: b.projectId ? (projectMap.get(b.projectId) ?? null) : null,
        stepsToReproduce: b.stepsToReproduce ?? null,
        fixNotes: b.fixNotes ?? null,
        resolvedAt: asDate(b.resolvedAt),
      },
    });
  }

  for (const n of notes) {
    await prisma.note.create({
      data: {
        userId,
        title: String(n.title ?? "Untitled"),
        content: n.content ?? "",
        pinned: Boolean(n.pinned),
        projectId: n.projectId ? (projectMap.get(n.projectId) ?? null) : null,
      },
    });
  }

  for (const m of milestones) {
    const projectId = m.projectId ? projectMap.get(m.projectId) : null;
    if (!projectId) continue;
    await prisma.milestone.create({
      data: {
        projectId,
        title: String(m.title ?? "Untitled"),
        completed: Boolean(m.completed),
        order: Number(m.order ?? 0),
        dueDate: asDate(m.dueDate),
      },
    });
  }

  await prisma.activityLog.create({
    data: {
      userId,
      action: "imported",
      entityType: "project",
      entityTitle: `Restored ${projects.length} project(s) from backup`,
    },
  });

  return NextResponse.json({
    ok: true,
    counts: {
      projects: projects.length,
      tasks: tasks.length,
      bugs: bugs.length,
      notes: notes.length,
      milestones: milestones.length,
    },
  });
}
