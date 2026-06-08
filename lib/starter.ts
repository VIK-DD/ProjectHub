import { prisma } from "@/lib/prisma";

// Gives a brand-new account a friendly, non-empty starting point.
export async function seedStarterData(userId: string) {
  const project = await prisma.project.create({
    data: {
      userId,
      name: "Getting started",
      description:
        "A sample project to show you around ProjectHub. Edit or delete it whenever you like.",
      status: "ACTIVE",
      priority: "MEDIUM",
      progress: 33,
      color: "#6366f1",
      tags: "welcome",
    },
  });

  await prisma.task.createMany({
    data: [
      {
        userId,
        projectId: project.id,
        title: "Explore the Kanban board",
        status: "TODO",
        priority: "MEDIUM",
      },
      {
        userId,
        projectId: project.id,
        title: "Create your first real project",
        status: "TODO",
        priority: "HIGH",
      },
      {
        userId,
        projectId: project.id,
        title: "Sign in to ProjectHub",
        status: "DONE",
        priority: "LOW",
        completedAt: new Date(),
      },
    ],
  });

  await prisma.note.create({
    data: {
      userId,
      projectId: project.id,
      title: "Welcome to ProjectHub",
      pinned: true,
      content:
        "# Welcome 👋\n\nThis is a note with **markdown** support.\n\n- [x] Sign in\n- [ ] Add a task\n- [ ] Create a project\n\nTip: press **⌘K** (or Ctrl-K) to search and jump around.",
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "created",
      entityType: "project",
      entityTitle: "Getting started",
    },
  });
}
