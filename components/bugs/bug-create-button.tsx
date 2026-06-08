"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BugFormDialog } from "@/components/bugs/bug-form-dialog";
import type { ProjectOption } from "@/types/entities";
import { useT } from "@/components/i18n-provider";

export function BugCreateButton({
  projects,
  defaultOpen = false,
  defaultProjectId,
  defaultTitle,
  label,
}: {
  projects: ProjectOption[];
  defaultOpen?: boolean;
  defaultProjectId?: string | null;
  defaultTitle?: string;
  label?: string;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {label ?? t("action.newBug")}
      </Button>
      <BugFormDialog
        open={open}
        onOpenChange={setOpen}
        projects={projects}
        defaultProjectId={defaultProjectId}
        defaultTitle={defaultTitle}
      />
    </>
  );
}
