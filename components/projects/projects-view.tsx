"use client";

import * as React from "react";
import { FolderKanban, Search, Tag } from "lucide-react";

import { PROJECT_STATUSES } from "@/lib/constants";
import { cn, parseTags } from "@/lib/utils";
import type { ProjectDTO } from "@/types/entities";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { ProjectCard } from "@/components/projects/project-card";
import { SavedViewsBar, type SavedView } from "@/components/saved-views-bar";
import { useT } from "@/components/i18n-provider";

type ProjectItem = ProjectDTO & {
  taskCount: number;
  bugCount: number;
  shared?: boolean;
  archived?: boolean;
};

export function ProjectsView({
  projects,
  archivedProjects = [],
  savedViews = [],
  initialFilters,
}: {
  projects: ProjectItem[];
  archivedProjects?: ProjectItem[];
  savedViews?: SavedView[];
  initialFilters?: { search: string; status: string; tag: string };
}) {
  const t = useT();
  const [search, setSearch] = React.useState(initialFilters?.search ?? "");
  const [status, setStatus] = React.useState(initialFilters?.status ?? "all");
  const [tag, setTag] = React.useState<string | null>(initialFilters?.tag || null);
  const [views, setViews] = React.useState<SavedView[]>(savedViews);

  React.useEffect(() => {
    setViews(savedViews);
  }, [savedViews]);

  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) parseTags(p.tags).forEach((tg) => set.add(tg));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const matches = React.useCallback(
    (p: ProjectItem) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (status !== "all" && p.status !== status) return false;
      if (tag && !parseTags(p.tags).includes(tag)) return false;
      return true;
    },
    [search, status, tag],
  );

  const activeFiltered = projects.filter(matches);
  const archivedFiltered = archivedProjects.filter(matches);

  function applyView(filters: Record<string, string>) {
    setSearch(filters.search ?? "");
    setStatus(filters.status ?? "all");
    setTag(filters.tag || null);
  }

  const grid = (list: ProjectItem[], archived: boolean) =>
    list.length === 0 ? (
      <EmptyState
        icon={FolderKanban}
        title={t("empty.projectsMatch.t")}
        description={t("empty.projectsMatch.d")}
      />
    ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            shared={p.shared}
            archived={archived}
          />
        ))}
      </div>
    );

  const filterBar = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("view.searchProjects")}
            className="h-9 w-full pl-8 sm:max-w-xs"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder={t("form.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("view.allStatuses")}</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {t(`meta.${s.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SavedViewsBar
        entityType="projects"
        views={views}
        setViews={setViews}
        currentFilters={{ search, status, tag: tag ?? "" }}
        onApply={applyView}
      />

      {allTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          {allTags.map((tg) => (
            <button
              key={tg}
              onClick={() => setTag((cur) => (cur === tg ? null : tg))}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                tag === tg
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {tg}
            </button>
          ))}
          {tag ? (
            <button
              onClick={() => setTag(null)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t("view.clear")}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="space-y-4">
      {filterBar}

      {archivedProjects.length > 0 ? (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">
              {t("view.active")} · {activeFiltered.length}
            </TabsTrigger>
            <TabsTrigger value="archived">
              {t("view.archived")} · {archivedFiltered.length}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-0">
            {grid(activeFiltered, false)}
          </TabsContent>
          <TabsContent value="archived" className="mt-0">
            {grid(archivedFiltered, true)}
          </TabsContent>
        </Tabs>
      ) : (
        grid(activeFiltered, false)
      )}
    </div>
  );
}
