"use client";

import * as React from "react";

import type { UserLite } from "@/types/entities";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNASSIGNED = "unassigned";

export function AssigneeSelect({
  projectId,
  value,
  onChange,
}: {
  projectId: string | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const [members, setMembers] = React.useState<UserLite[]>([]);

  React.useEffect(() => {
    if (!projectId) {
      setMembers([]);
      return;
    }
    let active = true;
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => {
        if (active) setMembers(d.members ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [projectId]);

  const val = projectId ? value || UNASSIGNED : UNASSIGNED;

  return (
    <Select
      value={val}
      onValueChange={(v) => onChange(v === UNASSIGNED ? "" : v)}
      disabled={!projectId}
    >
      <SelectTrigger>
        <SelectValue placeholder={projectId ? "Unassigned" : "Pick a project first"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name || "Member"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
