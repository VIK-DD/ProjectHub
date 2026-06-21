import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { accessibleProjectsWhere } from "@/lib/access";
import { getArchivedProjectIds, getSavedViews } from "@/lib/feature-store";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProjectsView } from "@/components/projects/projects-view";
import { ProjectCreateButton } from "@/components/projects/project-create-button";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; search?: string; status?: string; tag?: string }>;
}) {
  const user = await requireUser();
  const t = await getT();

  const [projects, archivedIds, savedViews] = await Promise.all([
    prisma.project.findMany({
      where: accessibleProjectsWhere(user.id),
      orderBy: [{ updatedAt: "desc" }],
      include: {
        _count: {
          select: {
            tasks: { where: { deletedAt: null } },
            bugs: { where: { deletedAt: null } },
          },
        },
      },
    }),
    getArchivedProjectIds(user.id),
    getSavedViews(user.id, "projects"),
  ]);

  const active = projects.filter((project) => !archivedIds.has(project.id));
  const archived = projects.filter((project) => archivedIds.has(project.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.projects.title")}
        description={t("page.projects.desc", { n: active.length })}
      >
        <ProjectCreateButton defaultOpen={(await searchParams).new === "1"} />
      </PageHeader>

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={t("empty.projects.t")}
          description={t("empty.projects.d")}
          action={<ProjectCreateButton />}
        />
      ) : (
        <ProjectsView
          projects={active.map((p) => ({
            ...p,
            taskCount: p._count.tasks,
            bugCount: p._count.bugs,
            shared: p.userId !== user.id,
            archived: false,
          }))}
          archivedProjects={archived.map((p) => ({
            ...p,
            taskCount: p._count.tasks,
            bugCount: p._count.bugs,
            shared: p.userId !== user.id,
            archived: true,
          }))}
          savedViews={savedViews}
          initialFilters={{
            search: (await searchParams).search ?? "",
            status: (await searchParams).status ?? "all",
            tag: (await searchParams).tag ?? "",
          }}
        />
      )}
    </div>
  );
}
