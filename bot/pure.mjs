// ProjectHub bot — pure, side-effect-free helpers.
//
// Extracted from bot.mjs so the easy-to-break logic (date math, due-date
// parsing, access-control where-clauses, callback routing, mention parsing)
// can be unit-tested WITHOUT Telegram or Prisma. bot.mjs imports everything
// from here (single source of truth); tests/bot.test.ts imports it too.

// HTML-escape for Telegram parse_mode: "HTML".
export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// --- date windows ----------------------------------------------------------
export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
export const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};
export const startOfWeek = () => {
  const d = startOfToday();
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - day);
  return d;
};
export const startOfTomorrow = () => {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
};
export const endOfTomorrow = () => {
  const d = endOfToday();
  d.setDate(d.getDate() + 1);
  return d;
};
export const pad2 = (n) => String(n).padStart(2, "0");

// Short relative due-date suffix shown next to a task title.
export function fmtDue(due) {
  if (!due) return "";
  const d = new Date(due);
  const t = startOfToday();
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day < t) return " · ⚠️ overdue";
  if (day.getTime() === t.getTime()) return " · 📅 today";
  return " · 📅 " + d.toLocaleDateString();
}

// Map a due-date quick-choice to an actual Date (noon, to dodge DST edges).
export function dueFromChoice(choice) {
  if (choice === "none") return null;
  const d = startOfToday();
  d.setHours(12, 0, 0, 0);
  if (choice === "tomorrow") d.setDate(d.getDate() + 1);
  else if (choice === "3d") d.setDate(d.getDate() + 3);
  else if (choice === "week") d.setDate(d.getDate() + 7);
  return d;
}

// Human duration from a seconds count (e.g. 3720 → "1h 2m").
export function fmtDur(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// While typing a comment, detect a trailing "@handle" we should autocomplete.
// Returns the lowercased partial handle, "" for a bare "@", or null otherwise.
export function pendingMentionQuery(text) {
  const match = text.match(/(?:^|\s)@([a-z0-9_]*)$/i);
  return match ? match[1].toLowerCase() : null;
}

// Recover the task id a replied-to message refers to, by reading the task id
// out of its inline-keyboard callback_data. Used for "reply = comment".
export function inlineTaskIdFromMessage(msg) {
  const rows = msg?.reply_markup?.inline_keyboard || [];
  for (const row of rows) {
    for (const btn of row) {
      const data = btn?.callback_data || "";
      const m = data.match(/^(?:ts|cmt|done|snooze):([^:]+)$/);
      if (m) return m[1];
      const parts = data.split(":");
      if (parts[0] === "setstatus" || parts[0] === "setprio" || parts[0] === "setdue")
        return parts[1];
      if (
        ["tstatus", "tprio", "tdue", "tassign", "ttitle", "tdelete", "ttimer"].includes(
          parts[0],
        )
      )
        return parts[1];
    }
  }
  return null;
}

// --- access control (Prisma where-clauses; pure object builders) -----------
// Tasks a user may see in a list: own, assigned to them, or in their projects.
export function taskAccessFilter(userId) {
  return {
    OR: [
      { userId },
      { assigneeId: userId },
      { project: { OR: [{ userId }, { members: { some: { userId } } }] } },
    ],
  };
}

// Single-task access guard: same rule as taskAccessFilter, scoped to one id.
export function accessTaskWhere(userId, id) {
  return {
    id,
    OR: [
      { userId },
      { assigneeId: userId },
      { project: { OR: [{ userId }, { members: { some: { userId } } }] } },
    ],
  };
}

// --- callback_data routing builders ----------------------------------------
export const bugBackData = (bugId, page, projectId) =>
  projectId ? `bug:${bugId}:${page}:${projectId}` : `bug:${bugId}:${page}`;

export function noteBackData(page, projectId) {
  return projectId ? `notes:${page}:${projectId}` : `notes:${page}`;
}

export function noteOpenData(noteId, page, projectId) {
  return projectId ? `note:${noteId}:${page}:${projectId}` : `note:${noteId}:${page}`;
}
