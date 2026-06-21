import type { Metadata } from "next";
import { Bug } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getArchivedProjectIds, getSavedViews } from "@/lib/feature-store";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { BugCreateButton } from "@/components/bugs/bug-create-button";
import { BugsView } from "@/components/bugs/bugs-view";

export const metadata: Metadata = { title: "Bugs" };

export default async function BugsPage({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string;
    title?: string;
    bug?: string;
    search?: string;
    severity?: string;
    status?: string;
    project?: string;
  }>;
}) {
  const user = await requireUser();
  const t = await getT();

  const [bugs, projects, archivedIds, savedViews] = await Promise.all([
    prisma.bug.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }],
      include: { project: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getArchivedProjectIds(user.id),
    getSavedViews(user.id, "bugs"),
  ]);

  const visibleBugs = bugs.filter(
    (bug) => !bug.projectId || !archivedIds.has(bug.projectId),
  );

  const data = visibleBugs.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    severity: b.severity,
    status: b.status,
    projectId: b.projectId,
    stepsToReproduce: b.stepsToReproduce,
    fixNotes: b.fixNotes,
    projectName: b.project?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.bugs.title")}
        description={t("page.bugs.desc")}
      >
        <BugCreateButton
          projects={projects.filter((project) => !archivedIds.has(project.id))}
          defaultOpen={(await searchParams).new === "1"}
          defaultTitle={(await searchParams).title}
        />
      </PageHeader>

      {visibleBugs.length === 0 ? (
        <EmptyState
          icon={Bug}
          title={t("empty.bugs.t")}
          description={t("empty.bugs.d")}
          action={
            <BugCreateButton
              projects={projects.filter((project) => !archivedIds.has(project.id))}
              defaultTitle={(await searchParams).title}
            />
          }
        />
      ) : (
        <BugsView
          bugs={data}
          projects={projects.filter((project) => !archivedIds.has(project.id))}
          savedViews={savedViews}
          openBugId={(await searchParams).bug}
          initialFilters={{
            search: (await searchParams).search ?? "",
            severity: (await searchParams).severity ?? "all",
            status: (await searchParams).status ?? "all",
            project: (await searchParams).project ?? "all",
          }}
        />
      )}
    </div>
  );
}
