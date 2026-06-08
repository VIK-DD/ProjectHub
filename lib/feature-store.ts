import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

type SavedViewRow = {
  id: string;
  userId: string;
  entityType: string;
  name: string;
  filtersJson: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectArchiveRow = {
  projectId: string;
  userId: string;
  archivedAt: string;
};

type ReviewRow = {
  id: string;
};

let ensurePromise: Promise<void> | null = null;

export async function ensureFeatureTables() {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS saved_views (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        name TEXT NOT NULL,
        filtersJson TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS saved_views_user_entity_idx
      ON saved_views(userId, entityType, updatedAt DESC)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS archived_projects (
        projectId TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        archivedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS archived_projects_user_idx
      ON archived_projects(userId, archivedAt DESC)
    `);
  })();
  return ensurePromise;
}

export async function getSavedViews(userId: string, entityType: string) {
  await ensureFeatureTables();
  const rows = await prisma.$queryRaw<SavedViewRow[]>`
    SELECT id, userId, entityType, name, filtersJson, createdAt, updatedAt
    FROM saved_views
    WHERE userId = ${userId} AND entityType = ${entityType}
    ORDER BY updatedAt DESC, createdAt DESC
  `;
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    entityType: row.entityType,
    name: row.name,
    filters: JSON.parse(row.filtersJson) as Record<string, string>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function createSavedView(
  userId: string,
  entityType: string,
  name: string,
  filters: Record<string, string>,
) {
  await ensureFeatureTables();
  const id = randomUUID();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO saved_views (id, userId, entityType, name, filtersJson, createdAt, updatedAt)
    VALUES (${id}, ${userId}, ${entityType}, ${name}, ${JSON.stringify(filters)}, ${now}, ${now})
  `;
  return id;
}

export async function deleteSavedView(userId: string, id: string) {
  await ensureFeatureTables();
  await prisma.$executeRaw`
    DELETE FROM saved_views
    WHERE id = ${id} AND userId = ${userId}
  `;
}

export async function archiveProjectRecord(userId: string, projectId: string) {
  await ensureFeatureTables();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO archived_projects (projectId, userId, archivedAt)
    VALUES (${projectId}, ${userId}, ${now})
    ON CONFLICT(projectId)
    DO UPDATE SET userId = excluded.userId, archivedAt = excluded.archivedAt
  `;
}

export async function unarchiveProjectRecord(userId: string, projectId: string) {
  await ensureFeatureTables();
  await prisma.$executeRaw`
    DELETE FROM archived_projects
    WHERE projectId = ${projectId} AND userId = ${userId}
  `;
}

export async function getArchivedProjectIds(userId: string) {
  await ensureFeatureTables();
  const rows = await prisma.$queryRaw<ProjectArchiveRow[]>`
    SELECT projectId, userId, archivedAt
    FROM archived_projects
    WHERE userId = ${userId}
  `;
  return new Set(rows.map((row) => row.projectId));
}

export async function isProjectArchived(userId: string, projectId: string) {
  const ids = await getArchivedProjectIds(userId);
  return ids.has(projectId);
}

export async function weeklyReviewAlreadyCreated(userId: string, weekStartIso: string) {
  const rows = await prisma.$queryRaw<ReviewRow[]>`
    SELECT id
    FROM Notification
    WHERE userId = ${userId}
      AND type = 'WEEKLY_REVIEW'
      AND createdAt >= ${weekStartIso}
    LIMIT 1
  `;
  return rows.length > 0;
}
