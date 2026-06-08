"use client";

import { cn } from "@/lib/utils";
import type { Meta } from "@/lib/constants";
import { useT } from "@/components/i18n-provider";

/**
 * A small Linear-style status indicator: a coloured dot + label inside a soft
 * pill. Driven by the Meta objects in lib/constants.ts, label is localized.
 * (Client component, but safe to render from server components as an island.)
 */
export function StatusPill({
  meta,
  className,
  dotOnly = false,
}: {
  meta: Meta;
  className?: string;
  dotOnly?: boolean;
}) {
  const t = useT();
  const label = t(`meta.${meta.value}`);

  if (dotOnly) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
        <span className="text-sm text-foreground/90">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        meta.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {label}
    </span>
  );
}
