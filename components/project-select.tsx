"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectOption } from "@/types/entities";
import { useT } from "@/components/i18n-provider";

// Radix Select can't use an empty-string value, so we use a sentinel.
export const NO_PROJECT = "none";

export function ProjectSelect({
  value,
  onChange,
  options,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ProjectOption[];
  id?: string;
}) {
  const t = useT();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={t("project.none")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_PROJECT}>{t("project.none")}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
