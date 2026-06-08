"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  CheckSquare,
  LayoutGrid,
  List,
  ListChecks,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useUndoToast } from "@/components/use-undo-toast";

import {
  bulkDeleteTasks,
  bulkRestoreTasks,
  bulkUpdateTaskPriority,
  bulkUpdateTaskStatus,
} from "@/lib/actions/tasks";
import { removeSavedView, saveView } from "@/lib/actions/views";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { ProjectOption, SubtaskDTO, TaskDTO } from "@/types/entities";
import { Button } from "@/components/ui/button";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskRow } from "@/components/tasks/task-row";
import { useT } from "@/components/i18n-provider";

export type ViewTask = TaskDTO & {
  projectName?: string | null;
  subtasks: SubtaskDTO[];
  order: number;
};

const STATUS_ORDER = TASK_STATUSES.map((s) => s.value);
const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function TasksView({
  tasks,
  projects,
  savedViews,
  initialFilters,
}: {
  tasks: ViewTask[];
  projects: ProjectOption[];
  savedViews: {
    id: string;
    name: string;
    filters: Record<string, string>;
  }[];
  initialFilters: {
    search: string;
    project: string;
    priority: string;
    viewMode: string;
  };
}) {
  const router = useRouter();
  const undoToast = useUndoToast();
  const t = useT();
  const [, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState(initialFilters.search);
  const [project, setProject] = React.useState(initialFilters.project);
  const [priority, setPriority] = React.useState(initialFilters.priority);
  const [viewMode, setViewMode] = React.useState(initialFilters.viewMode);
  const [views, setViews] = React.useState(savedViews);

  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    setViews(savedViews);
  }, [savedViews]);

  React.useEffect(() => {
    setSearch(initialFilters.search);
    setProject(initialFilters.project);
    setPriority(initialFilters.priority);
    setViewMode(initialFilters.viewMode);
  }, [initialFilters]);

  const filtered = React.useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (project === "none" && t.projectId) return false;
      if (project !== "all" && project !== "none" && t.projectId !== project)
        return false;
      if (priority !== "all" && t.priority !== priority) return false;
      return true;
    });
  }, [tasks, search, project, priority]);

  const boardTasks = filtered.map((t) => ({
    ...t,
    subtaskCount: t.subtasks.length,
    doneSubtasks: t.subtasks.filter((s) => s.completed).length,
  }));

  const listTasks = [...filtered].sort((a, b) => {
    const s = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (s !== 0) return s;
    return (
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
    );
  });

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

  function bulkStatus(status: string) {
    const ids = [...selected];
    startTransition(async () => {
      const res = await bulkUpdateTaskStatus(ids, status);
      if (!res.ok) toast.error(res.error);
      else toast.success(`Updated ${ids.length} task(s)`);
      clearSelection();
      router.refresh();
    });
  }

  function bulkPriority(priorityValue: string) {
    const ids = [...selected];
    startTransition(async () => {
      const res = await bulkUpdateTaskPriority(ids, priorityValue);
      if (!res.ok) toast.error(res.error);
      else toast.success(`Updated ${ids.length} task(s)`);
      clearSelection();
      router.refresh();
    });
  }

  function selectFiltered() {
    setSelectionMode(true);
    setSelected(new Set(filtered.map((task) => task.id)));
  }

  async function saveCurrentView() {
    const name = window.prompt("View name");
    if (!name?.trim()) return;
    const filters = { search, project, priority, viewMode };
    const res = await saveView({ entityType: "tasks", name: name.trim(), filters });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setViews((prev) => [{ id: res.id, name: name.trim(), filters }, ...prev]);
    toast.success("View saved");
  }

  function applyView(filters: Record<string, string>) {
    setSearch(filters.search ?? "");
    setProject(filters.project ?? "all");
    setPriority(filters.priority ?? "all");
    setViewMode(filters.viewMode ?? "board");
  }

  return (
    <Tabs value={viewMode} onValueChange={setViewMode} className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="board">
            <LayoutGrid className="h-4 w-4" />
            {t("view.board")}
          </TabsTrigger>
          <TabsTrigger value="list">
            <List className="h-4 w-4" />
            {t("view.list")}
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("view.searchTasks")}
              className="h-9 w-full pl-8 sm:w-52"
            />
          </div>
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
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9 w-full sm:w-36">
              <SelectValue placeholder={t("form.priority")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("view.allPriority")}</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {t(`meta.${p.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

      <TabsContent value="board" className="mt-0">
        <KanbanBoard tasks={boardTasks} projects={projects} />
      </TabsContent>

      <TabsContent value="list" className="mt-0 space-y-3">
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
            <Button size="sm" variant="secondary" onClick={() => bulkStatus("DONE")}>
              {t("view.markDone")}
            </Button>
            <Select onValueChange={bulkStatus}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder={t("view.setStatus")} />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {t(`meta.${s.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={bulkPriority}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Set priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {t(`meta.${p.value}`)}
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

        {listTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={t("empty.tasksMatch.t")}
            description={t("empty.tasksMatch.d")}
          />
        ) : (
          <div className="space-y-2">
            {listTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                projects={projects}
                selectionMode={selectionMode}
                selected={selected.has(task.id)}
                onToggleSelect={(c) => toggleSelect(task.id, c)}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("view.deleteTasksTitle", { n: selected.size })}
        description={t("view.deleteTasksDesc")}
        onConfirm={async () => {
          const ids = [...selected];
          const res = await bulkDeleteTasks(ids);
          if (res.ok) {
            undoToast(`Deleted ${ids.length} task(s)`, () => bulkRestoreTasks(ids));
            clearSelection();
            router.refresh();
          }
          return res;
        }}
      />
    </Tabs>
  );
}
