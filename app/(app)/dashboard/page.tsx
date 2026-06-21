import type { Metadata } from "next";
import {
  Bug,
  CheckCircle2,
  CheckSquare,
  FolderKanban,
  TrendingUp,
} from "lucide-react";

import { requireUser } from "@/lib/session";
import { getActivityLog, getDashboardData } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { buildWeeklyReview } from "@/lib/weekly-review";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DeadlinesList } from "@/components/dashboard/deadlines-list";
import { ProjectProgressList } from "@/components/dashboard/project-progress-list";
import { CompletionChart } from "@/components/dashboard/completion-chart";
import { WeeklyReviewCard } from "@/components/dashboard/weekly-review-card";
import { ProjectCreateButton } from "@/components/projects/project-create-button";

export const metadata: Metadata = { title: "Dashboard" };

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "greeting.morning";
  if (h < 18) return "greeting.afternoon";
  return "greeting.evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, review, activity] = await Promise.all([
    getDashboardData(user.id),
    buildWeeklyReview(user.id),
    getActivityLog(user.id, 60),
  ]);
  const t = await getT();
  const firstName = (user.name || user.email || "there").split(/[\s@]/)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t(greetingKey())}, ${firstName}`}
        description={t("page.dashboard.desc")}
      >
        <ProjectCreateButton />
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dash.activeProjects")}
          value={data.stats.activeProjects}
          icon={FolderKanban}
          iconClass="bg-blue-500/10 text-blue-400"
          href="/projects"
        />
        <StatCard
          label={t("dash.openTasks")}
          value={data.stats.openTasks}
          icon={CheckSquare}
          iconClass="bg-violet-500/10 text-violet-400"
          href="/tasks"
        />
        <StatCard
          label={t("dash.openBugs")}
          value={data.stats.openBugs}
          icon={Bug}
          iconClass="bg-red-500/10 text-red-400"
          href="/bugs"
        />
        <StatCard
          label={t("dash.completedTasks")}
          value={data.stats.completedTasks}
          icon={CheckCircle2}
          iconClass="bg-emerald-500/10 text-emerald-400"
          href="/tasks"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">{t("dash.productivity")}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("dash.productivityDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold tabular-nums">
                  {data.tasksDoneThisWeek}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("dash.thisWeek")}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <CompletionChart data={data.completionSeries} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("dash.recentActivity")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={activity} filterable />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <WeeklyReviewCard review={review} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("dash.upcoming")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DeadlinesList items={data.deadlines} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("dash.progress")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectProgressList projects={data.progressProjects} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
