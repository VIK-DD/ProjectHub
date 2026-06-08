import { PrismaClient } from "@prisma/client";

// Models that support soft delete (Trash). Read queries automatically exclude
// rows where deletedAt is set, unless the caller explicitly filters on
// deletedAt (e.g. the Trash page passes `deletedAt: { not: null }`).
const SOFT_MODELS = new Set(["Task", "Project", "Bug", "Note"]);
const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (SOFT_MODELS.has(model) && READ_OPS.has(operation)) {
            const a = args as { where?: Record<string, unknown> };
            a.where = a.where ?? {};
            if (!("deletedAt" in a.where)) a.where.deletedAt = null;
          }
          return query(args);
        },
      },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof createPrisma>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrisma | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
