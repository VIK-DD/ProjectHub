"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, isPast, isToday } from "date-fns";
import {
  Bug,
  CalendarDays,
  CheckSquare,
  Archive,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useUndoToast } from "@/components/use-undo-toast";

import {
  archiveProject,
  deleteProject,
  unarchiveProject,
} from "@/lib/actions/projects";
import { restoreProject } from "@/lib/actions/trash";
import { findMeta, PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";
import { cn, parseTags } from "@/lib/utils";
import type { ProjectDTO } from "@/types/entities";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/status-pill";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";

type Props = {
  project: ProjectDTO & { taskCount?: number; bugCount?: number };
  shared?: boolean;
  archived?: boolean;
};

export function ProjectCard({ project, shared, archived = false }: Props) {
  const router = useRouter();
  const undoToast = useUndoToast();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const tags = parseTags(project.tags);
  const due = project.dueDate ? new Date(project.dueDate) : null;
  const overdue = due ? isPast(due) && !isToday(due) : false;

  return (
    <>
      <Card
        onClick={() => router.push(`/projects/${project.id}`)}
        className="group flex cursor-pointer flex-col p-5 transition-colors hover:border-border/80 hover:bg-card/70"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color || "#6366f1" }}
            />
            <h3 className="truncate font-medium">{project.name}</h3>
            {shared ? (
              <Badge variant="soft" className="shrink-0">
                Shared
              </Badge>
            ) : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button
                className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                aria-label="Project actions"
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
                  (archived ? unarchiveProject(project.id) : archiveProject(project.id))
                    .then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.success(
                          archived ? "Project unarchived" : "Project archived",
                        );
                        router.refresh();
                      }
                    })
                }
              >
                <Archive className="h-4 w-4" />
                {archived ? "Unarchive" : "Archive"}
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

        {project.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {project.description}
          </p>
        ) : null}

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="tabular-nums">{project.progress}%</span>
          </div>
          <Progress value={project.progress} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPill meta={findMeta(PROJECT_STATUSES, project.status)} />
            <StatusPill meta={findMeta(PRIORITIES, project.priority)} />
            {archived ? <Badge variant="soft">Archived</Badge> : null}
          </div>

        {tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="soft">
                {t}
              </Badge>
            ))}
            {tags.length > 3 ? (
              <Badge variant="soft">+{tags.length - 3}</Badge>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" />
            {project.taskCount ?? 0}
          </span>
          <span className="flex items-center gap-1.5">
            <Bug className="h-3.5 w-3.5" />
            {project.bugCount ?? 0}
          </span>
          {due ? (
            <span
              className={cn(
                "ml-auto flex items-center gap-1.5",
                overdue && "text-red-400",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {format(due, "MMM d")}
            </span>
          ) : null}
        </div>
      </Card>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={`"${project.name}" will be removed. Its tasks, bugs and notes will be unassigned.`}
        onConfirm={async () => {
          const res = await deleteProject(project.id);
          if (res.ok) {
            undoToast("Project deleted", () => restoreProject(project.id));
            router.refresh();
          }
          return res;
        }}
      />
    </>
  );
}
