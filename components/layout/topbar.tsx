"use client";

import { Search } from "lucide-react";

import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { Notifications } from "@/components/layout/notifications";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ReminderItem } from "@/lib/data";
import type { NotificationDTO } from "@/types/entities";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function Topbar({
  user,
  reminders,
  notifications,
  unread,
}: {
  user: SessionUser;
  reminders: ReminderItem[];
  notifications: NotificationDTO[];
  unread: number;
}) {
  const openCommand = () =>
    window.dispatchEvent(new Event("projecthub:command"));

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-4 lg:px-6">
      <MobileSidebar />
      <button
        onClick={openCommand}
        className="group flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        <Notifications
          notifications={notifications}
          unread={unread}
          reminders={reminders}
        />
        <LanguageToggle />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
