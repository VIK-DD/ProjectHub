"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  Activity,
  AtSign,
  Bell,
  CheckSquare,
  Clock,
  FolderKanban,
  MessageSquare,
  UserPlus,
} from "lucide-react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import type { NotificationDTO } from "@/types/entities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Reminder = {
  id: string;
  type: "task" | "project";
  title: string;
  dueDate: Date | string;
  context: string | null;
};

const TYPE_ICON: Record<string, typeof Bell> = {
  ASSIGNED: UserPlus,
  COMMENT: MessageSquare,
  MENTION: AtSign,
  PROJECT: FolderKanban,
  STATUS: Activity,
  DUE: Clock,
  OVERDUE: Clock,
  WEEKLY_REVIEW: Activity,
};

function hrefFor(entityType: string | null, entityId: string | null) {
  if (entityType === "project" && entityId) return `/projects/${entityId}`;
  if (entityType === "task") return entityId ? `/tasks/${entityId}` : "/tasks";
  if (entityType === "weekly_review") return "/analytics";
  return "/dashboard";
}

export function Notifications({
  notifications,
  unread,
  reminders,
}: {
  notifications: NotificationDTO[];
  unread: number;
  reminders: Reminder[];
}) {
  const router = useRouter();
  const t = useT();
  const [, startTransition] = React.useTransition();
  const [items, setItems] = React.useState(notifications);
  const [localUnread, setLocalUnread] = React.useState(unread);
  const badge = localUnread + reminders.length;

  React.useEffect(() => setItems(notifications), [notifications]);
  React.useEffect(() => setLocalUnread(unread), [unread]);

  function open(n: NotificationDTO) {
    if (!n.read) {
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
      );
      setLocalUnread((count) => Math.max(0, count - 1));
    }
    startTransition(async () => {
      if (!n.read) await markNotificationRead(n.id);
      router.push(hrefFor(n.entityType, n.entityId));
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {badge > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {badge}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">{t("notif.title")}</DropdownMenuLabel>
          {localUnread > 0 ? (
            <button
              onClick={() =>
                startTransition(async () => {
                  setItems((prev) => prev.map((item) => ({ ...item, read: true })));
                  setLocalUnread(0);
                  await markAllNotificationsRead();
                })
              }
              className="text-xs text-primary hover:underline"
            >
              {t("notif.markAll")}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {notifications.length === 0 && reminders.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("notif.empty")}
            </p>
          ) : null}

          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent",
                  !n.read && "bg-primary/5",
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  {n.body ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {n.body}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(n.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {!n.read ? (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                ) : null}
              </button>
            );
          })}

          {reminders.length > 0 ? (
            <>
              <DropdownMenuLabel className="mt-1 text-xs text-muted-foreground">
                {t("notif.upcoming")}
              </DropdownMenuLabel>
              {reminders.map((item) => {
                const due = new Date(item.dueDate);
                const today = isToday(due);
                const overdue = isPast(due) && !today;
                const Icon =
                  item.type === "task" ? CheckSquare : FolderKanban;
                const href =
                  item.type === "task"
                    ? `/tasks/${item.id}`
                    : `/projects/${item.id}`;
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={href}
                    className="flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.title}</p>
                      {item.context ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {item.context}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        overdue
                          ? "text-red-400"
                          : today
                            ? "text-amber-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {overdue ? "Overdue" : today ? "Today" : format(due, "MMM d")}
                    </span>
                  </Link>
                );
              })}
            </>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
