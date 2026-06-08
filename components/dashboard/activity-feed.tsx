"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bug,
  CheckSquare,
  FolderKanban,
  History,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  action: string;
  entityType: string;
  entityTitle: string;
  createdAt: Date;
  meta?: Record<string, unknown> | null;
};

const ENTITY_ICON: Record<string, LucideIcon> = {
  project: FolderKanban,
  task: CheckSquare,
  bug: Bug,
  note: StickyNote,
};

const ACTION_COLOR: Record<string, string> = {
  created: "bg-blue-400",
  updated: "bg-zinc-400",
  completed: "bg-emerald-400",
  fixed: "bg-emerald-400",
  deleted: "bg-red-400",
  reopened: "bg-amber-400",
  restored: "bg-sky-400",
  archived: "bg-amber-400",
  converted: "bg-violet-400",
};

const ACTION_LABEL: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  completed: "Completed",
  fixed: "Fixed",
  deleted: "Deleted",
  reopened: "Reopened",
  restored: "Restored",
  archived: "Archived",
  converted: "Converted",
};

const ENTITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "project", label: "Projects" },
  { value: "task", label: "Tasks" },
  { value: "bug", label: "Bugs" },
  { value: "note", label: "Notes" },
];

const DATE_FILTERS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function withinRange(date: Date, range: string) {
  if (range === "all") return true;
  const t = new Date(date).getTime();
  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  const days = range === "7d" ? 7 : 30;
  return t >= Date.now() - days * 86_400_000;
}

function ActivityRow({ item }: { item: Activity }) {
  const Icon = ENTITY_ICON[item.entityType] ?? History;
  const fromTitle =
    typeof item.meta?.fromTitle === "string" ? item.meta.fromTitle : null;
  const source =
    typeof item.meta?.source === "string" ? item.meta.source : null;
  const suffix =
    item.action === "converted" && fromTitle
      ? ` from ${fromTitle}`
      : item.action === "restored" && source === "archive"
        ? " from archive"
        : "";
  return (
    <li className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/40">
      <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
            ACTION_COLOR[item.action] ?? "bg-zinc-400",
          )}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          <span className="text-muted-foreground">
            {ACTION_LABEL[item.action] ?? item.action}
          </span>{" "}
          {item.entityType}{" "}
          <span className="font-medium">{item.entityTitle}</span>
          {suffix ? (
            <span className="text-muted-foreground">{suffix}</span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(item.createdAt, { addSuffix: true })}
        </p>
      </div>
    </li>
  );
}

export function ActivityFeed({
  items,
  filterable = false,
}: {
  items: Activity[];
  filterable?: boolean;
}) {
  const [entity, setEntity] = React.useState("all");
  const [action, setAction] = React.useState("all");
  const [range, setRange] = React.useState("all");

  const actionsAvailable = React.useMemo(
    () => Array.from(new Set(items.map((i) => i.action))).sort(),
    [items],
  );

  const filtered = React.useMemo(() => {
    if (!filterable) return items;
    return items.filter(
      (i) =>
        (entity === "all" || i.entityType === entity) &&
        (action === "all" || i.action === action) &&
        withinRange(i.createdAt, range),
    );
  }, [items, filterable, entity, action, range]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Your recent actions will appear here as you work."
        className="py-10"
      />
    );
  }

  const selectClass =
    "rounded-md border bg-transparent px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-3">
      {filterable ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {ENTITY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setEntity(f.value)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors",
                  entity === f.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              aria-label="Filter by action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className={selectClass}
            >
              <option value="all">All actions</option>
              {actionsAvailable.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL[a] ?? a}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by date"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className={selectClass}
            >
              {DATE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No activity matches these filters.
        </p>
      ) : (
        <ul className="space-y-1">
          {filtered.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
