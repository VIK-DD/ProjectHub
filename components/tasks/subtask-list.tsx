"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { addSubtask, deleteSubtask, toggleSubtask } from "@/lib/actions/tasks";
import type { SubtaskDTO } from "@/types/entities";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

export function SubtaskList({
  taskId,
  subtasks,
}: {
  taskId: string;
  subtasks: SubtaskDTO[];
}) {
  const router = useRouter();
  const t = useT();
  const [value, setValue] = React.useState("");
  const [items, setItems] = React.useState(subtasks);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setItems(subtasks);
  }, [subtasks]);

  function add() {
    const title = value.trim();
    if (!title) return;
    setValue("");
    const optimisticId = `optimistic-${Date.now()}`;
    setItems((prev) => [...prev, { id: optimisticId, title, completed: false }]);
    startTransition(async () => {
      const res = await addSubtask(taskId, title);
      if (!res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== optimisticId));
        toast.error(res.error);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      {items.map((s) => (
        <div key={s.id} className="group/sub flex items-center gap-2.5">
          <Checkbox
            checked={s.completed}
            onCheckedChange={() =>
              startTransition(async () => {
                const previous = items;
                setItems((prev) =>
                  prev.map((item) =>
                    item.id === s.id ? { ...item, completed: !item.completed } : item,
                  ),
                );
                const res = await toggleSubtask(s.id);
                if (!res.ok) {
                  setItems(previous);
                  toast.error(res.error);
                }
                router.refresh();
              })
            }
          />
          <span
            className={cn(
              "flex-1 text-sm",
              s.completed && "text-muted-foreground line-through",
            )}
          >
            {s.title}
          </span>
          <button
            onClick={() =>
              startTransition(async () => {
                const previous = items;
                setItems((prev) => prev.filter((item) => item.id !== s.id));
                const res = await deleteSubtask(s.id);
                if (!res.ok) {
                  setItems(previous);
                  toast.error(res.error);
                }
                router.refresh();
              })
            }
            className="text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover/sub:opacity-100"
            aria-label="Delete subtask"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t("comp.addSubtask")}
          className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
