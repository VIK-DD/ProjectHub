"use client";

import * as React from "react";
import { Bookmark, X } from "lucide-react";
import { toast } from "sonner";

import { removeSavedView, saveView } from "@/lib/actions/views";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";

export type SavedView = {
  id: string;
  name: string;
  filters: Record<string, string>;
};

/**
 * Shared "Save view" button + saved-view chips. Persists the caller's current
 * filters via the saved_views feature store (no schema change). The parent owns
 * the views state so optimistic add/remove stays in sync with a re-fetch.
 */
export function SavedViewsBar({
  entityType,
  views,
  setViews,
  currentFilters,
  onApply,
}: {
  entityType: "tasks" | "bugs" | "projects" | "notes";
  views: SavedView[];
  setViews: React.Dispatch<React.SetStateAction<SavedView[]>>;
  currentFilters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}) {
  const t = useT();
  const [, startTransition] = React.useTransition();

  async function save() {
    const name = window.prompt("View name");
    if (!name?.trim()) return;
    const filters = currentFilters;
    const res = await saveView({ entityType, name: name.trim(), filters });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setViews((prev) => [{ id: res.id, name: name.trim(), filters }, ...prev]);
    toast.success("View saved");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={save}>
        <Bookmark className="h-4 w-4" />
        {t("view.saveView")}
      </Button>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {views.map((view) => (
          <div
            key={view.id}
            className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs"
          >
            <button onClick={() => onApply(view.filters)}>{view.name}</button>
            <button
              onClick={() =>
                startTransition(async () => {
                  const prev = views;
                  setViews((cur) => cur.filter((v) => v.id !== view.id));
                  const res = await removeSavedView(view.id);
                  if (!res.ok) {
                    toast.error(res.error);
                    setViews(prev);
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
  );
}
