"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { addComment } from "@/lib/actions/comments";
import { getInitials } from "@/lib/utils";
import type { CommentDTO } from "@/types/entities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/components/i18n-provider";

export function TaskComments({ taskId }: { taskId: string }) {
  const t = useT();
  const [comments, setComments] = React.useState<CommentDTO[]>([]);
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const load = React.useCallback(() => {
    fetch(`/api/tasks/${taskId}/comments`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => setComments(d.comments ?? []))
      .catch(() => {});
  }, [taskId]);

  React.useEffect(() => {
    load();
  }, [load]);

  function submit() {
    const clean = body.trim();
    if (!clean) return;
    startTransition(async () => {
      const res = await addComment(taskId, clean);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody("");
      load();
    });
  }

  return (
    <div className="space-y-3">
      <Label>
        {t("comp.comments")} {comments.length > 0 ? `· ${comments.length}` : ""}
      </Label>

      {comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7">
                {c.author.image ? <AvatarImage src={c.author.image} alt="" /> : null}
                <AvatarFallback className="text-[10px]">
                  {getInitials(c.author.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">
                    {c.author.name || "User"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("comp.noComments")}</p>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("comp.commentPh")}
          rows={2}
          className="flex-1"
        />
        <Button onClick={submit} disabled={pending || !body.trim()} size="icon">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
