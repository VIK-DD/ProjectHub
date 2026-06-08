"use client";

type TooltipPayloadItem = {
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
};

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl">
      {label ? (
        <div className="mb-1.5 font-medium text-foreground">{label}</div>
      ) : null}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color || p.fill }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
