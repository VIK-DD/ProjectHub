"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { useUndoToast } from "@/components/use-undo-toast";

import { deleteBug, updateBugStatus } from "@/lib/actions/bugs";
import { restoreBug } from "@/lib/actions/trash";
import { BUG_SEVERITIES, BUG_STATUSES, findMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { BugDTO, ProjectOption } from "@/types/entities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusPill } from "@/components/status-pill";
import { MetaSelect } from "@/components/meta-select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BugFormDialog } from "@/components/bugs/bug-form-dialog";

type BugRowData = BugDTO & { projectName?: string | null };

export function BugRow({
  bug,
  projects,
  defaultOpen = false,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  bug: BugRowData;
  projects: ProjectOption[];
  defaultOpen?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (checked: boolean) => void;
}) {
  const router = useRouter();
  const undoToast = useUndoToast();
  const [editOpen, setEditOpen] = React.useState(defaultOpen);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [optimisticStatus, setOptimisticStatus] = React.useState(bug.status);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setOptimisticStatus(bug.status);
  }, [bug.id, bug.status]);

  React.useEffect(() => {
    if (defaultOpen) setEditOpen(true);
  }, [defaultOpen]);

  const hasDetails =
    bug.description || bug.stepsToReproduce || bug.fixNotes;

  function changeStatus(status: string) {
    setOptimisticStatus(status);
    startTransition(async () => {
      const res = await updateBugStatus(bug.id, status);
      if (!res.ok) {
        setOptimisticStatus(bug.status);
        toast.error(res.error);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div
        className={cn(
          "rounded-lg border bg-card transition-colors hover:border-border/80",
          selected && "border-primary/50 bg-primary/5",
        )}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          {selectionMode ? (
            <Checkbox
              checked={selected}
              onCheckedChange={(c) => onToggleSelect?.(Boolean(c))}
              aria-label="Select bug"
            />
          ) : null}
          <button
            onClick={() => hasDetails && setExpanded((v) => !v)}
            className={cn(
              "rounded-md p-1 text-muted-foreground",
              hasDetails
                ? "hover:bg-accent hover:text-foreground"
                : "cursor-default opacity-30",
            )}
            aria-label="Toggle details"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>

          <button
            onClick={() => setEditOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block truncate text-sm font-medium">
              {bug.title}
            </span>
            {bug.projectName ? (
              <span className="truncate text-xs text-muted-foreground">
                {bug.projectName}
              </span>
            ) : null}
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <StatusPill meta={findMeta(BUG_SEVERITIES, bug.severity)} />
            <StatusPill meta={findMeta(BUG_STATUSES, optimisticStatus)} />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Bug actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleteOpen(true)}
                className="text-red-400 focus:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {expanded && hasDetails ? (
          <div className="space-y-4 border-t px-4 py-4 text-sm">
            {bug.description ? (
              <p className="text-foreground/90">{bug.description}</p>
            ) : null}

            {bug.stepsToReproduce ? (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" />
                  Steps to reproduce
                </p>
                <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-sans text-sm text-foreground/90">
                  {bug.stepsToReproduce}
                </pre>
              </div>
            ) : null}

            {bug.fixNotes ? (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" />
                  Fix notes
                </p>
                <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-sans text-sm text-foreground/90">
                  {bug.fixNotes}
                </pre>
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs font-medium text-muted-foreground">
                Status
              </span>
              <div className="w-44">
                <MetaSelect
                  value={optimisticStatus}
                  onChange={changeStatus}
                  options={BUG_STATUSES}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <BugFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        bug={bug}
        projects={projects}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete bug?"
        description={`"${bug.title}" will be permanently removed.`}
        onConfirm={async () => {
          const res = await deleteBug(bug.id);
          if (res.ok) {
            undoToast("Bug deleted", () => restoreBug(bug.id));
            router.refresh();
          }
          return res;
        }}
      />
    </>
  );
}
