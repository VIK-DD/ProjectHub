"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Flag, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  addMilestone,
  deleteMilestone,
  toggleMilestone,
} from "@/lib/actions/milestones";
import { cn } from "@/lib/utils";
import type { MilestoneDTO } from "@/types/entities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { useT } from "@/components/i18n-provider";

export function MilestoneList({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: MilestoneDTO[];
}) {
  const router = useRouter();
  const t = useT();
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState("");
  const [, startTransition] = React.useTransition();

  const done = milestones.filter((m) => m.completed).length;
  const pct =
    milestones.length === 0
      ? 0
      : Math.round((done / milestones.length) * 100);

  function add() {
    const clean = title.trim();
    if (!clean) return;
    setTitle("");
    setDue("");
    startTransition(async () => {
      const res = await addMilestone(projectId, clean, due || undefined);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {milestones.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("comp.completeN", { done, total: milestones.length })}
            </span>
            <span className="tabular-nums font-medium">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
      ) : (
        <EmptyState
          icon={Flag}
          title={t("comp.milestonesEmpty.t")}
          description={t("comp.milestonesEmpty.d")}
          className="py-10"
        />
      )}

      {milestones.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {milestones.map((m) => (
            <li
              key={m.id}
              className="group flex items-center gap-3 px-3 py-2.5"
            >
              <Checkbox
                checked={m.completed}
                onCheckedChange={() =>
                  startTransition(async () => {
                    await toggleMilestone(m.id);
                    router.refresh();
                  })
                }
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  m.completed && "text-muted-foreground line-through",
                )}
              >
                {m.title}
              </span>
              {m.dueDate ? (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(m.dueDate), "MMM d")}
                </span>
              ) : null}
              <button
                onClick={() =>
                  startTransition(async () => {
                    await deleteMilestone(m.id);
                    router.refresh();
                  })
                }
                className="text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                aria-label="Delete milestone"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t("comp.newMilestone")}
          className="flex-1"
        />
        <Input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="sm:w-44"
        />
        <Button onClick={add}>
          <Plus className="h-4 w-4" />
          {t("comp.add")}
        </Button>
      </div>
    </div>
  );
}
