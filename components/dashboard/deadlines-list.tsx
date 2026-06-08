import { format, isPast, isToday } from "date-fns";
import { CalendarClock, CheckSquare, FolderKanban } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

type Deadline = {
  id: string;
  type: "task" | "project";
  title: string;
  dueDate: Date;
  context: string | null;
};

export function DeadlinesList({ items }: { items: Deadline[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No upcoming deadlines"
        description="Add due dates to tasks and projects to track them here."
        className="py-10"
      />
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((d) => {
        const today = isToday(d.dueDate);
        const overdue = isPast(d.dueDate) && !today;
        const Icon = d.type === "task" ? CheckSquare : FolderKanban;
        return (
          <li
            key={`${d.type}-${d.id}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/40"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{d.title}</p>
              {d.context ? (
                <p className="truncate text-xs text-muted-foreground">
                  {d.context}
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                "shrink-0 text-xs font-medium tabular-nums",
                overdue
                  ? "text-red-400"
                  : today
                    ? "text-amber-400"
                    : "text-muted-foreground",
              )}
            >
              {overdue ? "Overdue" : today ? "Today" : format(d.dueDate, "MMM d")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
