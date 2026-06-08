export function DistributionList({
  items,
}: {
  items: { label: string; count: number; color: string }[];
}) {
  const total = items.reduce((s, i) => s + i.count, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No data yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const pct = total === 0 ? 0 : Math.round((it.count / total) * 100);
        return (
          <div key={it.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: it.color }}
                />
                {it.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {it.count}
                <span className="ml-1.5 text-xs">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: it.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
