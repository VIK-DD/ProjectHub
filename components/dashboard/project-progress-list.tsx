import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/status-pill";
import { findMeta, PROJECT_STATUSES } from "@/lib/constants";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  progress: number;
  color: string | null;
};

export function ProjectProgressList({
  projects,
}: {
  projects: ProjectRow[];
}) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Create a project to start tracking progress."
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className="-mx-2 block rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/40"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: p.color || "#6366f1" }}
              />
              <span className="truncate text-sm font-medium">{p.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill meta={findMeta(PROJECT_STATUSES, p.status)} />
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {p.progress}%
              </span>
            </div>
          </div>
          <Progress value={p.progress} />
        </Link>
      ))}
    </div>
  );
}
