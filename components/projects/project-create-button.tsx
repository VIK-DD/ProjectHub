"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { useT } from "@/components/i18n-provider";

export function ProjectCreateButton({
  defaultOpen = false,
  label,
}: {
  defaultOpen?: boolean;
  label?: string;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {label ?? t("action.newProject")}
      </Button>
      <ProjectFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
