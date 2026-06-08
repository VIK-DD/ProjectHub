"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { toast } from "sonner";

import { startTimer, stopTimer } from "@/lib/actions/tasks";
import { cn } from "@/lib/utils";

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TaskTimer({
  taskId,
  timeSpent,
  timerStartedAt,
}: {
  taskId: string;
  timeSpent: number;
  timerStartedAt: Date | string | null;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [optimisticRunning, setOptimisticRunning] = React.useState(
    Boolean(timerStartedAt),
  );
  const [optimisticStartedAt, setOptimisticStartedAt] = React.useState<
    Date | string | null
  >(timerStartedAt);
  const [optimisticSpent, setOptimisticSpent] = React.useState(timeSpent);
  const running = optimisticRunning;
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    setOptimisticRunning(Boolean(timerStartedAt));
    setOptimisticStartedAt(timerStartedAt);
    setOptimisticSpent(timeSpent);
  }, [taskId, timeSpent, timerStartedAt]);

  React.useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running, timerStartedAt]);

  const extra =
    running && optimisticStartedAt
      ? Math.max(
          0,
          Math.floor((now - new Date(optimisticStartedAt).getTime()) / 1000),
        )
      : 0;
  const total = optimisticSpent + extra;

  function toggle() {
    const startedAt = optimisticStartedAt;
    const spent = optimisticSpent;
    if (running) {
      const elapsed = startedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
        : 0;
      setOptimisticRunning(false);
      setOptimisticStartedAt(null);
      setOptimisticSpent(spent + elapsed);
    } else {
      const next = new Date();
      setNow(next.getTime());
      setOptimisticRunning(true);
      setOptimisticStartedAt(next);
    }
    startTransition(async () => {
      const res = running ? await stopTimer(taskId) : await startTimer(taskId);
      if (!res.ok) {
        setOptimisticRunning(Boolean(timerStartedAt));
        setOptimisticStartedAt(timerStartedAt);
        setOptimisticSpent(timeSpent);
        toast.error(res.error);
      }
      router.refresh();
    });
  }

  if (!running && total === 0) {
    return (
      <button
        onClick={toggle}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Start timer"
        title="Start timer"
      >
        <Play className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-1.5 py-1 font-mono text-xs tabular-nums transition-colors",
        running
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      aria-label={running ? "Stop timer" : "Start timer"}
      title={running ? "Stop timer" : "Start timer"}
    >
      {running ? (
        <Pause className="h-3.5 w-3.5" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
      {formatDuration(total)}
    </button>
  );
}
