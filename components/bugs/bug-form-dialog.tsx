"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createBug, updateBug } from "@/lib/actions/bugs";
import { BUG_SEVERITIES, BUG_STATUSES } from "@/lib/constants";
import type { BugDTO, ProjectOption } from "@/types/entities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MetaSelect } from "@/components/meta-select";
import { NO_PROJECT, ProjectSelect } from "@/components/project-select";
import { useT } from "@/components/i18n-provider";

export function BugFormDialog({
  open,
  onOpenChange,
  bug,
  projects,
  defaultProjectId,
  defaultTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bug?: BugDTO | null;
  projects: ProjectOption[];
  defaultProjectId?: string | null;
  defaultTitle?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = React.useTransition();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [severity, setSeverity] = React.useState("MINOR");
  const [status, setStatus] = React.useState("OPEN");
  const [projectId, setProjectId] = React.useState(NO_PROJECT);
  const [steps, setSteps] = React.useState("");
  const [fixNotes, setFixNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setTitle(bug?.title ?? defaultTitle ?? "");
    setDescription(bug?.description ?? "");
    setSeverity(bug?.severity ?? "MINOR");
    setStatus(bug?.status ?? "OPEN");
    setProjectId(bug?.projectId ?? defaultProjectId ?? NO_PROJECT);
    setSteps(bug?.stepsToReproduce ?? "");
    setFixNotes(bug?.fixNotes ?? "");
  }, [open, bug, defaultProjectId, defaultTitle]);

  function submit() {
    if (!title.trim()) {
      toast.error("Bug title is required");
      return;
    }
    startTransition(async () => {
      const payload = {
        title,
        description,
        severity,
        status,
        projectId: projectId === NO_PROJECT ? "" : projectId,
        stepsToReproduce: steps,
        fixNotes,
      };
      const res = bug
        ? await updateBug(bug.id, payload)
        : await createBug(payload);

      if (res.ok) {
        toast.success(bug ? "Bug updated" : "Bug reported");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>
            {bug ? t("dialog.bug.edit") : t("dialog.bug.new")}
          </DialogTitle>
          <DialogDescription>{t("dialog.bug.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="b-title">{t("form.title")}</Label>
            <Input
              id="b-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("ph.bugTitle")}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="b-desc">{t("form.description")}</Label>
            <Textarea
              id="b-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("ph.bugDesc")}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("form.severity")}</Label>
              <MetaSelect
                value={severity}
                onChange={setSeverity}
                options={BUG_SEVERITIES}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("form.status")}</Label>
              <MetaSelect
                value={status}
                onChange={setStatus}
                options={BUG_STATUSES}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("form.project")}</Label>
            <ProjectSelect
              value={projectId}
              onChange={setProjectId}
              options={projects}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="b-steps">{t("form.steps")}</Label>
            <Textarea
              id="b-steps"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder={"1. …\n2. …\n3. …"}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="b-fix">{t("form.fixNotes")}</Label>
            <Textarea
              id="b-fix"
              value={fixNotes}
              onChange={(e) => setFixNotes(e.target.value)}
              placeholder={t("ph.fixNotes")}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {bug ? t("form.save") : t("dialog.bug.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
