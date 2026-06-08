import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@projecthub.local";
const DEMO_PASSWORD = "demo1234";

const day = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * day);
const daysAhead = (n: number) => new Date(Date.now() + n * day);

async function main() {
  console.log("→ Seeding ProjectHub demo data…");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, name: "Demo User" },
    create: { email: DEMO_EMAIL, name: "Demo User", passwordHash },
  });

  // Make re-seeding idempotent: wipe this user's content first.
  await prisma.activityLog.deleteMany({ where: { userId: user.id } });
  await prisma.note.deleteMany({ where: { userId: user.id } });
  await prisma.bug.deleteMany({ where: { userId: user.id } });
  await prisma.task.deleteMany({ where: { userId: user.id } });
  await prisma.project.deleteMany({ where: { userId: user.id } });

  const userId = user.id;

  const portfolio = await prisma.project.create({
    data: {
      userId,
      name: "Portfolio Website",
      description:
        "A fast, minimalist personal site to showcase projects and writing.",
      status: "ACTIVE",
      priority: "HIGH",
      progress: 60,
      color: "#6366f1",
      tags: "web, nextjs, design",
      startDate: daysAgo(20),
      dueDate: daysAhead(10),
    },
  });

  const mobile = await prisma.project.create({
    data: {
      userId,
      name: "Mobile App MVP",
      description: "Cross-platform habit tracker — building the first release.",
      status: "PLANNING",
      priority: "CRITICAL",
      progress: 15,
      color: "#ec4899",
      tags: "mobile, react-native",
      startDate: daysAgo(5),
      dueDate: daysAhead(45),
    },
  });

  const cli = await prisma.project.create({
    data: {
      userId,
      name: "Open Source CLI",
      description: "A developer tool for scaffolding projects from templates.",
      status: "ON_HOLD",
      priority: "MEDIUM",
      progress: 40,
      color: "#06b6d4",
      tags: "cli, typescript, oss",
      startDate: daysAgo(60),
    },
  });

  const blog = await prisma.project.create({
    data: {
      userId,
      name: "Blog Platform",
      description: "A markdown-powered blog. Shipped and stable.",
      status: "COMPLETED",
      priority: "LOW",
      progress: 100,
      color: "#10b981",
      tags: "web, markdown",
      startDate: daysAgo(120),
      dueDate: daysAgo(30),
    },
  });

  // --- Tasks (with completedAt spread across recent days/weeks) -------------
  const tasks = [
    { project: portfolio, title: "Design the landing hero", status: "DONE", priority: "HIGH", completedAt: daysAgo(1) },
    { project: portfolio, title: "Build projects grid", status: "IN_PROGRESS", priority: "HIGH", dueDate: daysAhead(3) },
    { project: portfolio, title: "Write about page copy", status: "TODO", priority: "MEDIUM", dueDate: daysAhead(6) },
    { project: portfolio, title: "Add dark mode toggle", status: "DONE", priority: "MEDIUM", completedAt: daysAgo(3) },
    { project: portfolio, title: "Lighthouse performance pass", status: "REVIEW", priority: "LOW" },
    { project: mobile, title: "Set up navigation", status: "IN_PROGRESS", priority: "CRITICAL", dueDate: daysAhead(2) },
    { project: mobile, title: "Onboarding flow wireframes", status: "TODO", priority: "HIGH" },
    { project: mobile, title: "Choose state management", status: "DONE", priority: "MEDIUM", completedAt: daysAgo(6) },
    { project: cli, title: "Template resolver refactor", status: "TODO", priority: "MEDIUM" },
    { project: cli, title: "Add `init` command", status: "DONE", priority: "HIGH", completedAt: daysAgo(12) },
    { project: cli, title: "Write usage docs", status: "DONE", priority: "LOW", completedAt: daysAgo(20) },
    { project: blog, title: "RSS feed generation", status: "DONE", priority: "MEDIUM", completedAt: daysAgo(35) },
    { project: blog, title: "Syntax highlighting", status: "DONE", priority: "LOW", completedAt: daysAgo(50) },
    { project: null, title: "Read 'Refactoring UI'", status: "IN_PROGRESS", priority: "LOW" },
    { project: null, title: "Plan Q3 side project", status: "TODO", priority: "MEDIUM", dueDate: daysAhead(14) },
  ];

  const createdTasks: { id: string; title: string }[] = [];
  for (const t of tasks) {
    const created = await prisma.task.create({
      data: {
        userId,
        projectId: t.project?.id ?? null,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: (t as { dueDate?: Date }).dueDate ?? null,
        completedAt: (t as { completedAt?: Date }).completedAt ?? null,
      },
    });
    createdTasks.push({ id: created.id, title: created.title });
  }

  // Subtasks for the first couple of tasks.
  await prisma.subtask.createMany({
    data: [
      { taskId: createdTasks[1].id, title: "Card component", completed: true, order: 0 },
      { taskId: createdTasks[1].id, title: "Hover states", completed: true, order: 1 },
      { taskId: createdTasks[1].id, title: "Empty state", completed: false, order: 2 },
      { taskId: createdTasks[5].id, title: "Tab bar", completed: true, order: 0 },
      { taskId: createdTasks[5].id, title: "Deep linking", completed: false, order: 1 },
    ],
  });

  // --- Bugs -----------------------------------------------------------------
  await prisma.bug.createMany({
    data: [
      {
        userId,
        projectId: portfolio.id,
        title: "Hero image flickers on first paint",
        description: "A layout shift occurs before the hero image loads.",
        severity: "MAJOR",
        status: "INVESTIGATING",
        stepsToReproduce:
          "1. Hard refresh the home page\n2. Watch the hero area\n3. Notice the flicker",
      },
      {
        userId,
        projectId: portfolio.id,
        title: "Footer links overflow on mobile",
        severity: "MINOR",
        status: "OPEN",
      },
      {
        userId,
        projectId: mobile.id,
        title: "App crashes when offline",
        description: "Network requests are not guarded for offline mode.",
        severity: "CRITICAL",
        status: "OPEN",
        stepsToReproduce: "1. Enable airplane mode\n2. Open the app\n3. Crash",
      },
      {
        userId,
        projectId: cli.id,
        title: "Wrong exit code on invalid flag",
        severity: "MINOR",
        status: "FIXED",
        fixNotes: "Now returns exit code 1 and prints usage.",
        resolvedAt: daysAgo(8),
      },
      {
        userId,
        projectId: blog.id,
        title: "Code blocks not escaping HTML",
        severity: "MAJOR",
        status: "CLOSED",
        fixNotes: "Escaped entities before rendering.",
        resolvedAt: daysAgo(40),
      },
    ],
  });

  // --- Notes ----------------------------------------------------------------
  await prisma.note.createMany({
    data: [
      {
        userId,
        projectId: portfolio.id,
        title: "Design principles",
        pinned: true,
        content:
          "# Design principles\n\n- **Clarity** over cleverness\n- Generous whitespace\n- One accent colour, used sparingly\n- Dark mode first\n\n> Keep it calm and fast.",
      },
      {
        userId,
        projectId: mobile.id,
        title: "MVP scope",
        content:
          "## In scope\n\n- Habit creation\n- Daily check-ins\n- Streaks\n\n## Out of scope\n\n- Social features\n- Reminders v2",
      },
      {
        userId,
        title: "Ideas backlog",
        content:
          "Random ideas to explore later:\n\n1. A `cron`-based reminder bot\n2. Markdown resume generator\n3. Tiny URL shortener for the Pi",
      },
      {
        userId,
        projectId: cli.id,
        title: "Release checklist",
        content:
          "- [ ] Update changelog\n- [ ] Bump version\n- [ ] Tag release\n- [ ] Publish",
      },
    ],
  });

  // --- Activity log ---------------------------------------------------------
  await prisma.activityLog.createMany({
    data: [
      { userId, action: "completed", entityType: "task", entityTitle: "Design the landing hero", createdAt: daysAgo(1) },
      { userId, action: "created", entityType: "bug", entityTitle: "App crashes when offline", createdAt: daysAgo(1) },
      { userId, action: "updated", entityType: "project", entityTitle: "Portfolio Website", createdAt: daysAgo(2) },
      { userId, action: "completed", entityType: "task", entityTitle: "Add dark mode toggle", createdAt: daysAgo(3) },
      { userId, action: "created", entityType: "note", entityTitle: "Design principles", createdAt: daysAgo(4) },
      { userId, action: "fixed", entityType: "bug", entityTitle: "Wrong exit code on invalid flag", createdAt: daysAgo(8) },
      { userId, action: "created", entityType: "task", entityTitle: "Plan Q3 side project", createdAt: daysAgo(9) },
    ],
  });

  console.log("✓ Seed complete.");
  console.log(`  Demo login → ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
