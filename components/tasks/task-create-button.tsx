"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import type { ProjectOption } from "@/types/entities";
import { useT } from "@/components/i18n-provider";

export function TaskCreateButton({
  projects,
  defaultOpen = false,
  defaultStatus,
  defaultProjectId,
  defaultTitle,
  variant = "default",
  size = "sm",
  label,
}: {
  projects: ProjectOption[];
  defaultOpen?: boolean;
  defaultStatus?: string;
  defaultProjectId?: string | null;
  defaultTitle?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "icon-sm";
  label?: string;
}) {
  const t = useT();
  const text = label ?? t("action.newTask");
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {size === "icon-sm" ? <span className="sr-only">{text}</span> : text}
      </Button>
      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        projects={projects}
        defaultStatus={defaultStatus}
        defaultProjectId={defaultProjectId}
        defaultTitle={defaultTitle}
      />
    </>
  );
}
