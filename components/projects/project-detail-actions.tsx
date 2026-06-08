"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUndoToast } from "@/components/use-undo-toast";

import {
  archiveProject,
  deleteProject,
  unarchiveProject,
} from "@/lib/actions/projects";
import { restoreProject } from "@/lib/actions/trash";
import type { ProjectDTO } from "@/types/entities";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";

export function ProjectDetailActions({
  project,
  canDelete = true,
  archived = false,
}: {
  project: ProjectDTO;
  canDelete?: boolean;
  archived?: boolean;
}) {
  const router = useRouter();
  const undoToast = useUndoToast();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      {canDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                (archived ? unarchiveProject(project.id) : archiveProject(project.id))
                  .then((res) => {
                    if (!res.ok) toast.error(res.error);
                    else {
                      toast.success(
                        archived ? "Project unarchived" : "Project archived",
                      );
                      if (!archived) router.push("/projects");
                      router.refresh();
                    }
                  })
              }
            >
              <Archive className="h-4 w-4" />
              {archived ? "Unarchive project" : "Archive project"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setDeleteOpen(true)}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={`"${project.name}" and its tasks, bugs and notes move to Trash (recoverable).`}
        onConfirm={async () => {
          const res = await deleteProject(project.id);
          if (res.ok) {
            undoToast("Project deleted", () => restoreProject(project.id));
            router.push("/projects");
            router.refresh();
          }
          return res;
        }}
      />
    </>
  );
}
