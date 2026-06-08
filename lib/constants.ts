// ---------------------------------------------------------------------------
// Single source of truth for every status / priority / severity in the app.
// The UI (badges, selects, board columns) and the validation layer both read
// from here, so colours and labels stay perfectly consistent everywhere.
//
// NOTE: colour classes are written as complete literal strings so Tailwind's
// JIT compiler can see them. Never build these by string concatenation.
// ---------------------------------------------------------------------------

export type Meta = {
  value: string;
  label: string;
  /** colour classes for a soft badge (border + bg + text) */
  badge: string;
  /** bg colour class for a small status dot */
  dot: string;
  /** plain text colour class */
  text: string;
};

// Reusable colour swatches -------------------------------------------------
const C = {
  zinc: {
    badge: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
    dot: "bg-zinc-400",
    text: "text-zinc-400",
  },
  blue: {
    badge: "border-blue-500/25 bg-blue-500/10 text-blue-400",
    dot: "bg-blue-400",
    text: "text-blue-400",
  },
  violet: {
    badge: "border-violet-500/25 bg-violet-500/10 text-violet-400",
    dot: "bg-violet-400",
    text: "text-violet-400",
  },
  emerald: {
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
  },
  amber: {
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-400",
    dot: "bg-amber-400",
    text: "text-amber-400",
  },
  orange: {
    badge: "border-orange-500/25 bg-orange-500/10 text-orange-400",
    dot: "bg-orange-400",
    text: "text-orange-400",
  },
  red: {
    badge: "border-red-500/25 bg-red-500/10 text-red-400",
    dot: "bg-red-400",
    text: "text-red-400",
  },
} as const;

function meta(value: string, label: string, c: (typeof C)[keyof typeof C]): Meta {
  return { value, label, badge: c.badge, dot: c.dot, text: c.text };
}

// --- Projects --------------------------------------------------------------
export const PROJECT_STATUSES = [
  meta("PLANNING", "Planning", C.zinc),
  meta("ACTIVE", "Active", C.blue),
  meta("ON_HOLD", "On Hold", C.amber),
  meta("COMPLETED", "Completed", C.emerald),
] as const;

// --- Priorities (shared by projects & tasks) -------------------------------
export const PRIORITIES = [
  meta("LOW", "Low", C.zinc),
  meta("MEDIUM", "Medium", C.blue),
  meta("HIGH", "High", C.orange),
  meta("CRITICAL", "Critical", C.red),
] as const;

// --- Tasks -----------------------------------------------------------------
export const TASK_STATUSES = [
  meta("TODO", "Todo", C.zinc),
  meta("IN_PROGRESS", "In Progress", C.blue),
  meta("REVIEW", "Review", C.violet),
  meta("DONE", "Done", C.emerald),
] as const;

// --- Bugs ------------------------------------------------------------------
export const BUG_SEVERITIES = [
  meta("MINOR", "Minor", C.zinc),
  meta("MAJOR", "Major", C.amber),
  meta("CRITICAL", "Critical", C.red),
] as const;

export const BUG_STATUSES = [
  meta("OPEN", "Open", C.red),
  meta("INVESTIGATING", "Investigating", C.amber),
  meta("FIXED", "Fixed", C.emerald),
  meta("CLOSED", "Closed", C.zinc),
] as const;

// --- Helpers ---------------------------------------------------------------
type MetaList = readonly Meta[];

export function findMeta(list: MetaList, value?: string | null): Meta {
  return list.find((m) => m.value === value) ?? list[0];
}

export const values = (list: MetaList) => list.map((m) => m.value);

// Typed unions for the validation layer
export const PROJECT_STATUS_VALUES = values(PROJECT_STATUSES);
export const PRIORITY_VALUES = values(PRIORITIES);
export const TASK_STATUS_VALUES = values(TASK_STATUSES);
export const BUG_SEVERITY_VALUES = values(BUG_SEVERITIES);
export const BUG_STATUS_VALUES = values(BUG_STATUSES);

// Statuses that count as "open" (i.e. still needing attention)
export const OPEN_TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW"];
export const OPEN_BUG_STATUSES = ["OPEN", "INVESTIGATING"];

// Recurrence options for tasks (plain label/value — no colour).
export const RECURRENCE_OPTIONS = [
  { value: "", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
] as const;

export const RECURRENCE_VALUES = ["DAILY", "WEEKLY", "MONTHLY"];

export const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

// A small rotating palette for project accents
export const PROJECT_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#ef4444", // red
  "#3b82f6", // blue
];
