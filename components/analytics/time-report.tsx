import { Clock } from "lucide-react";

import type { TimeReport } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function TimeReportCard({ report }: { report: TimeReport }) {
  const t = getT();
  const maxDay = Math.max(1, ...report.perDay);
  const maxProj = Math.max(1, ...report.perProject.map((p) => p.seconds));
  const hasData = report.allTime > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {t("tr.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("tr.today")} value={fmt(report.todayTotal)} />
          <Stat label={t("tr.week")} value={fmt(report.weekTotal)} />
          <Stat label={t("tr.allTime")} value={fmt(report.allTime)} />
        </div>

        {hasData ? (
          <>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">{t("tr.week")}</p>
              <div className="flex h-24 items-end gap-2">
                {report.perDay.map((s, i) => (
                  <div
                    key={i}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-primary/70"
                        style={{ height: `${Math.max(2, (s / maxDay) * 100)}%` }}
                        title={fmt(s)}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {DAYS[i][0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {report.perProject.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t("tr.byProject")}
                </p>
                {report.perProject.map((p) => (
                  <div key={p.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate">{p.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmt(p.seconds)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(p.seconds / maxProj) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("tr.empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
