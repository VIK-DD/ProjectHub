import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const tmpDir = join(root, "tests", ".tmp");
const dbPath = join(tmpDir, `safety-net-${Date.now()}.db`);

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: `file:${dbPath}`,
});

let prisma: Awaited<typeof import("../lib/prisma")>["prisma"];
let notesModule: Awaited<typeof import("../lib/actions/notes")>;
let accessModule: Awaited<typeof import("../lib/access")>;
let commentsModule: Awaited<typeof import("../lib/actions/comments")>;
let notificationsModule: Awaited<typeof import("../lib/actions/notifications")>;
let trashModule: Awaited<typeof import("../lib/actions/trash")>;
let featureStoreModule: Awaited<typeof import("../lib/feature-store")>;
let weeklyReviewModule: Awaited<typeof import("../lib/weekly-review")>;

before(async () => {
  await mkdir(tmpDir, { recursive: true });
  await cp(join(root, "prisma", "dev.db"), dbPath);
  ({ prisma } = await import("../lib/prisma"));
  notesModule = await import("../lib/actions/notes");
  accessModule = await import("../lib/access");
  commentsModule = await import("../lib/actions/comments");
  notificationsModule = await import("../lib/actions/notifications");
  trashModule = await import("../lib/actions/trash");
  featureStoreModule = await import("../lib/feature-store");
  weeklyReviewModule = await import("../lib/weekly-review");
});

after(async () => {
  await prisma?.$disconnect();
  await rm(dbPath, { force: true });
});

async function createUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: "hash",
      name: label,
      username: label.toLowerCase().replace(/\s+/g, "_"),
    },
  });
}

test("note actions respect ownership and soft delete", async () => {
  const { createNoteForUser, updateNoteForUser, deleteNoteForUser } = notesModule;

  const owner = await createUser("Owner");
  const teammate = await createUser("Teammate");
  const project = await prisma.project.create({
    data: {
      name: "Shared Project",
      userId: owner.id,
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: teammate.id,
      role: "MEMBER",
    },
  });

  const created = await createNoteForUser(owner.id, {
    title: "Launch checklist",
    content: "v1",
    projectId: project.id,
    pinned: true,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const memberEdit = await updateNoteForUser(teammate.id, created.id, {
    title: "Should fail",
    content: "nope",
    projectId: project.id,
    pinned: false,
  });
  assert.deepEqual(memberEdit, { ok: false, error: "Note not found" });

  const ownerEdit = await updateNoteForUser(owner.id, created.id, {
    title: "Launch checklist",
    content: "v2",
    projectId: project.id,
    pinned: false,
  });
  assert.deepEqual(ownerEdit, { ok: true });

  const removed = await deleteNoteForUser(owner.id, created.id);
  assert.deepEqual(removed, { ok: true });

  const hiddenByDefault = await prisma.note.findFirst({
    where: { id: created.id },
  });
  assert.equal(hiddenByDefault, null);

  const raw = await prisma.note.findUnique({ where: { id: created.id } });
  assert.ok(raw?.deletedAt);
});

test("accessible projects can be attached by members but not outsiders", async () => {
  const { createNoteForUser } = notesModule;
  const { resolveAccessibleProjectId } = accessModule;

  const owner = await createUser("Access Owner");
  const member = await createUser("Access Member");
  const outsider = await createUser("Access Outsider");
  const project = await prisma.project.create({
    data: {
      name: "Access Project",
      userId: owner.id,
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: member.id,
      role: "ADMIN",
    },
  });

  assert.equal(await resolveAccessibleProjectId(member.id, project.id), project.id);
  assert.equal(await resolveAccessibleProjectId(outsider.id, project.id), null);

  const memberNote = await createNoteForUser(member.id, {
    title: "Shared note",
    content: "visible",
    projectId: project.id,
    pinned: false,
  });
  assert.equal(memberNote.ok, true);
  if (!memberNote.ok) return;

  const memberRecord = await prisma.note.findUnique({ where: { id: memberNote.id } });
  assert.equal(memberRecord?.projectId, project.id);

  const outsiderNote = await createNoteForUser(outsider.id, {
    title: "Private attach blocked",
    content: "still created",
    projectId: project.id,
    pinned: false,
  });
  assert.equal(outsiderNote.ok, true);
  if (!outsiderNote.ok) return;

  const outsiderRecord = await prisma.note.findUnique({
    where: { id: outsiderNote.id },
  });
  assert.equal(outsiderRecord?.projectId, null);
});

test("project access reports owner, member role, and outsider denial", async () => {
  const { getProjectAccess } = accessModule;

  const owner = await createUser("Role Owner");
  const admin = await createUser("Role Admin");
  const stranger = await createUser("Role Stranger");
  const project = await prisma.project.create({
    data: {
      name: "Roles Project",
      userId: owner.id,
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: admin.id,
      role: "ADMIN",
    },
  });

  assert.deepEqual(await getProjectAccess(owner.id, project.id), {
    role: "OWNER",
    isOwner: true,
  });
  assert.deepEqual(await getProjectAccess(admin.id, project.id), {
    role: "ADMIN",
    isOwner: false,
  });
  assert.equal(await getProjectAccess(stranger.id, project.id), null);
});

test("comments create comment and mention notifications for accessible tasks", async () => {
  const { addCommentForUser } = commentsModule;

  const owner = await createUser("Comment Owner");
  const assignee = await createUser("Comment Assignee");
  const mentioned = await createUser("Comment Mentioned");
  const task = await prisma.task.create({
    data: {
      userId: owner.id,
      assigneeId: assignee.id,
      title: "Review API contract",
      status: "TODO",
      priority: "MEDIUM",
    },
  });

  const result = await addCommentForUser(
    owner.id,
    owner.name,
    task.id,
    `Please sync with @${mentioned.username}`,
  );
  assert.equal(result.ok, true);

  const notifications = await prisma.notification.findMany({
    where: { userId: { in: [assignee.id, mentioned.id] } },
    orderBy: { createdAt: "asc" },
    select: { userId: true, type: true, entityId: true },
  });

  assert.deepEqual(
    notifications.map((item) => ({
      userId: item.userId,
      type: item.type,
      entityId: item.entityId,
    })),
    [
      { userId: assignee.id, type: "COMMENT", entityId: task.id },
      { userId: mentioned.id, type: "MENTION", entityId: task.id },
    ],
  );
});

test("notification actions mark one or all as read", async () => {
  const { markAllNotificationsReadForUser, markNotificationReadForUser } =
    notificationsModule;

  const user = await createUser("Notify Reader");
  const first = await prisma.notification.create({
    data: {
      userId: user.id,
      type: "COMMENT",
      title: "One",
    },
  });
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "MENTION",
      title: "Two",
    },
  });

  assert.deepEqual(await markNotificationReadForUser(user.id, first.id), {
    ok: true,
  });
  let unread = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });
  assert.equal(unread, 1);

  assert.deepEqual(await markAllNotificationsReadForUser(user.id), { ok: true });
  unread = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });
  assert.equal(unread, 0);
});

