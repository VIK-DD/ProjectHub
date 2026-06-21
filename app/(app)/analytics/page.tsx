import type { Metadata } from "next";
import {
  Bug,
  CheckSquare,
  Clock,
  FolderKanban,
  StickyNote,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { requireUser } from "@/lib/session";
import { getAnalyticsData, getTimeReport } from "@/lib/data";
import { buildWeeklyReview } from "@/lib/weekly-review";
import { getT } from "@/lib/i18n/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { colorFor } from "@/components/analytics/colors";
import { CompletionRing } from "@/components/analytics/completion-ring";
import { DistributionList } from "@/components/analytics/distribution-list";
import { WeeklyBarChart } from "@/components/analytics/weekly-bar-chart";
import { ActivityChart } from "@/components/analytics/activity-chart";
import { TimeReportCard } from "@/components/analytics/time-report";

export const metadata: Metadata = { title: "Analytics" };

function Tile({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function ReviewList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item} className="truncate">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const t = await getT();
  const [data, timeReport, weekly] = await Promise.all([
    getAnalyticsData(user.id),
    getTimeReport(user.id),
    buildWeeklyReview(user.id),
  ]);

  const taskItems = data.taskStatus.map((s) => ({
    label: s.label,
    count: s.count,
    color: colorFor("task", s.value),
  }));
  const projectItems = data.projectStatus.map((s) => ({
    label: s.label,
    count: s.count,
    color: colorFor("project", s.value),
  }));
  const severityItems = data.bugSeverity.map((s) => ({
    label: s.label,
    count: s.count,
    color: colorFor("severity", s.value),
  }));

  const overview = (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          label={t("page.projects.title")}
          value={data.totals.projects}
          icon={FolderKanban}
          iconClass="bg-blue-500/10 text-blue-400"
        />
        <Tile
          label={t("page.tasks.title")}
          value={data.totals.tasks}
          icon={CheckSquare}
          iconClass="bg-violet-500/10 text-violet-400"
        />
        <Tile
          label={t("page.bugs.title")}
          value={data.totals.bugs}
          icon={Bug}
          iconClass="bg-red-500/10 text-red-400"
        />
        <Tile
          label={t("page.notes.title")}
          value={data.totals.notes}
          icon={StickyNote}
          iconClass="bg-amber-500/10 text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("an.completion")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <CompletionRing
              value={data.completion.rate}
              caption={t("an.completedCap")}
            />
            <div className="grid w-full grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xl font-semibold tabular-nums">
                  {data.completion.completedTasks}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("an.ofDone", { n: data.completion.totalTasks })}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="flex items-center justify-center gap-1 text-xl font-semibold tabular-nums">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  {data.tasksThisWeek}
                </p>
                <p className="text-xs text-muted-foreground">{t("an.thisWeek")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("an.perWeek")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("an.last8")}</p>
          </CardHeader>
          <CardContent>
            <WeeklyBarChart data={data.weeklyCompletions} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("an.activity")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("an.activityDesc")}</p>
        </CardHeader>
        <CardContent>
          <ActivityChart data={data.dailyActivity} />
        </CardContent>
      </Card>

      <TimeReportCard report={timeReport} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("an.byStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionList items={taskItems} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("an.projByStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionList items={projectItems} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("page.bugs.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DistributionList items={severityItems} />
            <div className="grid grid-cols-2 gap-3 border-t pt-4 text-center">
              <div>
                <p className="text-xl font-semibold tabular-nums text-red-400">
                  {data.bugs.open}
                </p>
                <p className="text-xs text-muted-foreground">{t("an.open")}</p>
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums text-emerald-400">
                  {data.bugs.closed}
                </p>
                <p className="text-xs text-muted-foreground">{t("an.resolved")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );

  const review = (
    <>
      <p className="text-sm text-muted-foreground">{t("an.reviewDesc")}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Tile
          label={t("an.done")}
          value={weekly.stats.tasksDone}
          icon={CheckSquare}
          iconClass="bg-emerald-500/10 text-emerald-400"
        />
        <Tile
          label={t("an.overdue")}
          value={weekly.stats.overdue}
          icon={Clock}
          iconClass="bg-amber-500/10 text-amber-400"
        />
        <Tile
          label={t("an.openBugs")}
          value={weekly.stats.openBugs}
          icon={Bug}
          iconClass="bg-red-500/10 text-red-400"
        />
        <Tile
          label={t("an.newBugs")}
          value={weekly.stats.bugsCreated}
          icon={Bug}
          iconClass="bg-orange-500/10 text-orange-400"
        />
        <Tile
          label={t("an.activeProjects")}
          value={weekly.stats.projectsActive}
          icon={FolderKanban}
          iconClass="bg-blue-500/10 text-blue-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("an.recentWins")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewList items={weekly.topCompleted} empty={t("an.noWins")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("an.looseEnds")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewList items={weekly.topOverdue} empty={t("an.noOverdue")} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("an.perWeek")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("an.last8")}</p>
        </CardHeader>
        <CardContent>
          <WeeklyBarChart data={data.weeklyCompletions} />
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.analytics.title")}
        description={t("page.analytics.desc")}
      />

      <AnalyticsTabs
        defaultTab={(await searchParams).tab}
        overviewLabel={t("an.tabOverview")}
        reviewLabel={t("an.tabReview")}
        overview={overview}
        review={review}
      />
    </div>
  );
}
