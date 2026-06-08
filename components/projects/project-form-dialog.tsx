"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createProject, updateProject } from "@/lib/actions/projects";
import {
  PRIORITIES,
  PROJECT_COLORS,
  PROJECT_STATUSES,
} from "@/lib/constants";
import type { ProjectDTO } from "@/types/entities";
import { cn } from "@/lib/utils";
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
import { useT } from "@/components/i18n-provider";

function dateInput(d?: Date | string | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectDTO | null;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = React.useTransition();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState("PLANNING");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [progress, setProgress] = React.useState(0);
  const [tags, setTags] = React.useState("");
  const [color, setColor] = React.useState(PROJECT_COLORS[0]);
  const [startDate, setStartDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  // Re-seed the form whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setStatus(project?.status ?? "PLANNING");
    setPriority(project?.priority ?? "MEDIUM");
    setProgress(project?.progress ?? 0);
    setTags(project?.tags ?? "");
    setColor(project?.color || PROJECT_COLORS[0]);
    setStartDate(dateInput(project?.startDate));
    setDueDate(dateInput(project?.dueDate));
  }, [open, project]);

  function submit() {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    startTransition(async () => {
      const payload = {
        name,
        description,
        status,
        priority,
        progress,
        tags,
        color,
        startDate,
        dueDate,
      };
      const res = project
        ? await updateProject(project.id, payload)
        : await createProject(payload);

      if (res.ok) {
        toast.success(project ? "Project updated" : "Project created");
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
            {project ? t("dialog.project.edit") : t("dialog.project.new")}
          </DialogTitle>
          <DialogDescription>
            {project ? t("dialog.project.editDesc") : t("dialog.project.newDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">{t("form.name")}</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("ph.projectName")}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-desc">{t("form.description")}</Label>
            <Textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("ph.projectDesc")}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("form.status")}</Label>
              <MetaSelect
                value={status}
                onChange={setStatus}
                options={PROJECT_STATUSES}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("form.priority")}</Label>
              <MetaSelect
                value={priority}
                onChange={setPriority}
                options={PRIORITIES}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="p-progress">{t("form.progress")}</Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {progress}%
              </span>
            </div>
            <input
              id="p-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-start">{t("form.startDate")}</Label>
              <Input
                id="p-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-due">{t("form.dueDate")}</Label>
              <Input
                id="p-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-tags">{t("form.tags")}</Label>
            <Input
              id="p-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t("ph.tags")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("form.accentColor")}</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110",
                    color === c ? "ring-ring" : "ring-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Colour ${c}`}
                />
              ))}
            </div>
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
            {project ? t("form.save") : t("dialog.project.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