test("trash restore returns a deleted note to the active list", async () => {
  const { deleteNoteForUser } = notesModule;
  const { restoreNoteForUser } = trashModule;

  const user = await createUser("Trash Note");
  const noteRes = await notesModule.createNoteForUser(user.id, {
    title: "Trash me",
    content: "temporary",
    projectId: "",
    pinned: false,
  });
  assert.equal(noteRes.ok, true);
  if (!noteRes.ok) return;

  await deleteNoteForUser(user.id, noteRes.id);
  assert.equal(
    await prisma.note.findFirst({ where: { id: noteRes.id } }),
    null,
  );

  assert.deepEqual(await restoreNoteForUser(user.id, noteRes.id), { ok: true });
  const restored = await prisma.note.findFirst({ where: { id: noteRes.id } });
  assert.equal(restored?.title, "Trash me");
});

test("saved views and archived project records persist through feature store", async () => {
  const {
    archiveProjectRecord,
    createSavedView,
    getArchivedProjectIds,
    getSavedViews,
    unarchiveProjectRecord,
  } = featureStoreModule;

  const user = await createUser("Feature Owner");
  const project = await prisma.project.create({
    data: {
      name: "Archive Me",
      userId: user.id,
    },
  });

  const viewId = await createSavedView(user.id, "tasks", "My focus", {
    search: "today",
    project: "all",
  });
  const views = await getSavedViews(user.id, "tasks");
  assert.equal(views[0]?.id, viewId);
  assert.equal(views[0]?.name, "My focus");

  await archiveProjectRecord(user.id, project.id);
  let archived = await getArchivedProjectIds(user.id);
  assert.equal(archived.has(project.id), true);

  await unarchiveProjectRecord(user.id, project.id);
  archived = await getArchivedProjectIds(user.id);
  assert.equal(archived.has(project.id), false);
});

test("weekly review summarizes active work and ignores archived project data", async () => {
  const { archiveProjectRecord } = featureStoreModule;
  const { buildWeeklyReview } = weeklyReviewModule;

  const user = await createUser("Weekly Owner");
  const activeProject = await prisma.project.create({
    data: { name: "Active Weekly", userId: user.id, status: "ACTIVE" },
  });
  const archivedProject = await prisma.project.create({
    data: { name: "Archived Weekly", userId: user.id, status: "ACTIVE" },
  });

  await prisma.task.create({
    data: {
      userId: user.id,
      title: "Shipped feature",
      status: "DONE",
      priority: "MEDIUM",
      projectId: activeProject.id,
      completedAt: new Date(),
    },
  });
  await prisma.task.create({
    data: {
      userId: user.id,
      title: "Old archived task",
      status: "DONE",
      priority: "MEDIUM",
      projectId: archivedProject.id,
      completedAt: new Date(),
    },
  });
  await prisma.bug.create({
    data: {
      userId: user.id,
      title: "Fresh bug",
      severity: "MAJOR",
      status: "OPEN",
      projectId: activeProject.id,
    },
  });
  await archiveProjectRecord(user.id, archivedProject.id);

  const review = await buildWeeklyReview(user.id);
  assert.equal(review.stats.tasksDone, 1);
  assert.equal(review.stats.bugsCreated, 1);
  assert.equal(review.stats.projectsActive, 1);
  assert.equal(review.topCompleted.some((item) => item.includes("Old archived task")), false);
});
