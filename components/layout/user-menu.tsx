"use client";

import Link from "next/link";
import { LogOut, Settings, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function UserMenu({ user }: { user: SessionUser }) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full outline-none ring-ring ring-offset-2 ring-offset-background focus-visible:ring-2"
          aria-label="Account menu"
        >
          <Avatar className="h-8 w-8">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>
              {getInitials(user.name || user.email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {user.name || t("menu.account")}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-foreground">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            {t("menu.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-foreground">
          <Link href="/trash">
            <Trash2 className="h-4 w-4" />
            {t("menu.trash")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            // Sign out without letting NextAuth build an absolute URL from
            // NEXTAUTH_URL (which would force localhost). Navigate relative to
            // the current origin instead — works on any host (LAN IP, etc.).
            signOut({ redirect: false }).then(() => {
              window.location.href = "/login";
            })
          }
          className="text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t("menu.signout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
