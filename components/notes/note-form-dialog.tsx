"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pin } from "lucide-react";
import { toast } from "sonner";

import { createNote, updateNote } from "@/lib/actions/notes";
import { renderMarkdown, toggleTaskMarker } from "@/lib/markdown";
import type { NoteDTO, ProjectOption } from "@/types/entities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NO_PROJECT, ProjectSelect } from "@/components/project-select";
import { useT } from "@/components/i18n-provider";

export function NoteFormDialog({
  open,
  onOpenChange,
  note,
  projects,
  defaultProjectId,
  defaultTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: NoteDTO | null;
  projects: ProjectOption[];
  defaultProjectId?: string | null;
  defaultTitle?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = React.useTransition();

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [projectId, setProjectId] = React.useState(NO_PROJECT);
  const [pinned, setPinned] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? defaultTitle ?? "");
    setContent(note?.content ?? "");
    setProjectId(note?.projectId ?? defaultProjectId ?? NO_PROJECT);
    setPinned(note?.pinned ?? false);
  }, [open, note, defaultProjectId, defaultTitle]);

  function submit() {
    if (!title.trim()) {
      toast.error("Note title is required");
      return;
    }
    startTransition(async () => {
      const payload = {
        title,
        content,
        projectId: projectId === NO_PROJECT ? "" : projectId,
        pinned,
      };
      const res = note
        ? await updateNote(note.id, payload)
        : await createNote(payload);

      if (res.ok) {
        toast.success(note ? "Note saved" : "Note created");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>
            {note ? t("dialog.note.edit") : t("dialog.note.new")}
          </DialogTitle>
          <DialogDescription>{t("dialog.note.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="n-title">{t("form.title")}</Label>
            <Input
              id="n-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("ph.noteTitle")}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t("form.content")}</Label>
            <Tabs defaultValue="write">
              <TabsList>
                <TabsTrigger value="write">{t("note.write")}</TabsTrigger>
                <TabsTrigger value="preview">{t("note.preview")}</TabsTrigger>
              </TabsList>
              <TabsContent value="write" className="mt-2">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={"# Heading\n\n- bullet\n- **bold** and `code`"}
                  rows={10}
                  className="font-mono text-[13px]"
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div className="min-h-[16rem] rounded-md border bg-muted/20 p-4">
                  {content.trim() ? (
                    <div
                      className="prose-note"
                      onClick={(e) => {
                        const t = e.target as HTMLElement;
                        if (
                          t instanceof HTMLInputElement &&
                          t.type === "checkbox"
                        ) {
                          e.preventDefault();
                          const idx = Number(
                            t.getAttribute("data-task-index"),
                          );
                          if (!Number.isNaN(idx))
                            setContent((c) => toggleTaskMarker(c, idx));
                        }
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(content),
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("note.nothingPreview")}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <div className="space-y-2">
              <Label>{t("form.project")}</Label>
              <ProjectSelect
                value={projectId}
                onChange={setProjectId}
                options={projects}
              />
            </div>
            <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={pinned}
                onCheckedChange={(c) => setPinned(Boolean(c))}
              />
              <span className="flex items-center gap-1.5">
                <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                {t("note.pin")}
              </span>
            </label>
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
            {note ? t("form.save") : t("dialog.note.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
