"use client";

import * as React from "react";
import { Pin, Search, StickyNote } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProjectOption } from "@/types/entities";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { NoteCard } from "@/components/notes/note-card";
import { SavedViewsBar, type SavedView } from "@/components/saved-views-bar";
import { useT } from "@/components/i18n-provider";

type NoteItem = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  projectId: string | null;
  projectName: string | null;
  updatedAt: Date;
};

export function NotesView({
  notes,
  projects,
  savedViews = [],
  initialFilters,
  defaultOpenNoteId,
}: {
  notes: NoteItem[];
  projects: ProjectOption[];
  savedViews?: SavedView[];
  initialFilters?: { search: string; project: string; pinned: string };
  defaultOpenNoteId?: string;
}) {
  const t = useT();
  const [search, setSearch] = React.useState(initialFilters?.search ?? "");
  const [project, setProject] = React.useState(initialFilters?.project ?? "all");
  const [pinnedOnly, setPinnedOnly] = React.useState(
    initialFilters?.pinned === "1",
  );
  const [views, setViews] = React.useState<SavedView[]>(savedViews);

  React.useEffect(() => {
    setViews(savedViews);
  }, [savedViews]);

  const filtered = notes.filter((n) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !n.title.toLowerCase().includes(q) &&
        !(n.content ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    if (project === "none" && n.projectId) return false;
    if (project !== "all" && project !== "none" && n.projectId !== project)
      return false;
    if (pinnedOnly && !n.pinned) return false;
    return true;
  });

  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  function applyView(filters: Record<string, string>) {
    setSearch(filters.search ?? "");
    setProject(filters.project ?? "all");
    setPinnedOnly(filters.pinned === "1");
  }

  const card = (note: NoteItem) => (
    <NoteCard
      key={note.id}
      note={note}
      projects={projects}
      defaultOpen={note.id === defaultOpenNoteId}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("view.searchNotes")}
            className="h-9 w-full pl-8 sm:max-w-xs"
          />
        </div>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="h-9 w-full sm:w-44">
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
        <button
          type="button"
          onClick={() => setPinnedOnly((v) => !v)}
          className={cn(
            "flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
            pinnedOnly
              ? "border-primary/40 bg-primary/10 text-primary"
              : "bg-card text-muted-foreground hover:bg-accent",
          )}
        >
          <Pin className="h-3.5 w-3.5" />
          {t("view.pinnedOnly")}
        </button>
      </div>

      <SavedViewsBar
        entityType="notes"
        views={views}
        setViews={setViews}
        currentFilters={{ search, project, pinned: pinnedOnly ? "1" : "" }}
        onApply={applyView}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={t("empty.notesMatch.t")}
          description={t("empty.notesMatch.d")}
        />
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Pin className="h-3.5 w-3.5" />
                {t("view.pinnedOnly")}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pinned.map(card)}
              </div>
            </section>
          ) : null}

          {others.length > 0 ? (
            <section className="space-y-3">
              {pinned.length > 0 ? (
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("view.allNotes")}
                </h2>
              ) : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map(card)}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
