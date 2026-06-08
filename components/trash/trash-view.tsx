"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  purgeBug,
  purgeNote,
  purgeProject,
  purgeTask,
  restoreBug,
  restoreNote,
  restoreProject,
  restoreTask,
} from "@/lib/actions/trash";
import type { Result } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useT } from "@/components/i18n-provider";

type Item = { id: string; label: string };
type ActionFn = (id: string) => Promise<Result>;

export function TrashView({
  projects,
  tasks,
  bugs,
  notes,
}: {
  projects: Item[];
  tasks: Item[];
  bugs: Item[];
  notes: Item[];
}) {
  const router = useRouter();
  const t = useT();
  const [, startTransition] = React.useTransition();
  const [purge, setPurge] = React.useState<{
    fn: ActionFn;
    id: string;
    label: string;
  } | null>(null);

  function run(fn: ActionFn, id: string, msg: string) {
    startTransition(async () => {
      const res = await fn(id);
      if (!res.ok) toast.error(res.error);
      else toast.success(msg);
      router.refresh();
    });
  }

  const sections: {
    title: string;
    items: Item[];
    restore: ActionFn;
    purge: ActionFn;
    note?: string;
  }[] = [
    {
      title: t("trash.projects"),
      items: projects,
      restore: restoreProject,
      purge: purgeProject,
      note: t("trash.restoreNote"),
    },
    { title: t("trash.tasks"), items: tasks, restore: restoreTask, purge: purgeTask },
    { title: t("trash.bugs"), items: bugs, restore: restoreBug, purge: purgeBug },
    { title: t("trash.notes"), items: notes, restore: restoreNote, purge: purgeNote },
  ];

  return (
    <div className="space-y-6">
      {sections.map((s) =>
        s.items.length === 0 ? null : (
          <div key={s.title} className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {s.title} · {s.items.length}
            </h2>
            <Card>
              <CardContent className="divide-y p-0">
                {s.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {item.label}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => run(s.restore, item.id, "Restored")}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t("trash.restore")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-red-400"
                      aria-label={t("trash.deleteForever")}
                      onClick={() =>
                        setPurge({ fn: s.purge, id: item.id, label: item.label })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ),
      )}

      <ConfirmDialog
        open={purge !== null}
        onOpenChange={(o) => !o && setPurge(null)}
        title={t("trash.deleteForeverQ")}
        description={
          purge
            ? `"${purge.label}" will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel={t("trash.deleteForever")}
        onConfirm={async () => {
          if (!purge) return { ok: true as const };
          const res = await purge.fn(purge.id);
          if (res.ok) {
            toast.success("Deleted forever");
            router.refresh();
          }
          return res;
        }}
      />
    </div>
  );
}
