import type { Metadata } from "next";
import { Trash2 } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TrashView } from "@/components/trash/trash-view";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  const user = await requireUser();
  const t = await getT();
  const trashed = { deletedAt: { not: null } } as const;

  const [projects, tasks, bugs, notes] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id, ...trashed },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { userId: user.id, ...trashed },
      orderBy: { deletedAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.bug.findMany({
      where: { userId: user.id, ...trashed },
      orderBy: { deletedAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.note.findMany({
      where: { userId: user.id, ...trashed },
      orderBy: { deletedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  const total = projects.length + tasks.length + bugs.length + notes.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("page.trash.title")}
        description={t("page.trash.desc")}
      />

      {total === 0 ? (
        <EmptyState
          icon={Trash2}
          title={t("empty.trash.t")}
          description={t("empty.trash.d")}
        />
      ) : (
        <TrashView
          projects={projects.map((p) => ({ id: p.id, label: p.name }))}
          tasks={tasks.map((t) => ({ id: t.id, label: t.title }))}
          bugs={bugs.map((b) => ({ id: b.id, label: b.title }))}
          notes={notes.map((n) => ({ id: n.id, label: n.title }))}
        />
      )}
    </div>
  );
}
