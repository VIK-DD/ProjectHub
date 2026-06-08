"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { deleteAttachment } from "@/lib/actions/attachments";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";

type Att = { id: string; filename: string; mimeType: string; size: number };

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachments({
  attachments,
  taskId,
  projectId,
}: {
  attachments: Att[];
  taskId?: string;
  projectId?: string;
}) {
  const router = useRouter();
  const t = useT();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [, startTransition] = React.useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    if (taskId) form.append("taskId", taskId);
    if (projectId) form.append("projectId", projectId);
    setUploading(true);
    try {
      const res = await fetch("/api/attachments", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Upload failed");
        return;
      }
      toast.success("Uploaded");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteAttachment(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Removed");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="h-4 w-4" />
          {t("comp.attachments")}{" "}
          {attachments.length > 0 ? `· ${attachments.length}` : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          {t("comp.upload")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={onPick}
        />
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("comp.noAttachments")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((a) => {
            const isImage = a.mimeType.startsWith("image/");
            return (
              <div
                key={a.id}
                className="group relative overflow-hidden rounded-lg border bg-card"
              >
                <a
                  href={`/api/attachments/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/attachments/${a.id}`}
                      alt={a.filename}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-muted/30">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="truncate text-xs font-medium">{a.filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {fmtSize(a.size)}
                    </p>
                  </div>
                </a>
                <button
                  onClick={() => remove(a.id)}
                  className="absolute right-1 top-1 rounded-md bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
