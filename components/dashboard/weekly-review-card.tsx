import Link from "next/link";
import { ArrowUpRight, Bug, CheckSquare, Clock } from "lucide-react";

import type { WeeklyReview } from "@/lib/weekly-review";

export function WeeklyReviewCard({ review }: { review: WeeklyReview }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Weekly review</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A compact view of momentum and loose ends.
          </p>
        </div>
        <Link
          href="/analytics?tab=review"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Details
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckSquare className="h-3.5 w-3.5" />
            Done
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {review.stats.tasksDone}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Overdue
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {review.stats.overdue}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bug className="h-3.5 w-3.5" />
            New bugs
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {review.stats.bugsCreated}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <p className="text-muted-foreground">Recent wins</p>
        <ul className="space-y-1.5">
          {(review.topCompleted.length > 0
            ? review.topCompleted
            : ["No completed tasks yet this week."]).map((item) => (
            <li key={item} className="truncate">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
