"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";

export function ActivityChart({
  data,
}: {
  data: { label: string; created: number; completed: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          stroke="hsl(var(--border))"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          dy={6}
          interval="preserveStartEnd"
          minTickGap={20}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ stroke: "hsl(var(--border))" }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Area
          type="monotone"
          dataKey="created"
          name="Created"
          stroke="#a78bfa"
          strokeWidth={2}
          fill="#a78bfa"
          fillOpacity={0.1}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke="#34d399"
          strokeWidth={2}
          fill="#34d399"
          fillOpacity={0.12}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
