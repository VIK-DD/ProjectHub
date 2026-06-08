import type { Metadata } from "next";
import { StickyNote } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getArchivedProjectIds, getSavedViews } from "@/lib/feature-store";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NotesView } from "@/components/notes/notes-view";
import { NoteCreateButton } from "@/components/notes/note-create-button";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({
  searchParams,
}: {
  searchParams: {
    new?: string;
    note?: string;
    title?: string;
    search?: string;
    project?: string;
    pinned?: string;
  };
}) {
  const user = await requireUser();
  const t = getT();

  const [notes, projects, archivedIds, savedViews] = await Promise.all([
    prisma.note.findMany({
      where: { userId: user.id },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      include: { project: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getArchivedProjectIds(user.id),
    getSavedViews(user.id, "notes"),
  ]);

  const activeProjects = projects.filter(
    (project) => !archivedIds.has(project.id),
  );

  const visibleNotes = notes.filter(
    (note) => !note.projectId || !archivedIds.has(note.projectId),
  );

  const data = visibleNotes.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    projectId: n.projectId,
    projectName: n.project?.name ?? null,
    updatedAt: n.updatedAt,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("page.notes.title")} description={t("page.notes.desc")}>
        <NoteCreateButton
          projects={activeProjects}
          defaultOpen={searchParams.new === "1"}
          defaultTitle={searchParams.title}
        />
      </PageHeader>

      {visibleNotes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={t("empty.notes.t")}
          description={t("empty.notes.d")}
          action={
            <NoteCreateButton
              projects={activeProjects}
              label="Create note"
              defaultTitle={searchParams.title}
            />
          }
        />
      ) : (
        <NotesView
          notes={data}
          projects={activeProjects}
          savedViews={savedViews}
          initialFilters={{
            search: searchParams.search ?? "",
            project: searchParams.project ?? "all",
            pinned: searchParams.pinned ?? "",
          }}
          defaultOpenNoteId={searchParams.note}
        />
      )}
    </div>
  );
}
