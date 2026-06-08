"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createTask, updateTask } from "@/lib/actions/tasks";
import {
  PRIORITIES,
  RECURRENCE_OPTIONS,
  TASK_STATUSES,
} from "@/lib/constants";
import type { ProjectOption, TaskDTO } from "@/types/entities";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AssigneeSelect } from "@/components/tasks/assignee-select";
import { TaskComments } from "@/components/tasks/task-comments";
import { useT } from "@/components/i18n-provider";

type TFn = (k: string, v?: Record<string, string | number>) => string;

function dateInput(d?: Date | string | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
}

function unitLabel(t: TFn, recurrence: string, n: number) {
  const base =
    recurrence === "DAILY" ? "day" : recurrence === "WEEKLY" ? "week" : "month";
  return t(n === 1 ? `unit.${base}` : `unit.${base}s`);
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  projects,
  defaultProjectId,
  defaultStatus,
  defaultDueDate,
  defaultTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskDTO | null;
  projects: ProjectOption[];
  defaultProjectId?: string | null;
  defaultStatus?: string;
  defaultDueDate?: string;
  defaultTitle?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = React.useTransition();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState("TODO");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [projectId, setProjectId] = React.useState(NO_PROJECT);
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [recurrence, setRecurrence] = React.useState("");
  const [recurrenceInterval, setRecurrenceInterval] = React.useState(1);
  const [recurrenceUntil, setRecurrenceUntil] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? defaultTitle ?? "");
    setDescription(task?.description ?? "");
    setStatus(task?.status ?? defaultStatus ?? "TODO");
    setPriority(task?.priority ?? "MEDIUM");
    setProjectId(task?.projectId ?? defaultProjectId ?? NO_PROJECT);
    setDueDate(task ? dateInput(task.dueDate) : (defaultDueDate ?? ""));
    setNotes(task?.notes ?? "");
    setRecurrence(task?.recurrence ?? "");
    setRecurrenceInterval(task?.recurrenceInterval ?? 1);
    setRecurrenceUntil(dateInput(task?.recurrenceUntil));
    setAssigneeId(task?.assigneeId ?? "");
  }, [open, task, defaultProjectId, defaultStatus, defaultDueDate, defaultTitle]);

  function submit() {
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }
    startTransition(async () => {
      const payload = {
        title,
        description,
        status,
        priority,
        projectId: projectId === NO_PROJECT ? "" : projectId,
        dueDate,
        notes,
        recurrence,
        recurrenceInterval,
        recurrenceUntil,
        assigneeId,
      };
      const res = task
        ? await updateTask(task.id, payload)
        : await createTask(payload);

      if (res.ok) {
        toast.success(task ? "Task updated" : "Task created");
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
            {task ? t("dialog.task.edit") : t("dialog.task.new")}
          </DialogTitle>
          <DialogDescription>
            {task ? t("dialog.task.editDesc") : t("dialog.task.newDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-title">{t("form.title")}</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("ph.taskTitle")}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-desc">{t("form.description")}</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("ph.optional")}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("form.status")}</Label>
              <MetaSelect
                value={status}
                onChange={setStatus}
                options={TASK_STATUSES}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("form.project")}</Label>
              <ProjectSelect
                value={projectId}
                onChange={setProjectId}
                options={projects}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-due">{t("form.dueDate")}</Label>
              <Input
                id="t-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("form.assignee")}</Label>
            <AssigneeSelect
              projectId={projectId === NO_PROJECT ? null : projectId}
              value={assigneeId}
              onChange={setAssigneeId}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("form.repeat")}</Label>
            <Select
              value={recurrence || "none"}
              onValueChange={(v) => setRecurrence(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value || "none"} value={o.value || "none"}>
                    {o.value ? t(`recur.${o.value}`) : t("recur.none")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {recurrence ? (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t("form.every")}</span>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={recurrenceInterval}
                    onChange={(e) =>
                      setRecurrenceInterval(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="h-8 w-16"
                  />
                  <span className="text-muted-foreground">
                    {unitLabel(t, recurrence, recurrenceInterval)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-until" className="text-xs text-muted-foreground">
                    {t("form.endsOn")}
                  </Label>
                  <Input
                    id="t-until"
                    type="date"
                    value={recurrenceUntil}
                    onChange={(e) => setRecurrenceUntil(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-notes">{t("form.notes")}</Label>
            <Textarea
              id="t-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("ph.notes")}
              rows={2}
            />
          </div>

          {task ? (
            <div className="border-t pt-4">
              <TaskComments taskId={task.id} />
            </div>
          ) : null}
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
            {task ? t("form.save") : t("dialog.task.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
