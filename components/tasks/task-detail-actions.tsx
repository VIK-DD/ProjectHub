"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useUndoToast } from "@/components/use-undo-toast";

import { deleteTask } from "@/lib/actions/tasks";
import { restoreTask } from "@/lib/actions/trash";
import type { ProjectOption, TaskDTO } from "@/types/entities";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";

export function TaskDetailActions({
  task,
  projects,
}: {
  task: TaskDTO;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const undoToast = useUndoToast();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="text-muted-foreground hover:text-red-400"
          aria-label="Delete task"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        projects={projects}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete task?"
        description={`"${task.title}" will move to Trash.`}
        onConfirm={async () => {
          const res = await deleteTask(task.id);
          if (res.ok) {
            undoToast("Task deleted", () => restoreTask(task.id));
            router.push("/tasks");
            router.refresh();
          }
          return res;
        }}
      />
    </>
  );
}
