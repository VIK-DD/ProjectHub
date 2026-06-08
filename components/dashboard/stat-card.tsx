import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconClass?: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <Card className="group relative h-full p-5 transition-colors hover:border-border/80 hover:bg-card/80">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            iconClass ?? "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {href ? (
        <ArrowUpRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
      ) : null}
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
