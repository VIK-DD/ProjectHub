"use client";

import * as React from "react";

import type { ProjectOption } from "@/types/entities";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";

// Listens for the global "projecthub:quickadd" event (fired by the `c`
// shortcut or the command palette) and opens a fast new-task dialog anywhere.
export function QuickCapture({ projects }: { projects: ProjectOption[] }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("projecthub:quickadd", handler);
    return () => window.removeEventListener("projecthub:quickadd", handler);
  }, []);

  return (
    <TaskFormDialog open={open} onOpenChange={setOpen} projects={projects} />
  );
}
