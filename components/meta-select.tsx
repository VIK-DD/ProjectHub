"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Meta } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

/** A Select whose options come from a Meta[] list, each with a colour dot. */
export function MetaSelect({
  value,
  onChange,
  options,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly Meta[];
  placeholder?: string;
  id?: string;
}) {
  const t = useT();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", o.dot)} />
              {t(`meta.${o.value}`)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
