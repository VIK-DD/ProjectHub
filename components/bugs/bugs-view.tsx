"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Bug, ListChecks, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useUndoToast } from "@/components/use-undo-toast";

import {
  bulkDeleteBugs,
  bulkRestoreBugs,
  bulkUpdateBugSeverity,
  bulkUpdateBugStatus,
} from "@/lib/actions/bugs";
import { removeSavedView, saveView } from "@/lib/actions/views";
import { BUG_SEVERITIES, BUG_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { BugDTO, ProjectOption } from "@/types/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BugRow } from "@/components/bugs/bug-row";
import { useT } from "@/components/i18n-provider";

type BugRowData = BugDTO & { projectName?: string | null };

const STATUS_ORDER = BUG_STATUSES.map((s) => s.value);

export function BugsView({
  bugs,
  projects,
  savedViews,
  openBugId,
  initialFilters,
}: {
  bugs: BugRowData[];
  projects: ProjectOption[];
  savedViews: {
    id: string;
    name: string;
    filters: Record<string, string>;
  }[];
  openBugId?: string;
  initialFilters: {
    search: string;
    severity: string;
    status: string;
    project: string;
  };
}) {
  const router = useRouter();
  const undoToast = useUndoToast();
  const t = useT();
  const [, startTransition] = React.useTransition();
  const [search, setSearch] = React.useState(initialFilters.search);
  const [severity, setSeverity] = React.useState(initialFilters.severity);
  const [status, setStatus] = React.useState(initialFilters.status);
  const [project, setProject] = React.useState(initialFilters.project);
  const [views, setViews] = React.useState(savedViews);

  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    setViews(savedViews);
  }, [savedViews]);

  React.useEffect(() => {
    setSearch(initialFilters.search);
    setSeverity(initialFilters.severity);
    setStatus(initialFilters.status);
    setProject(initialFilters.project);
  }, [initialFilters]);

  const counts = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of bugs) map[b.status] = (map[b.status] ?? 0) + 1;
    return map;
  }, [bugs]);

  const filtered = React.useMemo(() => {
    return bugs
      .filter((b) => {
        if (search && !b.title.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (severity !== "all" && b.severity !== severity) return false;
        if (status !== "all" && b.status !== status) return false;
        if (project === "none" && b.projectId) return false;
        if (project !== "all" && project !== "none" && b.projectId !== project)
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
      );
  }, [bugs, search, severity, status, project]);

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
    setSelectionMode(false);
  }
  function bulkStatus(value: string) {
    const ids = [...selected];
    startTransition(async () => {
      const res = await bulkUpdateBugStatus(ids, value);
      if (!res.ok) toast.error(res.error);
      else toast.success(`Updated ${ids.length} bug(s)`);
      clearSelection();
      router.refresh();
    });
  }

  function bulkSeverity(value: string) {
    const ids = [...selected];
    startTransition(async () => {
      const res = await bulkUpdateBugSeverity(ids, value);
      if (!res.ok) toast.error(res.error);
      else toast.success(`Updated ${ids.length} bug(s)`);
      clearSelection();
      router.refresh();
    });
  }

  function selectFiltered() {
    setSelectionMode(true);
    setSelected(new Set(filtered.map((bug) => bug.id)));
  }

  async function saveCurrentView() {
    const name = window.prompt("View name");
    if (!name?.trim()) return;
    const filters = { search, severity, status, project };
    const res = await saveView({ entityType: "bugs", name: name.trim(), filters });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setViews((prev) => [{ id: res.id, name: name.trim(), filters }, ...prev]);
    toast.success("View saved");
  }

  function applyView(filters: Record<string, string>) {
    setSearch(filters.search ?? "");
    setSeverity(filters.severity ?? "all");
    setStatus(filters.status ?? "all");
    setProject(filters.project ?? "all");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {BUG_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() =>
              setStatus((cur) => (cur === s.value ? "all" : s.value))
            }
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              status === s.value
                ? "border-border bg-accent"
                : "bg-card hover:bg-accent/50",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", s.dot)} />
            <span>{t(`meta.${s.value}`)}</span>
            <span className="tabular-nums text-muted-foreground">
              {counts[s.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("view.searchBugs")}
            className="h-9 w-full pl-8 sm:w-52"
          />
        </div>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-full sm:w-36">
            <SelectValue placeholder={t("form.severity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("view.allSeverity")}</SelectItem>
            {BUG_SEVERITIES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {t(`meta.${s.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder={t("form.project")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("view.allProjects")}</SelectItem>
            <SelectItem value="none">{t("project.none")}</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={saveCurrentView}>
          <Bookmark className="h-4 w-4" />
          Save view
        </Button>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {views.map((view) => (
            <div
              key={view.id}
              className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs"
            >
              <button onClick={() => applyView(view.filters)}>{view.name}</button>
              <button
                onClick={() =>
                  startTransition(async () => {
                    setViews((prev) => prev.filter((item) => item.id !== view.id));
                    const res = await removeSavedView(view.id);
                    if (!res.ok) {
                      toast.error(res.error);
                      setViews(savedViews);
                    }
                  })
                }
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Delete ${view.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bug}
          title={t("empty.bugsMatch.t")}
          description={t("empty.bugsMatch.d")}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectionMode((m) => !m);
                setSelected(new Set());
              }}
            >
              <ListChecks className="h-4 w-4" />
              {selectionMode ? t("view.cancel") : t("view.select")}
            </Button>
            <div className="flex items-center gap-2">
              {selectionMode ? (
                <>
                  <Button variant="ghost" size="sm" onClick={selectFiltered}>
                    Select filtered
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {t("view.selectedN", { n: selected.size })}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {selectionMode && selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
              <span className="px-1 text-sm font-medium">
                {t("view.selectedN", { n: selected.size })}
              </span>
              <Select onValueChange={bulkStatus}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder={t("view.setStatus")} />
                </SelectTrigger>
                <SelectContent>
                  {BUG_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {t(`meta.${s.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={bulkSeverity}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Set severity" />
                </SelectTrigger>
                <SelectContent>
                  {BUG_SEVERITIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {t(`meta.${s.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                {t("common.delete")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={clearSelection}
              >
                {t("view.clear")}
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            {filtered.map((bug) => (
              <BugRow
                key={bug.id}
                bug={bug}
                projects={projects}
                defaultOpen={openBugId === bug.id}
                selectionMode={selectionMode}
                selected={selected.has(bug.id)}
                onToggleSelect={(c) => toggleSelect(bug.id, c)}
              />
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("view.deleteBugsTitle", { n: selected.size })}
        description={t("view.deleteBugsDesc")}
        onConfirm={async () => {
          const ids = [...selected];
          const res = await bulkDeleteBugs(ids);
          if (res.ok) {
            undoToast(`Deleted ${ids.length} bug(s)`, () => bulkRestoreBugs(ids));
            clearSelection();
            router.refresh();
          }
          return res;
        }}
      />
    </div>
  );
}
