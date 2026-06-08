"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRightLeft,
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  convertNoteToBug,
  convertNoteToTask,
  deleteNote,
  toggleNotePin,
} from "@/lib/actions/notes";
import { restoreNote } from "@/lib/actions/trash";
import { useUndoToast } from "@/components/use-undo-toast";
import { cn } from "@/lib/utils";
import type { NoteDTO, ProjectOption } from "@/types/entities";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NoteFormDialog } from "@/components/notes/note-form-dialog";

type NoteCardData = NoteDTO & {
  projectName?: string | null;
  updatedAt: Date;
};

export function NoteCard({
  note,
  projects,
  defaultOpen = false,
}: {
  note: NoteCardData;
  projects: ProjectOption[];
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const undoToast = useUndoToast();
  const [editOpen, setEditOpen] = React.useState(defaultOpen);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [optimisticPinned, setOptimisticPinned] = React.useState(note.pinned);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setOptimisticPinned(note.pinned);
  }, [note.id, note.pinned]);

  React.useEffect(() => {
    if (defaultOpen) setEditOpen(true);
  }, [defaultOpen]);

  const excerpt = note.content
    .replace(/[#>*_`~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();

  function togglePin(e: React.MouseEvent) {
    e.stopPropagation();
    const nextPinned = !optimisticPinned;
    setOptimisticPinned(nextPinned);
    startTransition(async () => {
      const res = await toggleNotePin(note.id);
      if (!res.ok) {
        setOptimisticPinned(note.pinned);
        toast.error(res.error);
      }
      router.refresh();
    });
  }

  return (
    <>
      <Card
        onClick={() => setEditOpen(true)}
        className="group flex h-full cursor-pointer flex-col p-4 transition-colors hover:border-border/80 hover:bg-card/70"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-medium">{note.title}</h3>
          <div className="flex items-center">
            <button
              onClick={togglePin}
              className={cn(
                "rounded-md p-1 transition-colors hover:bg-accent",
                optimisticPinned
                  ? "text-primary"
                  : "text-muted-foreground opacity-0 group-hover:opacity-100",
              )}
              aria-label={optimisticPinned ? "Unpin" : "Pin"}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button
                  className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  aria-label="Note actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    startTransition(async () => {
                      const res = await convertNoteToTask(note.id);
                      if (!res.ok) return void toast.error(res.error);
                      toast.success("Task created from note");
                      router.push(`/tasks/${res.id}`);
                      router.refresh();
                    })
                  }
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Convert to task
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    startTransition(async () => {
                      const res = await convertNoteToBug(note.id);
                      if (!res.ok) return void toast.error(res.error);
                      toast.success("Bug created from note");
                      router.push(`/bugs?bug=${res.id}`);
                      router.refresh();
                    })
                  }
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Convert to bug
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    startTransition(async () => {
                      const nextPinned = !optimisticPinned;
                      setOptimisticPinned(nextPinned);
                      const res = await toggleNotePin(note.id);
                      if (!res.ok) {
                        setOptimisticPinned(note.pinned);
                        toast.error(res.error);
                      }
                      router.refresh();
                    })
                  }
                >
                  {optimisticPinned ? (
                    <PinOff className="h-4 w-4" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                  {optimisticPinned ? "Unpin" : "Pin"}
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
        </div>

        <p className="mt-2 line-clamp-4 flex-1 text-sm text-muted-foreground">
          {excerpt || "Empty note"}
        </p>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          {note.projectName ? (
            <span className="flex items-center gap-1 truncate">
              <FolderKanban className="h-3 w-3" />
              {note.projectName}
            </span>
          ) : (
            <span>Personal</span>
          )}
          <span className="ml-auto shrink-0">
            {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
          </span>
        </div>
      </Card>

      <NoteFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        note={note}
        projects={projects}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete note?"
        description={`"${note.title}" will be permanently removed.`}
        onConfirm={async () => {
          const res = await deleteNote(note.id);
          if (res.ok) {
            undoToast("Note deleted", () => restoreNote(note.id));
            router.refresh();
          }
          return res;
        }}
      />
    </>
  );
}
