"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import {
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
} from "@/lib/actions/members";
import { getInitials } from "@/lib/utils";
import type { MemberDTO } from "@/types/entities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/components/i18n-provider";

const ROLES = ["ADMIN", "MEMBER", "VIEWER"];

export function MembersTab({
  projectId,
  members,
  canManage,
}: {
  projectId: string;
  members: MemberDTO[];
  canManage: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [identifier, setIdentifier] = React.useState("");
  const [role, setRole] = React.useState("MEMBER");
  const [pending, startTransition] = React.useTransition();

  function invite() {
    const id = identifier.trim();
    if (!id) return;
    startTransition(async () => {
      const res = await addProjectMember(projectId, id, role);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Member added");
      setIdentifier("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row">
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                invite();
              }
            }}
            placeholder={t("members.invitePh")}
            className="flex-1"
          />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`role.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {t("members.add")}
          </Button>
        </div>
      ) : null}

      <ul className="divide-y rounded-lg border">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
            <Avatar className="h-8 w-8">
              {m.image ? <AvatarImage src={m.image} alt="" /> : null}
              <AvatarFallback>{getInitials(m.name || m.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name || m.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.email}
              </p>
            </div>

            {m.isOwner ? (
              <Badge variant="soft">{t("role.OWNER")}</Badge>
            ) : canManage ? (
              <div className="flex items-center gap-1.5">
                <Select
                  value={m.role}
                  onValueChange={(v) =>
                    startTransition(async () => {
                      const res = await updateMemberRole(m.id, v);
                      if (!res.ok) toast.error(res.error);
                      router.refresh();
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`role.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      const res = await removeProjectMember(m.id);
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Member removed");
                      router.refresh();
                    })
                  }
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-red-400"
                  aria-label="Remove member"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Badge variant="outline">{t(`role.${m.role}`)}</Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
