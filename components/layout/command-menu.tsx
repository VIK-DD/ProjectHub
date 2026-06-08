"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import {
  Bug,
  CheckSquare,
  FolderKanban,
  LogOut,
  Moon,
  Plus,
  StickyNote,
  Sun,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useT } from "@/components/i18n-provider";

const CREATE_ACTIONS = [
  { label: "New project", href: "/projects?new=1" },
  { label: "New task", href: "/tasks?new=1" },
  { label: "New bug", href: "/bugs?new=1" },
  { label: "New note", href: "/notes?new=1" },
];

type SearchIndex = {
  projects: { id: string; name: string; description?: string }[];
  tasks: { id: string; title: string; description?: string }[];
  bugs: { id: string; title: string; description?: string }[];
  notes: { id: string; title: string; content?: string }[];
  savedViews: {
    id: string;
    name: string;
    entityType: string;
    filters: Record<string, string>;
  }[];
};

const EMPTY: SearchIndex = {
  projects: [],
  tasks: [],
  bugs: [],
  notes: [],
  savedViews: [],
};

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState<SearchIndex>(EMPTY);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const t = useT();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onCustom = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("projecthub:command", onCustom);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("projecthub:command", onCustom);
    };
  }, []);

  // Load the search index whenever the palette opens.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    let active = true;
    fetch("/api/search")
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data: SearchIndex) => {
        if (active) setIndex({ ...EMPTY, ...data });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const searching = query.trim().length > 0;
  const trimmed = query.trim();

  function hrefForSavedView(view: SearchIndex["savedViews"][number]) {
    const params = new URLSearchParams(view.filters);
    return `/${view.entityType}?${params.toString()}`;
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search or jump to…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {searching ? (
          <>
            {index.projects.length > 0 ? (
              <CommandGroup heading="Projects">
                {index.projects.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`project ${p.name}`}
                    onSelect={() => run(() => router.push(`/projects/${p.id}`))}
                  >
                    <FolderKanban className="h-4 w-4" />
                    <div className="min-w-0">
                      <div>{p.name}</div>
                      {p.description ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {p.description}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {index.tasks.length > 0 ? (
              <CommandGroup heading="Tasks">
                {index.tasks.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`task ${t.title}`}
                    onSelect={() => run(() => router.push(`/tasks/${t.id}`))}
                  >
                    <CheckSquare className="h-4 w-4" />
                    <div className="min-w-0">
                      <div>{t.title}</div>
                      {t.description ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {t.description}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {index.bugs.length > 0 ? (
              <CommandGroup heading="Bugs">
                {index.bugs.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={`bug ${b.title}`}
                    onSelect={() => run(() => router.push(`/bugs?bug=${b.id}`))}
                  >
                    <Bug className="h-4 w-4" />
                    <div className="min-w-0">
                      <div>{b.title}</div>
                      {b.description ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {b.description}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {index.notes.length > 0 ? (
              <CommandGroup heading="Notes">
                {index.notes.map((n) => (
                  <CommandItem
                    key={n.id}
                    value={`note ${n.title} ${n.content ?? ""}`}
                    onSelect={() => run(() => router.push(`/notes?note=${n.id}`))}
                  >
                    <StickyNote className="h-4 w-4" />
                    <div className="min-w-0">
                      <div>{n.title}</div>
                      {n.content ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {n.content}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {index.savedViews.length > 0 ? (
              <CommandGroup heading="Saved Views">
                {index.savedViews.map((view) => (
                  <CommandItem
                    key={view.id}
                    value={`view ${view.name} ${view.entityType}`}
                    onSelect={() =>
                      run(() => router.push(hrefForSavedView(view)))
                    }
                  >
                    <FolderKanban className="h-4 w-4" />
                    <div className="min-w-0">
                      <div>{view.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {view.entityType}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            <CommandSeparator />
          </>
        ) : null}

        {trimmed ? (
          <>
            <CommandGroup heading="Quick Actions">
              <CommandItem
                value={`create task ${trimmed}`}
                onSelect={() =>
                  run(() =>
                    router.push(`/tasks?new=1&title=${encodeURIComponent(trimmed)}`),
                  )
                }
              >
                <Plus className="h-4 w-4" />
                Create task &quot;{trimmed}&quot;
              </CommandItem>
              <CommandItem
                value={`create note ${trimmed}`}
                onSelect={() =>
                  run(() =>
                    router.push(`/notes?new=1&title=${encodeURIComponent(trimmed)}`),
                  )
                }
              >
                <Plus className="h-4 w-4" />
                Create note &quot;{trimmed}&quot;
              </CommandItem>
              <CommandItem
                value={`create bug ${trimmed}`}
                onSelect={() =>
                  run(() =>
                    router.push(`/bugs?new=1&title=${encodeURIComponent(trimmed)}`),
                  )
                }
              >
                <Plus className="h-4 w-4" />
                Create bug &quot;{trimmed}&quot;
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`go ${item.label} ${t(item.labelKey)}`}
                onSelect={() => run(() => router.push(item.href))}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Create">
          {CREATE_ACTIONS.map((a) => (
            <CommandItem
              key={a.href}
              value={a.label}
              onSelect={() => run(() => router.push(a.href))}
            >
              <Plus className="h-4 w-4" />
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {index.projects.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="New task in project">
              {index.projects.map((p) => (
                <CommandItem
                  key={`nt-${p.id}`}
                  value={`new task in ${p.name}`}
                  onSelect={() =>
                    run(() => router.push(`/tasks?new=1&project=${p.id}`))
                  }
                >
                  <Plus className="h-4 w-4" />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Preferences">
          <CommandItem
            value="toggle theme dark light"
            onSelect={() =>
              run(() => setTheme(theme === "dark" ? "light" : "dark"))
            }
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            Toggle theme
          </CommandItem>
          <CommandItem
            value="sign out logout"
            onSelect={() =>
              run(() =>
                signOut({ redirect: false }).then(() => {
                  window.location.href = "/login";
                }),
              )
            }
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
