// ProjectHub — Telegram bot v2 (premium, account-linked).
//
// • Long-polling (no webhook → safe behind Tailscale).
// • Every Telegram chat is linked to exactly one ProjectHub account via /link.
// • Unlinked chats can ONLY /start, /link, /help — no data access.
// • Inline-keyboard UI: dashboard, guided task creation, task center, projects,
//   search. No "random text = task" — creation is always confirmed.
//
// Run:  npm run bot      (or pm2 start bot/bot.mjs --name projecthub-bot)
//
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  esc,
  startOfToday,
  endOfToday,
  startOfWeek,
  startOfTomorrow,
  endOfTomorrow,
  pad2,
  fmtDue,
  dueFromChoice,
  fmtDur,
  pendingMentionQuery,
  inlineTaskIdFromMessage,
  taskAccessFilter,
  accessTaskWhere,
  bugBackData,
  noteBackData,
  noteOpenData,
} from "./pure.mjs";

// --- tiny .env loader (no dependency) --------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
try {
  const raw = readFileSync(join(ROOT, ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  /* rely on real env */
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DIGEST_HOUR = Number(process.env.TELEGRAM_DIGEST_HOUR ?? 8);
const BACKUP_HOUR = Number(process.env.TELEGRAM_BACKUP_HOUR ?? 3);

if (!TOKEN) {
  console.error("[bot] TELEGRAM_BOT_TOKEN missing in .env — bot disabled.");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

// Soft-delete filter: hide trashed rows from all bot reads (mirrors the web).
const SOFT_MODELS = new Set(["Task", "Project", "Bug", "Note"]);
const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (SOFT_MODELS.has(model) && READ_OPS.has(operation)) {
          args.where = args.where ?? {};
          if (!("deletedAt" in args.where)) args.where.deletedAt = null;
        }
        return query(args);
      },
    },
  },
});

// --- Telegram API helpers --------------------------------------------------
async function tg(method, payload) {
  try {
    const res = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    console.error(`[bot] ${method}:`, e?.message);
    return { ok: false };
  }
}
const send = (chat, text, kb) =>
  tg("sendMessage", {
    chat_id: chat,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(kb ? { reply_markup: kb } : {}),
  });
const edit = (chat, mid, text, kb) =>
  tg("editMessageText", {
    chat_id: chat,
    message_id: mid,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(kb ? { reply_markup: kb } : {}),
  }).then((res) => {
    if (res?.ok) return res;
    const desc = String(res?.description || "");
    if (
      desc.includes("message is not modified") ||
      desc.includes("query is too old") ||
      desc.includes("query ID is invalid")
    ) {
      return res;
    }
    if (
      desc.includes("message can't be edited") ||
      desc.includes("message to edit not found")
    ) {
      return send(chat, text, kb);
    }
    return res;
  });
const answer = (id, text) =>
  tg("answerCallbackQuery", { callback_query_id: id, text });

// --- helpers ---------------------------------------------------------------
const PRIO = { CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢" };
// esc, date windows (startOf*/endOf*), pad2 and fmtDue are imported from
// ./pure.mjs (single source of truth, unit-tested in tests/bot.test.ts).

const getUser = (chatId) =>
  prisma.user.findUnique({ where: { telegramChatId: String(chatId) } });

const LIST_PAGE_SIZE = 8;
const SEARCH_PAGE_SIZE = 12;

// taskAccessFilter + inlineTaskIdFromMessage are imported from ./pure.mjs.

// --- in-memory conversation state (per chat) -------------------------------
const sessions = new Map();
const setSession = (chat, s) => sessions.set(String(chat), s);
const getSession = (chat) => sessions.get(String(chat));
const clearSession = (chat) => sessions.delete(String(chat));

// --- keyboards -------------------------------------------------------------
const homeKb = () => ({
  inline_keyboard: [
    [
      { text: "📋 My Tasks", callback_data: "mytasks" },
      { text: "📁 Projects", callback_data: "projects" },
    ],
    [
      { text: "🐛 Bugs", callback_data: "bugs:0" },
      { text: "📝 Notes", callback_data: "notes:0" },
    ],
    [
      { text: "➕ Create", callback_data: "create" },
      { text: "🔍 Search", callback_data: "search" },
    ],
    [{ text: "⚙️ Notifications", callback_data: "settings" }],
  ],
});
const backHome = () => ({
  inline_keyboard: [[{ text: "⬅️ Home", callback_data: "home" }]],
});
const myTasksKb = () => ({
  inline_keyboard: [
    [
      { text: "📅 Today", callback_data: "t:today" },
      { text: "⚠️ Overdue", callback_data: "t:overdue" },
    ],
    [
      { text: "🗓 This week", callback_data: "t:week" },
      { text: "📂 All open", callback_data: "t:open" },
    ],
    [{ text: "🙋 Assigned to me", callback_data: "t:assigned" }],
    [{ text: "⬅️ Home", callback_data: "home" }],
  ],
});
const taskKb = (id) => ({
  inline_keyboard: [
    [
      { text: "✅ Done", callback_data: `done:${id}` },
      { text: "⏰ +1 day", callback_data: `snooze:${id}` },
    ],
    [
      { text: "📋 Open", callback_data: `ts:${id}` },
      { text: "💬 Comment", callback_data: `cmt:${id}` },
    ],
  ],
});
const createKb = () => ({
  inline_keyboard: [
    [
      { text: "📋 Task", callback_data: "new" },
      { text: "📁 Project", callback_data: "newproj" },
    ],
    [
      { text: "🐛 Bug", callback_data: "newbug" },
      { text: "📝 Note", callback_data: "newnote" },
    ],
    [{ text: "⬅️ Home", callback_data: "home" }],
  ],
});
const recurKb = () => ({
  inline_keyboard: [
    [{ text: "🚫 No repeat", callback_data: "nrec:none" }],
    [
      { text: "Daily", callback_data: "nrec:DAILY" },
      { text: "Weekly", callback_data: "nrec:WEEKLY" },
      { text: "Monthly", callback_data: "nrec:MONTHLY" },
    ],
    [{ text: "✖️ Cancel", callback_data: "ncancel" }],
  ],
});
const priorityKb = () => ({
  inline_keyboard: [
    [
      { text: "🟢 Low", callback_data: "npri:LOW" },
      { text: "🟡 Medium", callback_data: "npri:MEDIUM" },
    ],
    [
      { text: "🟠 High", callback_data: "npri:HIGH" },
      { text: "🔴 Critical", callback_data: "npri:CRITICAL" },
    ],
    [{ text: "✖️ Cancel", callback_data: "ncancel" }],
  ],
});
const dueKb = () => ({
  inline_keyboard: [
    [
      { text: "Today", callback_data: "ndue:today" },
      { text: "Tomorrow", callback_data: "ndue:tomorrow" },
    ],
    [
      { text: "In 3 days", callback_data: "ndue:3d" },
      { text: "No date", callback_data: "ndue:none" },
    ],
    [{ text: "✖️ Cancel", callback_data: "ncancel" }],
  ],
});
const reviewKb = () => ({
  inline_keyboard: [
    [
      { text: "✅ Create", callback_data: "nok" },
      { text: "✖️ Cancel", callback_data: "ncancel" },
    ],
  ],
});
const quickKb = () => ({
  inline_keyboard: [
    [{ text: "✅ Quick add", callback_data: "qa:create" }],
    [{ text: "📁 Choose project", callback_data: "qa:project" }],
    [{ text: "✖️ Cancel", callback_data: "ncancel" }],
  ],
});

// --- dashboard -------------------------------------------------------------
async function dashboardText(user) {
  const uid = user.id;
  const [open, dueToday, overdue, active, doneWeek] = await Promise.all([
    prisma.task.count({ where: { userId: uid, status: { not: "DONE" } } }),
    prisma.task.count({
      where: {
        userId: uid,
        status: { not: "DONE" },
        dueDate: { gte: startOfToday(), lte: endOfToday() },
      },
    }),
    prisma.task.count({
      where: {
        userId: uid,
        status: { not: "DONE" },
        dueDate: { lt: startOfToday() },
      },
    }),
    prisma.project.count({ where: { userId: uid, status: "ACTIVE" } }),
    prisma.task.count({
      where: { userId: uid, status: "DONE", completedAt: { gte: startOfWeek() } },
    }),
  ]);
  return (
    `🏠 <b>ProjectHub</b>\n\n` +
    `Welcome back, ${esc(user.name || "there")}.\n\n` +
    `<b>Today's overview</b>\n` +
    `• Open tasks: <b>${open}</b>\n` +
    `• Due today: <b>${dueToday}</b>\n` +
    `• Overdue: <b>${overdue}</b>\n` +
    `• Active projects: <b>${active}</b>\n` +
    `• Completed this week: <b>${doneWeek}</b>`
  );
}

async function showHome(chat, user, mid) {
  const text = await dashboardText(user);
  if (mid) await edit(chat, mid, text, homeKb());
  else await send(chat, text, homeKb());
}

// --- task lists ------------------------------------------------------------
function pagerRow(prefix, page, hasMore, extra = []) {
  const row = [];
  if (page > 0) row.push({ text: "◀️ Prev", callback_data: `${prefix}:${page - 1}` });
  if (hasMore) row.push({ text: "Next ▶️", callback_data: `${prefix}:${page + 1}` });
  return row.length > 0 ? [row, ...extra] : extra;
}

async function listTasks(chat, user, where, title, empty, opts = {}) {
  const page = Number(opts.page || 0);
  const baseWhere =
    opts.scope === "assigned"
      ? { assigneeId: user.id }
      : opts.scope === "accessible"
        ? taskAccessFilter(user.id)
        : { userId: user.id };
  const tasks = await prisma.task.findMany({
    where: { ...baseWhere, ...where },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    skip: page * LIST_PAGE_SIZE,
    take: LIST_PAGE_SIZE + 1,
    include: { project: { select: { name: true } } },
  });
  const pageItems = tasks.slice(0, LIST_PAGE_SIZE);
  const hasMore = tasks.length > LIST_PAGE_SIZE;
  const lines = pageItems.map((t, i) => {
    const proj = t.project ? ` · 📁 ${esc(t.project.name)}` : "";
    return `${page * LIST_PAGE_SIZE + i + 1}. ${PRIO[t.priority] || "🟡"} ${esc(t.title)}${fmtDue(t.dueDate)}${proj}`;
  });
  const kb = {
    inline_keyboard: [
      ...pageItems.map((t) => [{ text: `📋 ${t.title}`, callback_data: `ts:${t.id}` }]),
      ...pagerRow(opts.pagePrefix || "tp", page, hasMore, [[{ text: "⬅️ Home", callback_data: opts.back || "home" }]]),
    ],
  };
  const text =
    pageItems.length > 0
      ? `<b>${title}</b>\n\n${lines.join("\n")}`
      : `<b>${title}</b>\n\n${empty}`;
  if (opts.mid) await edit(chat, opts.mid, text, kb);
  else await send(chat, text, kb);
}

// --- projects --------------------------------------------------------------
async function showProjects(chat, user, mid, page = 0) {
  const projects = await prisma.project.findMany({
    where: {
      OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }],
    },
    orderBy: { updatedAt: "desc" },
    skip: page * LIST_PAGE_SIZE,
    take: LIST_PAGE_SIZE + 1,
    include: { _count: { select: { tasks: true } } },
  });
  const pageItems = projects.slice(0, LIST_PAGE_SIZE);
  const hasMore = projects.length > LIST_PAGE_SIZE;
  if (pageItems.length === 0) {
    return void edit(chat, mid, "📁 <b>Projects</b>\n\nNo projects yet.", backHome());
  }
  const rows = pageItems.map((p) => [
    { text: `📁 ${p.name} (${p._count.tasks})`, callback_data: `proj:${p.id}` },
  ]);
  rows.push(...pagerRow("projects", page, hasMore, [[{ text: "⬅️ Home", callback_data: "home" }]]));
  await edit(chat, mid, "📁 <b>Your Projects</b>", { inline_keyboard: rows });
}

async function showProject(chat, user, mid, projectId) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }],
    },
  });
  if (!project) return void edit(chat, mid, "Project not found.", backHome());
  const [open, done] = await Promise.all([
    prisma.task.count({ where: { projectId, status: { not: "DONE" } } }),
    prisma.task.count({ where: { projectId, status: "DONE" } }),
  ]);
  const text =
    `📁 <b>${esc(project.name)}</b>\n\n` +
    `Status: ${esc(project.status)} · Progress: ${project.progress}%\n` +
    `Open tasks: <b>${open}</b> · Completed: <b>${done}</b>`;
  await edit(chat, mid, text, {
    inline_keyboard: [
      [{ text: "➕ Create Task", callback_data: `np:${project.id}` }],
      [{ text: "🐛 New Bug", callback_data: `newbug:${project.id}` }],
      [{ text: "📝 New Note", callback_data: `newnote:${project.id}` }],
      [{ text: "📋 View Tasks", callback_data: `pt:${project.id}` }],
      [{ text: "🐛 Project Bugs", callback_data: `bugs:0:${project.id}` }],
      [{ text: "📝 Project Notes", callback_data: `notes:0:${project.id}` }],
      [{ text: "⬅️ Projects", callback_data: "projects" }],
    ],
  });
}

const BUG_SEVERITY = { MINOR: "🟢", MAJOR: "🟠", CRITICAL: "🔴" };
const BUG_STATUS = {
  OPEN: "Open",
  INVESTIGATING: "Investigating",
  FIXED: "Fixed",
  CLOSED: "Closed",
};

async function showBugs(chat, user, mid, page = 0, projectId = null) {
  const where = {
    userId: user.id,
    ...(projectId ? { projectId } : {}),
  };
  const bugs = await prisma.bug.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip: page * LIST_PAGE_SIZE,
    take: LIST_PAGE_SIZE + 1,
    include: { project: { select: { name: true } } },
  });
  const pageItems = bugs.slice(0, LIST_PAGE_SIZE);
  const hasMore = bugs.length > LIST_PAGE_SIZE;
  const rows = pageItems.map((b) => [
    {
      text: `${BUG_SEVERITY[b.severity] || "🐛"} ${b.title}`,
      callback_data: `bug:${b.id}:${page}${projectId ? `:${projectId}` : ""}`,
    },
  ]);
  const nav = [];
  if (page > 0) nav.push({ text: "◀️ Prev", callback_data: projectId ? `bugs:${page - 1}:${projectId}` : `bugs:${page - 1}` });
  if (hasMore) nav.push({ text: "Next ▶️", callback_data: projectId ? `bugs:${page + 1}:${projectId}` : `bugs:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: projectId ? "⬅️ Project" : "⬅️ Home", callback_data: projectId ? `proj:${projectId}` : "home" }]);
  const title = projectId ? "🐛 <b>Project Bugs</b>" : "🐛 <b>Bugs</b>";
  const text =
    pageItems.length > 0
      ? `${title}\n\n${pageItems
          .map(
            (b, i) =>
              `${page * LIST_PAGE_SIZE + i + 1}. ${BUG_SEVERITY[b.severity] || "🐛"} ${esc(b.title)} · ${BUG_STATUS[b.status] || b.status}${b.project ? ` · 📁 ${esc(b.project.name)}` : ""}`,
          )
          .join("\n")}`
      : `${title}\n\nNo bugs yet.`;
  await edit(chat, mid, text, { inline_keyboard: rows });
}

async function showBug(chat, user, mid, bugId, page = 0, projectId = null) {
  const bug = await prisma.bug.findFirst({
    where: { id: bugId, userId: user.id },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!bug) return void edit(chat, mid, "Bug not found.", backHome());
  const lines = [
    `${BUG_SEVERITY[bug.severity] || "🐛"} <b>${esc(bug.title)}</b>`,
    `Status: ${BUG_STATUS[bug.status] || esc(bug.status)}`,
    `Severity: ${esc(bug.severity)}`,
  ];
  if (bug.project) lines.push(`📁 ${esc(bug.project.name)}`);
  if (bug.description) lines.push(`\n${esc(bug.description)}`);
  await edit(chat, mid, lines.join("\n"), {
    inline_keyboard: [
      [
        { text: "🔄 Status", callback_data: `bsm:${bug.id}:${page}:${projectId || ""}` },
        { text: "⚡ Severity", callback_data: `bsv:${bug.id}:${page}:${projectId || ""}` },
      ],
      [{ text: "🗑 Delete", callback_data: `bdelete:${bug.id}:${page}:${projectId || ""}` }],
      [
        {
          text: projectId ? "⬅️ Bugs" : "⬅️ All Bugs",
          callback_data: projectId ? `bugs:${page}:${projectId}` : `bugs:${page}`,
        },
      ],
    ],
  });
}

const BUG_RESOLVED = ["FIXED", "CLOSED"];

// Mirrors lib/actions/bugs.ts: set resolvedAt on FIXED/CLOSED, log fixed/updated.
async function applyBugStatus(user, bug, status) {
  const nowResolved = BUG_RESOLVED.includes(status);
  await prisma.bug.update({
    where: { id: bug.id },
    data: { status, resolvedAt: nowResolved ? bug.resolvedAt ?? new Date() : null },
  });
  try {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action:
          !BUG_RESOLVED.includes(bug.status) && nowResolved ? "fixed" : "updated",
        entityType: "bug",
        entityId: bug.id,
        entityTitle: bug.title,
      },
    });
  } catch {
    /* non-fatal */
  }
}

// bugBackData is imported from ./pure.mjs.

async function showBugStatusMenu(chat, mid, bugId, page, projectId) {
  await edit(chat, mid, "🐛 Set bug status:", {
    inline_keyboard: [
      [
        { text: "🆕 Open", callback_data: `sbs:${bugId}:OPEN` },
        { text: "🔍 Investigating", callback_data: `sbs:${bugId}:INVESTIGATING` },
      ],
      [
        { text: "✅ Fixed", callback_data: `sbs:${bugId}:FIXED` },
        { text: "🚪 Closed", callback_data: `sbs:${bugId}:CLOSED` },
      ],
      [{ text: "⬅️ Back", callback_data: bugBackData(bugId, page, projectId) }],
    ],
  });
}

async function showBugSevMenu(chat, mid, bugId, page, projectId) {
  await edit(chat, mid, "⚡ Set bug severity:", {
    inline_keyboard: [
      [
        { text: "🟢 Minor", callback_data: `sbv:${bugId}:MINOR` },
        { text: "🟠 Major", callback_data: `sbv:${bugId}:MAJOR` },
        { text: "🔴 Critical", callback_data: `sbv:${bugId}:CRITICAL` },
      ],
      [{ text: "⬅️ Back", callback_data: bugBackData(bugId, page, projectId) }],
    ],
  });
}

async function showNotes(chat, user, mid, page = 0, projectId = null) {
  const notes = await prisma.note.findMany({
    where: {
      userId: user.id,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    skip: page * LIST_PAGE_SIZE,
    take: LIST_PAGE_SIZE + 1,
    include: { project: { select: { name: true } } },
  });
  const pageItems = notes.slice(0, LIST_PAGE_SIZE);
  const hasMore = notes.length > LIST_PAGE_SIZE;
  const rows = pageItems.map((n) => [
    {
      text: `${n.pinned ? "📌 " : "📝 "}${n.title}`,
      callback_data: `note:${n.id}:${page}${projectId ? `:${projectId}` : ""}`,
    },
  ]);
  const nav = [];
  if (page > 0) nav.push({ text: "◀️ Prev", callback_data: projectId ? `notes:${page - 1}:${projectId}` : `notes:${page - 1}` });
  if (hasMore) nav.push({ text: "Next ▶️", callback_data: projectId ? `notes:${page + 1}:${projectId}` : `notes:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: projectId ? "⬅️ Project" : "⬅️ Home", callback_data: projectId ? `proj:${projectId}` : "home" }]);
  const title = projectId ? "📝 <b>Project Notes</b>" : "📝 <b>Notes</b>";
  const text =
    pageItems.length > 0
      ? `${title}\n\n${pageItems
          .map((n, i) => {
            const preview = n.content ? esc(n.content).replace(/\s+/g, " ").slice(0, 50) : "No content";
            return `${page * LIST_PAGE_SIZE + i + 1}. ${n.pinned ? "📌" : "📝"} ${esc(n.title)}${n.project ? ` · 📁 ${esc(n.project.name)}` : ""}\n${preview}${n.content && n.content.length > 50 ? "..." : ""}`;
          })
          .join("\n\n")}`
      : `${title}\n\nNo notes yet.`;
  await edit(chat, mid, text, { inline_keyboard: rows });
}

// noteBackData + noteOpenData are imported from ./pure.mjs.

async function showNote(chat, user, mid, noteId, page = 0, projectId = null) {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: user.id },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!note) return void edit(chat, mid, "Note not found.", backHome());
  const content = note.content ? esc(note.content).slice(0, 3500) : "Empty note.";
  const lines = [`📝 <b>${esc(note.title)}</b>`];
  if (note.project) lines.push(`📁 ${esc(note.project.name)}`);
  if (note.pinned) lines.push("📌 Pinned");
  lines.push("", content);
  await edit(chat, mid, lines.join("\n"), {
    inline_keyboard: [
      [
        { text: "✏️ Edit content", callback_data: `nedit:${note.id}:${page}:${projectId || ""}` },
        { text: "🗑 Delete", callback_data: `ndelete:${note.id}:${page}:${projectId || ""}` },
      ],
      [
        { text: "📋 Convert to task", callback_data: `nconvtask:${note.id}:${page}:${projectId || ""}` },
        { text: "🐛 Convert to bug", callback_data: `nconvbug:${note.id}:${page}:${projectId || ""}` },
      ],
      [
        {
          text: projectId ? "⬅️ Notes" : "⬅️ All Notes",
          callback_data: noteBackData(page, projectId),
        },
      ],
    ],
  });
}

// --- notification settings -------------------------------------------------
async function showSettings(chat, userId, mid) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;
  const mark = (b) => (b ? "✅" : "⬜");
  const kb = {
    inline_keyboard: [
      [{ text: `${mark(u.notifyMorning)} Morning report (${pad2(u.morningHour)}:00)`, callback_data: "pref:notifyMorning" }],
      [{ text: `${mark(u.notifyEvening)} Evening report (${pad2(u.eveningHour)}:00)`, callback_data: "pref:notifyEvening" }],
      [{ text: `${mark(u.notifyAssigned)} Assignments`, callback_data: "pref:notifyAssigned" }],
      [{ text: `${mark(u.notifyComments)} Comments`, callback_data: "pref:notifyComments" }],
      [{ text: `${mark(u.notifyMentions)} Mentions`, callback_data: "pref:notifyMentions" }],
      [{ text: `${mark(u.notifyReminders)} Deadline reminders`, callback_data: "pref:notifyReminders" }],
      [{ text: "⬅️ Home", callback_data: "home" }],
    ],
  };
  await edit(
    chat,
    mid,
    "⚙️ <b>Notification settings</b>\nTap to toggle. Change report times in the web app.",
    kb,
  );
}

const PREF_FIELDS = [
  "notifyMorning",
  "notifyEvening",
  "notifyAssigned",
  "notifyComments",
  "notifyMentions",
  "notifyReminders",
];

// --- guided task creation --------------------------------------------------
async function startCreate(chat, user, mid) {
  const projects = await prisma.project.findMany({
    where: {
      OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }],
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: { id: true, name: true },
  });
  const rows = projects.map((p) => [
    { text: `📁 ${p.name}`, callback_data: `np:${p.id}` },
  ]);
  rows.unshift([{ text: "📥 No project (inbox)", callback_data: "np:none" }]);
  rows.push([{ text: "✖️ Cancel", callback_data: "ncancel" }]);
  await edit(chat, mid, "➕ <b>New task</b>\n\nStep 1 · Choose a project:", {
    inline_keyboard: rows,
  });
}

async function createTask(user, s) {
  return prisma.task.create({
    data: {
      userId: user.id,
      assigneeId: s.assigneeId !== undefined ? s.assigneeId : user.id,
      title: s.title,
      priority: s.priority || "MEDIUM",
      projectId: s.projectId || null,
      dueDate: s.due || null,
      recurrence: s.recurrence || null,
      recurrenceInterval: 1,
      status: "TODO",
    },
  });
}

// dueFromChoice is imported from ./pure.mjs.

async function recomputeProgress(projectId) {
  if (!projectId) return;
  const [total, done] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.task.count({ where: { projectId, status: "DONE" } }),
  ]);
  await prisma.project.update({
    where: { id: projectId },
    data: { progress: total ? Math.round((done / total) * 100) : 0 },
  });
}

async function logActivity(userId, action, id, title, entityType = "task") {
  try {
    await prisma.activityLog.create({
      data: { userId, action, entityType, entityId: id, entityTitle: title },
    });
  } catch {
    /* non-fatal */
  }
}

async function createCommentOnTask(user, taskId, body) {
  const clean = body.trim();
  if (!clean) return { ok: false, error: "Comment can't be empty." };
  if (clean.length > 4000) return { ok: false, error: "Comment is too long." };
  const task = await prisma.task.findFirst({
    where: accessTaskWhere(user.id, taskId),
    select: {
      id: true,
      title: true,
      userId: true,
      projectId: true,
      assigneeId: true,
    },
  });
  if (!task) return { ok: false, error: "Task not found." };

  const comment = await prisma.comment.create({
    data: { taskId, userId: user.id, body: clean },
  });

  const recipients = new Set();
  if (task.userId !== user.id) recipients.add(task.userId);
  if (task.assigneeId && task.assigneeId !== user.id) recipients.add(task.assigneeId);
  const snippet = clean.length > 120 ? `${clean.slice(0, 120)}…` : clean;
  for (const uid of recipients) {
    await prisma.notification.create({
      data: {
        userId: uid,
        type: "COMMENT",
        title: `New comment on “${task.title}”`,
        body: snippet,
        entityType: "task",
        entityId: taskId,
      },
    });
  }

  const handles = [...clean.matchAll(/@([a-z0-9_]+)/gi)].map((m) =>
    m[1].toLowerCase(),
  );
  if (handles.length) {
    const mentioned = await prisma.user.findMany({
      where: { username: { in: handles } },
      select: { id: true },
    });
    for (const m of mentioned) {
      if (m.id === user.id || recipients.has(m.id)) continue;
      await prisma.notification.create({
        data: {
          userId: m.id,
          type: "MENTION",
          title: `${user.name || "Someone"} mentioned you`,
          body: snippet,
          entityType: "task",
          entityId: taskId,
        },
      });
    }
  }

  return { ok: true, comment };
}

// pendingMentionQuery is imported from ./pure.mjs.

async function mentionHintUsersForTask(userId, taskId, query) {
  if (query === null) return [];
  const task = await prisma.task.findFirst({
    where: accessTaskWhere(userId, taskId),
    select: {
      user: { select: { id: true, name: true, username: true } },
      assignee: { select: { id: true, name: true, username: true } },
      project: {
        select: {
          user: { select: { id: true, name: true, username: true } },
          members: {
            select: {
              user: { select: { id: true, name: true, username: true } },
            },
          },
        },
      },
    },
  });
  if (!task) return [];

  const users = [
    task.user,
    task.assignee,
    task.project?.user,
    ...(task.project?.members.map((m) => m.user) || []),
  ].filter(Boolean);

  const unique = [...new Map(users.map((u) => [u.id, u])).values()].filter(
    (u) => u.username,
  );
  const matches = unique.filter((u) =>
    query === "" ? true : u.username.toLowerCase().startsWith(query),
  );
  if (matches.some((u) => u.username.toLowerCase() === query)) return [];
  return matches.slice(0, 6);
}

function mentionHintText(matches, query) {
  const lead = query ? `@${query}` : "@";
  const list = matches
    .map((u) => `• @${u.username}${u.name ? ` — ${esc(u.name)}` : ""}`)
    .join("\n");
  return `💡 Mention hint for <b>${esc(lead)}</b>\n\n${list}\n\nSend the comment again with the full handle.`;
}

async function showTaskComments(chat, mid, user, id) {
  const task = await prisma.task.findFirst({
    where: accessTaskWhere(user.id, id),
    include: {
      comments: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true, username: true } } },
      },
    },
  });
  if (!task) return void edit(chat, mid, "Task not found.", backHome());
  const lines = [`💬 <b>${esc(task.title)}</b>`];
  if (task.comments.length === 0) {
    lines.push("", "No comments yet.");
  } else {
    lines.push(
      "",
      ...task.comments.map((c) => {
        const author = c.user?.name || c.user?.username || "Someone";
        const stamp = new Date(c.createdAt).toLocaleString();
        return `• <b>${esc(author)}</b> · ${esc(stamp)}\n${esc(c.body)}`;
      }),
    );
  }
  await edit(chat, mid, lines.join("\n"), {
    inline_keyboard: [
      [{ text: "💬 Add comment", callback_data: `cmt:${id}` }],
      [{ text: "⬅️ Back", callback_data: `ts:${id}` }],
    ],
  });
}

// --- task editing (Phase 1) ------------------------------------------------
const STATUS_LABEL = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  REVIEW: "Review",
  DONE: "Done",
};

// fmtDur is imported from ./pure.mjs.

function reviewText(s) {
  return (
    `<b>Review</b>\n\n` +
    `Title: <b>${esc(s.title)}</b>\n` +
    `Priority: ${PRIO[s.priority]} ${s.priority}\n` +
    `Due: ${s.due ? new Date(s.due).toLocaleDateString() : "—"}\n` +
    `Repeat: ${s.recurrence ? s.recurrence.toLowerCase() : "no"}`
  );
}

// accessTaskWhere is imported from ./pure.mjs.

async function projectMembers(projectId) {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      user: { select: { id: true, name: true } },
      members: { select: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!p) return [];
  const users = [p.user, ...p.members.map((m) => m.user)];
  return [...new Map(users.map((u) => [u.id, u])).values()];
}

async function notifyAssigned(userId, actor, title, taskId) {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { notifyAssigned: true },
    });
    if (u && !u.notifyAssigned) return;
    await prisma.notification.create({
      data: {
        userId,
        type: "ASSIGNED",
        title: `You were assigned “${title}”`,
        body: `${actor.name || "Someone"} assigned this to you.`,
        entityType: "task",
        entityId: taskId,
      },
    });
  } catch {
    /* non-fatal */
  }
}

async function spawnNext(task) {
  if (!task.recurrence) return;
  const step = task.recurrenceInterval || 1;
  const d = new Date(task.dueDate ? new Date(task.dueDate) : new Date());
  if (task.recurrence === "DAILY") d.setDate(d.getDate() + step);
  else if (task.recurrence === "WEEKLY") d.setDate(d.getDate() + 7 * step);
  else d.setMonth(d.getMonth() + step);
  if (task.recurrenceUntil && d > new Date(task.recurrenceUntil)) return;
  await prisma.task.create({
    data: {
      userId: task.userId,
      assigneeId: task.assigneeId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      projectId: task.projectId,
      notes: task.notes,
      recurrence: task.recurrence,
      recurrenceInterval: task.recurrenceInterval,
      recurrenceUntil: task.recurrenceUntil,
      dueDate: d,
      status: "TODO",
    },
  });
  await recomputeProgress(task.projectId);
}

async function applyStatus(user, task, status) {
  const becomingDone = task.status !== "DONE" && status === "DONE";
  await prisma.task.update({
    where: { id: task.id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  if (becomingDone) await spawnNext(task);
  await recomputeProgress(task.projectId);
  await logActivity(
    user.id,
    status === "DONE" ? "completed" : "updated",
    task.id,
    task.title,
  );
}

const statusMenuKb = (id) => ({
  inline_keyboard: [
    [
      { text: "⬜ To do", callback_data: `setstatus:${id}:TODO` },
      { text: "🔵 In progress", callback_data: `setstatus:${id}:IN_PROGRESS` },
    ],
    [
      { text: "🟣 Review", callback_data: `setstatus:${id}:REVIEW` },
      { text: "✅ Done", callback_data: `setstatus:${id}:DONE` },
    ],
    [{ text: "⬅️ Back", callback_data: `ts:${id}` }],
  ],
});
const prioMenuKb = (id) => ({
  inline_keyboard: [
    [
      { text: "🟢 Low", callback_data: `setprio:${id}:LOW` },
      { text: "🟡 Medium", callback_data: `setprio:${id}:MEDIUM` },
    ],
    [
      { text: "🟠 High", callback_data: `setprio:${id}:HIGH` },
      { text: "🔴 Critical", callback_data: `setprio:${id}:CRITICAL` },
    ],
    [{ text: "⬅️ Back", callback_data: `ts:${id}` }],
  ],
});
const dueMenuKb = (id) => ({
  inline_keyboard: [
    [
      { text: "Today", callback_data: `setdue:${id}:today` },
      { text: "Tomorrow", callback_data: `setdue:${id}:tomorrow` },
    ],
    [
      { text: "+1 week", callback_data: `setdue:${id}:week` },
      { text: "No date", callback_data: `setdue:${id}:none` },
    ],
    [{ text: "⬅️ Back", callback_data: `ts:${id}` }],
  ],
});

async function showTaskScreen(chat, mid, user, id) {
  const task = await prisma.task.findFirst({
    where: accessTaskWhere(user.id, id),
    include: {
      project: { select: { name: true } },
      assignee: { select: { name: true } },
      comments: { select: { id: true } },
    },
  });
  if (!task) return void edit(chat, mid, "Task not found.", backHome());
  const running = Boolean(task.timerStartedAt);
  const lines = [
    `${PRIO[task.priority] || "🟡"} <b>${esc(task.title)}</b>`,
    `Status: ${STATUS_LABEL[task.status] || task.status}`,
  ];
  if (task.project) lines.push(`📁 ${esc(task.project.name)}`);
  if (task.dueDate)
    lines.push(`📅 ${new Date(task.dueDate).toLocaleDateString()}`);
  lines.push(`🙋 ${task.assignee?.name ? esc(task.assignee.name) : "Unassigned"}`);
  if (task.recurrence) lines.push(`🔁 ${task.recurrence.toLowerCase()}`);
  if (task.timeSpent || running)
    lines.push(`⏱ ${fmtDur(task.timeSpent)}${running ? " (running)" : ""}`);
  lines.push(`💬 ${task.comments.length} comment${task.comments.length === 1 ? "" : "s"}`);
  const kb = {
    inline_keyboard: [
      [
        { text: "✅ Done", callback_data: `setstatus:${id}:DONE` },
        { text: running ? "⏹ Stop" : "▶️ Timer", callback_data: `ttimer:${id}` },
      ],
      [
        { text: "🏷 Status", callback_data: `tstatus:${id}` },
        { text: "⚡ Priority", callback_data: `tprio:${id}` },
      ],
      [
        { text: "📅 Due", callback_data: `tdue:${id}` },
        { text: "🙋 Assign", callback_data: `tassign:${id}` },
      ],
      [
        { text: "💬 Comment", callback_data: `cmt:${id}` },
        { text: "👀 Comments", callback_data: `tcomments:${id}` },
      ],
      [
        { text: "✏️ Title", callback_data: `ttitle:${id}` },
        { text: "🗑 Delete", callback_data: `tdelete:${id}` },
      ],
      [{ text: "⬅️ Home", callback_data: "home" }],
    ],
  };
  await edit(chat, mid, lines.join("\n"), kb);
}

// --- /link -----------------------------------------------------------------
const NOT_LINKED =
  "👋 <b>Welcome to ProjectHub</b>\n\nYour Telegram isn't connected to a ProjectHub account yet.\n\n1. Open ProjectHub → <b>Settings → Telegram</b>\n2. Tap <b>Connect Telegram</b> to get a code\n3. Send it here: <code>/link YOURCODE</code>";

async function handleLink(chat, code) {
  if (!code) return void send(chat, "Usage: <code>/link YOURCODE</code>");
  const token = await prisma.telegramLinkToken.findUnique({
    where: { code: code.toUpperCase().trim() },
  });
  if (!token || token.expiresAt < new Date()) {
    if (token) await prisma.telegramLinkToken.delete({ where: { id: token.id } });
    return void send(chat, "❌ Invalid or expired code. Generate a new one in Settings → Telegram.");
  }
  // Ensure this chat isn't linked to another account.
  await prisma.user.updateMany({
    where: { telegramChatId: String(chat) },
    data: { telegramChatId: null, telegramLinkedAt: null },
  });
  const user = await prisma.user.update({
    where: { id: token.userId },
    data: { telegramChatId: String(chat), telegramLinkedAt: new Date() },
  });
  await prisma.telegramLinkToken.deleteMany({ where: { userId: token.userId } });
  await send(chat, `✅ Linked to <b>${esc(user.name || user.email)}</b>!`);
  await showHome(chat, user);
}

const HELP =
  "<b>ProjectHub bot</b>\n\n/start – dashboard\n/link CODE – connect your account\n/help – this message\n\nEverything else is on the buttons. Tap around!";

// --- message handler -------------------------------------------------------
async function handleMessage(msg) {
  const chat = msg.chat.id;
  const text = (msg.text || "").trim();

  // commands available to everyone
  if (text === "/help") return void send(chat, HELP);
  if (text.startsWith("/link")) return void handleLink(chat, text.split(/\s+/)[1]);

  const user = await getUser(chat);
  if (!user) {
    return void send(chat, NOT_LINKED, {
      inline_keyboard: [[{ text: "❓ How to connect", callback_data: "howto" }]],
    });
  }

  if (text === "/start") {
    clearSession(chat);
    return void showHome(chat, user);
  }
  if (text === "/today")
    return void listTasks(chat, user, { status: { not: "DONE" }, dueDate: { gte: startOfToday(), lte: endOfToday() } }, "📅 Due today", "Nothing due today 🎉", { pagePrefix: "tp:today" });
  if (text === "/cancel") {
    clearSession(chat);
    return void send(chat, "Cancelled.", backHome());
  }
  if (text.startsWith("/")) return void send(chat, "Unknown command. /help");

  // conversation input
  const s = getSession(chat);
  if (s?.mode === "comment" && text) {
    const query = pendingMentionQuery(text);
    const hints = await mentionHintUsersForTask(user.id, s.taskId, query);
    if (hints.length > 0) {
      return void send(chat, mentionHintText(hints, query));
    }
    const result = await createCommentOnTask(user, s.taskId, text);
    clearSession(chat);
    if (!result.ok) return void send(chat, result.error);
    return void send(chat, "💬 Comment added.", taskKb(s.taskId));
  }
  if (s?.mode === "search" && text) {
    setSession(chat, { mode: "search_results", term: text });
    return void runSearch(chat, user, text, 0);
  }
  if (s?.mode === "project_title" && text) {
    clearSession(chat);
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: text,
        status: "PLANNING",
        priority: "MEDIUM",
      },
    });
    return void send(chat, `📁 Created project: <b>${esc(project.name)}</b>`, {
      inline_keyboard: [[{ text: "Open", callback_data: `proj:${project.id}` }]],
    });
  }
  if (s?.mode === "bug_title" && text) {
    s.title = text;
    s.mode = "bug_description";
    return void send(chat, "Step 2 · Send bug details, or type - to skip.");
  }
  if (s?.mode === "bug_description" && text) {
    const description = text === "-" ? null : text;
    const bug = await prisma.bug.create({
      data: {
        userId: user.id,
        projectId: s.projectId || null,
        title: s.title,
        description,
        severity: "MAJOR",
        status: "OPEN",
      },
    });
    clearSession(chat);
    return void send(chat, `🐛 Bug created: <b>${esc(bug.title)}</b>`, {
      inline_keyboard: [[{ text: "Open", callback_data: `bug:${bug.id}:0${bug.projectId ? `:${bug.projectId}` : ""}` }]],
    });
  }
  if (s?.mode === "note_title" && text) {
    s.title = text;
    s.mode = "note_content";
    return void send(chat, "Step 2 · Send note content, or type - for an empty note.");
  }
  if (s?.mode === "note_content" && text) {
    const note = await prisma.note.create({
      data: {
        userId: user.id,
        projectId: s.projectId || null,
        title: s.title,
        content: text === "-" ? "" : text,
      },
    });
    clearSession(chat);
    return void send(chat, `📝 Note created: <b>${esc(note.title)}</b>`, {
      inline_keyboard: [[{ text: "Open", callback_data: noteOpenData(note.id, 0, note.projectId || null) }]],
    });
  }
  if (s?.mode === "note_edit_content" && text) {
    const id = s.noteId;
    const page = Number(s.page || 0);
    const projectId = s.projectId || null;
    clearSession(chat);
    const note = await prisma.note.findFirst({
      where: { id, userId: user.id },
      select: { id: true, title: true, projectId: true },
    });
    if (!note) return void send(chat, "Note not found.");
    await prisma.note.update({
      where: { id },
      data: { content: text === "-" ? "" : text },
    });
    return void send(chat, `📝 Note updated: <b>${esc(note.title)}</b>`, {
      inline_keyboard: [[{ text: "Open", callback_data: noteOpenData(id, page, projectId ?? note.projectId ?? null) }]],
    });
  }
  if (s?.mode === "title" && text) {
    s.title = text;
    s.mode = "priority";
    return void send(chat, `Step 3 · Priority for <b>${esc(text)}</b>:`, priorityKb());
  }
  if (s?.mode === "edittitle" && text) {
    const id = s.taskId;
    clearSession(chat);
    const task = await prisma.task.findFirst({
      where: accessTaskWhere(user.id, id),
    });
    if (!task) return void send(chat, "Task not found.");
    await prisma.task.update({ where: { id }, data: { title: text } });
    return void send(chat, `✏️ Renamed to <b>${esc(text)}</b>`, taskKb(id));
  }

  if (msg.reply_to_message && text) {
    const taskId = inlineTaskIdFromMessage(msg.reply_to_message);
    if (taskId) {
      const result = await createCommentOnTask(user, taskId, text);
      if (!result.ok) return void send(chat, result.error);
      return void send(chat, "💬 Comment added from reply.", taskKb(taskId));
    }
  }

  // plain text with no active flow → offer a structured quick-add (no silent create)
  if (text) {
    setSession(chat, { mode: "quick", title: text });
    return void send(chat, `Create task: <b>${esc(text)}</b>?`, quickKb());
  }
}

async function runSearch(chat, user, term, page = 0, mid = null) {
  const [tasks, projects, bugs, notes] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...taskAccessFilter(user.id),
        OR: [
          { title: { contains: term } },
          { description: { contains: term } },
          { notes: { contains: term } },
        ],
      },
      take: 5,
      include: { project: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: {
        OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }],
        AND: [{ OR: [{ name: { contains: term } }, { description: { contains: term } }] }],
      },
      take: 5,
    }),
    prisma.bug.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: term } },
          { description: { contains: term } },
          { stepsToReproduce: { contains: term } },
          { fixNotes: { contains: term } },
        ],
      },
      take: 5,
    }),
    prisma.note.findMany({
      where: {
        userId: user.id,
        OR: [{ title: { contains: term } }, { content: { contains: term } }],
      },
      take: 5,
    }),
  ]);
  const results = [
    ...projects.map((p) => ({ kind: "project", id: p.id, label: `📁 ${p.name}`, data: `proj:${p.id}` })),
    ...tasks.map((t) => ({ kind: "task", id: t.id, label: `${PRIO[t.priority] || "🟡"} ${t.title}`, data: `ts:${t.id}` })),
    ...bugs.map((b) => ({ kind: "bug", id: b.id, label: `${BUG_SEVERITY[b.severity] || "🐛"} ${b.title}`, data: `bug:${b.id}:0` })),
    ...notes.map((n) => ({ kind: "note", id: n.id, label: `${n.pinned ? "📌" : "📝"} ${n.title}`, data: `note:${n.id}:0` })),
  ];
  if (results.length === 0) {
    clearSession(chat);
    if (mid) return void edit(chat, mid, `No results for “${esc(term)}”.`, backHome());
    return void send(chat, `No results for “${esc(term)}”.`, backHome());
  }
  const pageItems = results.slice(page * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE + SEARCH_PAGE_SIZE);
  const hasMore = results.length > (page + 1) * SEARCH_PAGE_SIZE;
  setSession(chat, { mode: "search_results", term });
  const text = `🔍 <b>Results for “${esc(term)}”</b>\n\n${pageItems
    .map((r, i) => `${page * SEARCH_PAGE_SIZE + i + 1}. ${esc(r.label)}`)
    .join("\n")}`;
  const kb = {
    inline_keyboard: [
      ...pageItems.map((r) => [{ text: r.label, callback_data: r.data }]),
      ...pagerRow("srch", page, hasMore, [[{ text: "⬅️ Home", callback_data: "home" }]]),
    ],
  };
  if (mid) await edit(chat, mid, text, kb);
  else await send(chat, text, kb);
}

// --- callback handler ------------------------------------------------------
async function handleCallback(cq) {
  const chat = cq.message?.chat?.id;
  const mid = cq.message?.message_id;
  const data = cq.data || "";
  let answered = false;
  const answer = async (_id, text) => {
    if (answered) return { ok: true };
    answered = true;
    return tg("answerCallbackQuery", {
      callback_query_id: cq.id,
      ...(text ? { text } : {}),
    });
  };

  if (data === "howto") {
    await answer(cq.id);
    return void edit(chat, mid, NOT_LINKED);
  }

  // Acknowledge immediately so button taps feel responsive.
  await answer(cq.id);

  const user = chat ? await getUser(chat) : null;
  if (!user) {
    const kb = {
      inline_keyboard: [[{ text: "❓ How to connect", callback_data: "howto" }]],
    };
    if (chat && mid) return void edit(chat, mid, NOT_LINKED, kb);
    if (chat) return void send(chat, NOT_LINKED, kb);
    return;
  }
  const parts = data.split(":");
  const [action, arg] = parts;

  // navigation
  if (data === "home") {
    clearSession(chat);
    await answer(cq.id);
    return void showHome(chat, user, mid);
  }
  if (data === "mytasks") {
    await answer(cq.id);
    return void edit(chat, mid, "📋 <b>My Tasks</b>\n\nPick a view:", myTasksKb());
  }
  if (action === "projects") {
    await answer(cq.id);
    return void showProjects(chat, user, mid, Number(arg || 0));
  }
  if (action === "proj") {
    await answer(cq.id);
    return void showProject(chat, user, mid, arg);
  }
  if (action === "pt") {
    await answer(cq.id);
    return void listTasks(
      chat,
      user,
      { projectId: arg, status: { not: "DONE" } },
      "📋 Open tasks",
      "No open tasks here.",
      {
        scope: "accessible",
        mid,
        page: Number(parts[2] || 0),
        pagePrefix: `pt:${arg}`,
        back: `proj:${arg}`,
      },
    );
  }
  if (action === "bugs") {
    await answer(cq.id);
    return void showBugs(chat, user, mid, Number(arg || 0), parts[2] || null);
  }
  if (action === "bug") {
    await answer(cq.id);
    return void showBug(chat, user, mid, arg, Number(parts[2] || 0), parts[3] || null);
  }
  if (action === "bsm") {
    await answer(cq.id);
    return void showBugStatusMenu(chat, mid, parts[1], Number(parts[2] || 0), parts[3] || null);
  }
  if (action === "bsv") {
    await answer(cq.id);
    return void showBugSevMenu(chat, mid, parts[1], Number(parts[2] || 0), parts[3] || null);
  }
  if (action === "sbs") {
    const id = parts[1];
    const bug = await prisma.bug.findFirst({ where: { id, userId: user.id } });
    if (!bug) return void answer(cq.id, "Not found");
    await applyBugStatus(user, bug, parts[2]);
    await answer(cq.id, "Updated");
    return void showBug(chat, user, mid, id, 0, bug.projectId || null);
  }
  if (action === "sbv") {
    const id = parts[1];
    const bug = await prisma.bug.findFirst({ where: { id, userId: user.id } });
    if (!bug) return void answer(cq.id, "Not found");
    await prisma.bug.update({ where: { id }, data: { severity: parts[2] } });
    await answer(cq.id, "Updated");
    return void showBug(chat, user, mid, id, 0, bug.projectId || null);
  }
  if (action === "bdelete") {
    const page = Number(parts[2] || 0);
    const projectId = parts[3] || null;
    const bug = await prisma.bug.findFirst({
      where: { id: arg, userId: user.id },
      select: { id: true, title: true },
    });
    if (!bug) return void answer(cq.id, "Not found");
    await prisma.bug.update({ where: { id: arg }, data: { deletedAt: new Date() } });
    await logActivity(user.id, "deleted", arg, bug.title, "bug");
    await answer(cq.id, "🗑 Deleted");
    return void edit(chat, mid, `🗑 Deleted: <s>${esc(bug.title)}</s>`, {
      inline_keyboard: [
        [{ text: "↩️ Undo", callback_data: `bundo:${arg}:${page}:${projectId || ""}` }],
        [{ text: projectId ? "⬅️ Bugs" : "⬅️ All Bugs", callback_data: projectId ? `bugs:${page}:${projectId}` : `bugs:${page}` }],
      ],
    });
  }
  if (action === "bundo") {
    const page = Number(parts[2] || 0);
    const projectId = parts[3] || null;
    const bug = await prisma.bug.findUnique({
      where: { id: arg },
      select: { id: true, userId: true },
    });
    if (!bug || bug.userId !== user.id) return void answer(cq.id, "Not found");
    await prisma.bug.update({ where: { id: arg }, data: { deletedAt: null } });
    await answer(cq.id, "Restored");
    return void showBug(chat, user, mid, arg, page, projectId);
  }
  if (action === "notes") {
    await answer(cq.id);
    return void showNotes(chat, user, mid, Number(arg || 0), parts[2] || null);
  }
  if (action === "note") {
    await answer(cq.id);
    return void showNote(chat, user, mid, arg, Number(parts[2] || 0), parts[3] || null);
  }
  if (action === "nedit") {
    setSession(chat, {
      mode: "note_edit_content",
      noteId: arg,
      page: Number(parts[2] || 0),
      projectId: parts[3] || null,
    });
    await answer(cq.id);
    return void edit(chat, mid, "📝 Send the new note content, or type - to clear it.");
  }
  if (action === "ndelete") {
    const page = Number(parts[2] || 0);
    const projectId = parts[3] || null;
    const note = await prisma.note.findFirst({
      where: { id: arg, userId: user.id },
      select: { id: true, title: true },
    });
    if (!note) return void answer(cq.id, "Not found");
    await prisma.note.update({ where: { id: arg }, data: { deletedAt: new Date() } });
    await answer(cq.id, "🗑 Deleted");
    return void edit(chat, mid, `🗑 Deleted: <s>${esc(note.title)}</s>`, {
      inline_keyboard: [
        [{ text: "↩️ Undo", callback_data: `nundo:${arg}:${page}:${projectId || ""}` }],
        [{ text: projectId ? "⬅️ Notes" : "⬅️ All Notes", callback_data: noteBackData(page, projectId) }],
      ],
    });
  }
  if (action === "nundo") {
    const page = Number(parts[2] || 0);
    const projectId = parts[3] || null;
    const note = await prisma.note.findUnique({
      where: { id: arg },
      select: { id: true, userId: true },
    });
    if (!note || note.userId !== user.id) return void answer(cq.id, "Not found");
    await prisma.note.update({ where: { id: arg }, data: { deletedAt: null } });
    await answer(cq.id, "Restored");
    return void showNote(chat, user, mid, arg, page, projectId);
  }
  if (action === "nconvtask") {
    const page = Number(parts[2] || 0);
    const projectId = parts[3] || null;
    const note = await prisma.note.findFirst({
      where: { id: arg, userId: user.id },
      select: { id: true, title: true, content: true, projectId: true },
    });
    if (!note) return void answer(cq.id, "Not found");
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        assigneeId: user.id,
        title: note.title,
        description: note.content?.slice(0, 4000) || null,
        notes: `Created from note "${note.title}"`,
        priority: "MEDIUM",
        status: "TODO",
        projectId: note.projectId,
      },
    });
    await logActivity(user.id, "converted", task.id, task.title, "task");
    await answer(cq.id, "Converted");
    return void edit(chat, mid, `📋 Task created from <b>${esc(note.title)}</b>`, {
      inline_keyboard: [
        [{ text: "Open task", callback_data: `ts:${task.id}` }],
        [{ text: "⬅️ Back to note", callback_data: noteOpenData(note.id, page, projectId) }],
      ],
    });
  }
  if (action === "nconvbug") {
    const page = Number(parts[2] || 0);
    const projectId = parts[3] || null;
    const note = await prisma.note.findFirst({
      where: { id: arg, userId: user.id },
      select: { id: true, title: true, content: true, projectId: true },
    });
    if (!note) return void answer(cq.id, "Not found");
    const bug = await prisma.bug.create({
      data: {
        userId: user.id,
        title: note.title,
        description: note.content?.slice(0, 4000) || null,
        stepsToReproduce: note.content?.slice(0, 4000) || null,
        severity: "MAJOR",
        status: "OPEN",
        projectId: note.projectId,
      },
    });
    await logActivity(user.id, "converted", bug.id, bug.title, "bug");
    await answer(cq.id, "Converted");
    return void edit(chat, mid, `🐛 Bug created from <b>${esc(note.title)}</b>`, {
      inline_keyboard: [
        [{ text: "Open bug", callback_data: bugBackData(bug.id, 0, bug.projectId || null) }],
        [{ text: "⬅️ Back to note", callback_data: noteOpenData(note.id, page, projectId) }],
      ],
    });
  }
  if (action === "srch") {
    const s = getSession(chat);
    if (!s?.term) return void answer(cq.id, "Search again");
    await answer(cq.id);
    return void runSearch(chat, user, s.term, Number(arg || 0), mid);
  }
  if (action === "t") {
    await answer(cq.id);
    if (arg === "today")
      return void listTasks(chat, user, { status: { not: "DONE" }, dueDate: { gte: startOfToday(), lte: endOfToday() } }, "📅 Due today", "Nothing due today 🎉", { mid, pagePrefix: "tp:today", page: Number(parts[2] || 0) });
    if (arg === "overdue")
      return void listTasks(chat, user, { status: { not: "DONE" }, dueDate: { lt: startOfToday() } }, "⚠️ Overdue", "Nothing overdue 🙌", { mid, pagePrefix: "tp:overdue", page: Number(parts[2] || 0) });
    if (arg === "week")
      return void listTasks(chat, user, { status: { not: "DONE" }, dueDate: { gte: startOfToday(), lte: new Date(startOfToday().getTime() + 7 * 864e5) } }, "🗓 This week", "Nothing this week.", { mid, pagePrefix: "tp:week", page: Number(parts[2] || 0) });
    if (arg === "assigned")
      return void listTasks(chat, user, { status: { not: "DONE" } }, "🙋 Assigned to me", "Nothing assigned right now.", { scope: "assigned", mid, pagePrefix: "tp:assigned", page: Number(parts[2] || 0) });
    return void listTasks(chat, user, { status: { not: "DONE" } }, "📂 All open", "No open tasks.", { mid, pagePrefix: "tp:open", page: Number(parts[2] || 0) });
  }
  if (action === "tp") {
    await answer(cq.id);
    const view = parts[1];
    const page = Number(parts[2] || 0);
    if (view === "today")
      return void listTasks(chat, user, { status: { not: "DONE" }, dueDate: { gte: startOfToday(), lte: endOfToday() } }, "📅 Due today", "Nothing due today 🎉", { mid, pagePrefix: "tp:today", page });
    if (view === "overdue")
      return void listTasks(chat, user, { status: { not: "DONE" }, dueDate: { lt: startOfToday() } }, "⚠️ Overdue", "Nothing overdue 🙌", { mid, pagePrefix: "tp:overdue", page });
    if (view === "week")
      return void listTasks(chat, user, { status: { not: "DONE" }, dueDate: { gte: startOfToday(), lte: new Date(startOfToday().getTime() + 7 * 864e5) } }, "🗓 This week", "Nothing this week.", { mid, pagePrefix: "tp:week", page });
    if (view === "assigned")
      return void listTasks(chat, user, { status: { not: "DONE" } }, "🙋 Assigned to me", "Nothing assigned right now.", { scope: "assigned", mid, pagePrefix: "tp:assigned", page });
    return void listTasks(chat, user, { status: { not: "DONE" } }, "📂 All open", "No open tasks.", { mid, pagePrefix: "tp:open", page });
  }
  if (data === "search") {
    setSession(chat, { mode: "search" });
    await answer(cq.id);
    return void edit(chat, mid, "🔍 Send me a search term:");
  }
  if (data === "create") {
    await answer(cq.id);
    return void edit(chat, mid, "➕ <b>Create</b>\n\nChoose what you want to add:", createKb());
  }

  // notification settings
  if (data === "settings") {
    await answer(cq.id);
    return void showSettings(chat, user.id, mid);
  }
  if (action === "pref" && PREF_FIELDS.includes(arg)) {
    const u = await prisma.user.findUnique({ where: { id: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { [arg]: !u[arg] },
    });
    await answer(cq.id, "Updated");
    return void showSettings(chat, user.id, mid);
  }

  // create flow
  if (data === "new") {
    await answer(cq.id);
    return void startCreate(chat, user, mid);
  }
  if (data === "newproj") {
    setSession(chat, { mode: "project_title" });
    await answer(cq.id);
    return void edit(chat, mid, "📁 <b>New project</b>\n\nSend me the project name:");
  }
  if (action === "newbug") {
    setSession(chat, { mode: "bug_title", projectId: arg || null });
    await answer(cq.id);
    return void edit(chat, mid, "🐛 <b>New bug</b>\n\nSend me the bug title:");
  }
  if (action === "newnote") {
    setSession(chat, { mode: "note_title", projectId: arg || null });
    await answer(cq.id);
    return void edit(chat, mid, "📝 <b>New note</b>\n\nSend me the note title:");
  }
  if (action === "np") {
    const s = getSession(chat) || {};
    s.mode = "title";
    s.projectId = arg === "none" ? null : arg;
    setSession(chat, s);
    await answer(cq.id);
    return void edit(chat, mid, "➕ <b>New task</b>\n\nStep 2 · Send me the task title:");
  }
  if (action === "npri") {
    const s = getSession(chat);
    if (!s) return void answer(cq.id, "Start again");
    s.priority = arg;
    s.mode = "due";
    await answer(cq.id);
    return void edit(chat, mid, `Step 4 · Due date for <b>${esc(s.title)}</b>:`, dueKb());
  }
  if (action === "ndue") {
    const s = getSession(chat);
    if (!s) return void answer(cq.id, "Start again");
    s.due = dueFromChoice(arg);
    s.mode = "recur";
    await answer(cq.id);
    return void edit(chat, mid, "Step 5 · Repeats?", recurKb());
  }
  if (action === "nrec") {
    const s = getSession(chat);
    if (!s) return void answer(cq.id, "Start again");
    s.recurrence = arg === "none" ? null : arg;
    if (s.projectId) {
      const members = await projectMembers(s.projectId);
      if (members.length > 1) {
        s.mode = "assign";
        const rows = members.map((m) => [
          { text: `🙋 ${m.name || "Member"}`, callback_data: `nasg:${m.id}` },
        ]);
        rows.push([{ text: "📥 Unassigned", callback_data: "nasg:none" }]);
        rows.push([{ text: "✖️ Cancel", callback_data: "ncancel" }]);
        await answer(cq.id);
        return void edit(chat, mid, "Step 6 · Assign to:", {
          inline_keyboard: rows,
        });
      }
    }
    s.assigneeId = user.id;
    s.mode = "review";
    await answer(cq.id);
    return void edit(chat, mid, reviewText(s), reviewKb());
  }
  if (action === "nasg") {
    const s = getSession(chat);
    if (!s) return void answer(cq.id, "Start again");
    s.assigneeId = arg === "none" ? null : arg;
    s.mode = "review";
    await answer(cq.id);
    return void edit(chat, mid, reviewText(s), reviewKb());
  }
  if (data === "nok") {
    const s = getSession(chat);
    if (!s?.title) return void answer(cq.id, "Nothing to create");
    const task = await createTask(user, s);
    await recomputeProgress(s.projectId);
    await logActivity(user.id, "created", task.id, task.title);
    if (task.assigneeId && task.assigneeId !== user.id)
      await notifyAssigned(task.assigneeId, user, task.title, task.id);
    clearSession(chat);
    await answer(cq.id, "✅ Created");
    return void edit(chat, mid, `✅ Created: <b>${esc(task.title)}</b>`, taskKb(task.id));
  }
  if (data === "ncancel") {
    clearSession(chat);
    await answer(cq.id, "Cancelled");
    return void edit(chat, mid, "Cancelled.", backHome());
  }

  // quick-add from plain text
  if (action === "qa") {
    const s = getSession(chat);
    if (!s?.title) return void answer(cq.id, "Start again");
    if (arg === "create") {
      const task = await createTask(user, { title: s.title, priority: "MEDIUM" });
      await logActivity(user.id, "created", task.id, task.title);
      clearSession(chat);
      await answer(cq.id, "✅ Added");
      return void edit(chat, mid, `✅ Added: <b>${esc(task.title)}</b>`, taskKb(task.id));
    }
    if (arg === "project") {
      await answer(cq.id);
      return void startCreate(chat, user, mid); // keeps s.title; project pick continues flow
    }
  }

  // task actions
  if (action === "done") {
    const task = await prisma.task.findFirst({ where: accessTaskWhere(user.id, arg) });
    if (!task) return void answer(cq.id, "Not found");
    await prisma.task.update({ where: { id: arg }, data: { status: "DONE", completedAt: new Date() } });
    if (task.recurrence) await spawnNext(task);
    await recomputeProgress(task.projectId);
    await logActivity(user.id, "completed", arg, task.title);
    await answer(cq.id, "✅ Done");
    return void edit(chat, mid, `✅ <s>${esc(task.title)}</s>`);
  }
  if (action === "snooze") {
    const task = await prisma.task.findFirst({ where: accessTaskWhere(user.id, arg) });
    if (!task) return void answer(cq.id, "Not found");
    const d = task.dueDate ? new Date(task.dueDate) : new Date();
    d.setDate(d.getDate() + 1);
    await prisma.task.update({ where: { id: arg }, data: { dueDate: d } });
    await answer(cq.id, "⏰ +1 day");
    return void edit(chat, mid, `${PRIO[task.priority] || "🟡"} <b>${esc(task.title)}</b> · 📅 ${d.toLocaleDateString()}`, taskKb(arg));
  }

  // --- task screen + edit (Phase 1) ---
  if (action === "ts") {
    await answer(cq.id);
    return void showTaskScreen(chat, mid, user, arg);
  }
  if (action === "cmt") {
    setSession(chat, { mode: "comment", taskId: arg });
    await answer(cq.id, "Send your comment");
    return void edit(chat, mid, "💬 Send the comment text. You can also reply directly to task notifications.");
  }
  if (action === "tcomments") {
    await answer(cq.id);
    return void showTaskComments(chat, mid, user, arg);
  }
  if (action === "tstatus") {
    await answer(cq.id);
    return void edit(chat, mid, "Set status:", statusMenuKb(arg));
  }
  if (action === "tprio") {
    await answer(cq.id);
    return void edit(chat, mid, "Set priority:", prioMenuKb(arg));
  }
  if (action === "tdue") {
    await answer(cq.id);
    return void edit(chat, mid, "Set due date:", dueMenuKb(arg));
  }
  if (action === "setstatus") {
    const id = parts[1];
    const task = await prisma.task.findFirst({ where: accessTaskWhere(user.id, id) });
    if (!task) return void answer(cq.id, "Not found");
    await applyStatus(user, task, parts[2]);
    await answer(cq.id, "Updated");
    return void showTaskScreen(chat, mid, user, id);
  }
  if (action === "setprio") {
    const id = parts[1];
    const task = await prisma.task.findFirst({ where: accessTaskWhere(user.id, id) });
    if (!task) return void answer(cq.id, "Not found");
    await prisma.task.update({ where: { id }, data: { priority: parts[2] } });
    await answer(cq.id, "Updated");
    return void showTaskScreen(chat, mid, user, id);
  }
  if (action === "setdue") {
    const id = parts[1];
    const task = await prisma.task.findFirst({ where: accessTaskWhere(user.id, id) });
    if (!task) return void answer(cq.id, "Not found");
    await prisma.task.update({ where: { id }, data: { dueDate: dueFromChoice(parts[2]) } });
    await answer(cq.id, "Updated");
    return void showTaskScreen(chat, mid, user, id);
  }
  if (action === "tassign") {
    const task = await prisma.task.findFirst({
      where: accessTaskWhere(user.id, arg),
      select: { projectId: true },
    });
    if (!task) return void answer(cq.id, "Not found");
    if (!task.projectId) {
      await answer(cq.id);
      return void edit(chat, mid, "Only tasks in a project can be assigned.", {
        inline_keyboard: [[{ text: "⬅️ Back", callback_data: `ts:${arg}` }]],
      });
    }
    const members = await projectMembers(task.projectId);
    const rows = members.map((m) => [
      { text: `🙋 ${m.name || "Member"}`, callback_data: `setassign:${arg}:${m.id}` },
    ]);
    rows.push([{ text: "📥 Unassign", callback_data: `setassign:${arg}:none` }]);
    rows.push([{ text: "⬅️ Back", callback_data: `ts:${arg}` }]);
    await answer(cq.id);
    return void edit(chat, mid, "Assign to:", { inline_keyboard: rows });
  }
  if (action === "setassign") {
    const id = parts[1];
    const who = parts[2];
    const task = await prisma.task.findFirst({ where: accessTaskWhere(user.id, id) });
    if (!task) return void answer(cq.id, "Not found");
    const assigneeId = who === "none" ? null : who;
    await prisma.task.update({ where: { id }, data: { assigneeId } });
    if (assigneeId && assigneeId !== user.id)
      await notifyAssigned(assigneeId, user, task.title, id);
    await answer(cq.id, "Updated");
    return void showTaskScreen(chat, mid, user, id);
  }
  if (action === "ttitle") {
    setSession(chat, { mode: "edittitle", taskId: arg });
    await answer(cq.id);
    return void edit(chat, mid, "✏️ Send the new title:");
  }
  if (action === "tdelete") {
    const task = await prisma.task.findFirst({ where: accessTaskWhere(user.id, arg) });
    if (!task) return void answer(cq.id, "Not found");
    await prisma.task.update({ where: { id: arg }, data: { deletedAt: new Date() } });
    await recomputeProgress(task.projectId);
    await logActivity(user.id, "deleted", arg, task.title);
    await answer(cq.id, "🗑 Deleted");
    return void edit(chat, mid, `🗑 Deleted: <s>${esc(task.title)}</s>`, {
      inline_keyboard: [
        [{ text: "↩️ Undo", callback_data: `tundo:${arg}` }],
        [{ text: "⬅️ Home", callback_data: "home" }],
      ],
    });
  }
  if (action === "tundo") {
    const task = await prisma.task.findUnique({ where: { id: arg } });
    if (task) {
      await prisma.task.update({ where: { id: arg }, data: { deletedAt: null } });
      await recomputeProgress(task.projectId);
    }
    await answer(cq.id, "Restored");
    return void showTaskScreen(chat, mid, user, arg);
  }
  if (action === "ttimer") {
    const task = await prisma.task.findFirst({ where: accessTaskWhere(user.id, arg) });
    if (!task) return void answer(cq.id, "Not found");
    if (task.timerStartedAt) {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(task.timerStartedAt).getTime()) / 1000),
      );
      await prisma.task.update({
        where: { id: arg },
        data: { timeSpent: task.timeSpent + elapsed, timerStartedAt: null },
      });
      try {
        await prisma.timeEntry.create({
          data: {
            userId: user.id,
            taskId: arg,
            startedAt: task.timerStartedAt,
            endedAt: new Date(),
            seconds: elapsed,
          },
        });
      } catch {
        /* non-fatal */
      }
      await answer(cq.id, "⏹ Stopped");
    } else {
      const running = await prisma.task.findMany({
        where: { userId: user.id, timerStartedAt: { not: null } },
      });
      for (const r of running) {
        const e = Math.max(
          0,
          Math.floor((Date.now() - new Date(r.timerStartedAt).getTime()) / 1000),
        );
        await prisma.task.update({
          where: { id: r.id },
          data: { timeSpent: r.timeSpent + e, timerStartedAt: null },
        });
      }
      await prisma.task.update({
        where: { id: arg },
        data: { timerStartedAt: new Date() },
      });
      await answer(cq.id, "▶️ Started");
    }
    return void showTaskScreen(chat, mid, user, arg);
  }

  await answer(cq.id);
}

// --- scheduler: digest + nightly backup (per linked user) ------------------
async function buildBackup(uid) {
  const [projects, tasks, bugs, notes, milestones] = await Promise.all([
    prisma.project.findMany({ where: { userId: uid } }),
    prisma.task.findMany({ where: { userId: uid }, include: { subtasks: true } }),
    prisma.bug.findMany({ where: { userId: uid } }),
    prisma.note.findMany({ where: { userId: uid } }),
    prisma.milestone.findMany({ where: { project: { userId: uid } } }),
  ]);
  return { app: "ProjectHub", version: 1, exportedAt: new Date().toISOString(), data: { projects, tasks, bugs, notes, milestones } };
}

async function tasksInRange(userId, gte, lte) {
  return prisma.task.findMany({
    where: { userId, status: { not: "DONE" }, dueDate: { gte, lte } },
    orderBy: { dueDate: "asc" },
    take: 10,
  });
}
const reportLines = (tasks) =>
  tasks
    .map((t) => `• ${PRIO[t.priority] || "🟡"} ${esc(t.title)}${fmtDue(t.dueDate)}`)
    .join("\n");

// Morning report = what's due today (+ overdue).
async function sendMorning(user) {
  const [overdue, today] = await Promise.all([
    prisma.task.count({
      where: { userId: user.id, status: { not: "DONE" }, dueDate: { lt: startOfToday() } },
    }),
    tasksInRange(user.id, startOfToday(), endOfToday()),
  ]);
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "DUE",
      title: "☀️ Good morning",
      body: `${today.length} due today · ${overdue} overdue`,
      entityType: "task",
      pushed: true,
    },
  });
  if (user.telegramChatId) {
    const lines = reportLines(today) || "Nothing due today 🎉";
    await send(
      user.telegramChatId,
      `☀️ <b>Good morning${user.name ? ", " + esc(user.name) : ""}!</b>\nDue today: <b>${today.length}</b> · Overdue: <b>${overdue}</b>\n\n${lines}`,
      homeKb(),
    );
  }
}

// Evening report = what's due tomorrow.
async function sendEvening(user) {
  const tomorrow = await tasksInRange(user.id, startOfTomorrow(), endOfTomorrow());
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "DUE",
      title: "🌙 Tomorrow",
      body: `${tomorrow.length} task(s) due tomorrow`,
      entityType: "task",
      pushed: true,
    },
  });
  if (user.telegramChatId) {
    const lines = reportLines(tomorrow) || "Nothing due tomorrow 🎉";
    await send(
      user.telegramChatId,
      `🌙 <b>Tomorrow's plan</b>\nDue tomorrow: <b>${tomorrow.length}</b>\n\n${lines}`,
      homeKb(),
    );
  }
}

async function sendWeeklyReview(user) {
  const weekStart = startOfWeek();
  const existing = await prisma.notification.findFirst({
    where: {
      userId: user.id,
      type: "WEEKLY_REVIEW",
      createdAt: { gte: weekStart },
    },
    select: { id: true },
  });
  if (existing) return;

  const [tasksDone, overdue, newBugs, openBugs] = await Promise.all([
    prisma.task.count({
      where: { userId: user.id, status: "DONE", completedAt: { gte: weekStart } },
    }),
    prisma.task.count({
      where: { userId: user.id, status: { not: "DONE" }, dueDate: { lt: new Date() } },
    }),
    prisma.bug.count({
      where: { userId: user.id, createdAt: { gte: weekStart } },
    }),
    prisma.bug.count({
      where: { userId: user.id, status: { in: ["OPEN", "INVESTIGATING"] } },
    }),
  ]);

  const body = `${tasksDone} done this week · ${overdue} overdue · ${newBugs} new bugs · ${openBugs} open bugs`;
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "WEEKLY_REVIEW",
      title: "📈 Weekly review",
      body,
      entityType: "weekly_review",
    },
  });
}

async function sendBackup(user) {
  try {
    const json = JSON.stringify(await buildBackup(user.id), null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const form = new FormData();
    form.append("chat_id", String(user.telegramChatId));
    form.append("caption", `🗄️ ProjectHub backup — ${date}`);
    form.append("document", new Blob([json], { type: "application/json" }), `projecthub-backup-${date}.json`);
    await fetch(`${API}/sendDocument`, { method: "POST", body: form });
  } catch (e) {
    console.error("[bot] backup:", e?.message);
  }
}

// Push web notifications (assignments/comments/mentions) to Telegram.
const PUSH_ICON = {
  ASSIGNED: "🙋",
  COMMENT: "💬",
  MENTION: "📣",
  PROJECT: "📁",
  DUE: "⏰",
  WEEKLY_REVIEW: "📈",
};
async function deliverNotifications() {
  const notes = await prisma.notification.findMany({
    where: { pushed: false, user: { telegramChatId: { not: null } } },
    include: { user: { select: { telegramChatId: true } } },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  for (const n of notes) {
    const icon = PUSH_ICON[n.type] || "🔔";
    const kb =
      n.entityType === "task" && n.entityId
        ? {
            inline_keyboard: [
              [
                { text: "📋 Open task", callback_data: `ts:${n.entityId}` },
                { text: "💬 Reply", callback_data: `cmt:${n.entityId}` },
              ],
            ],
          }
        : undefined;
    await send(
      n.user.telegramChatId,
      `${icon} <b>${esc(n.title)}</b>${n.body ? `\n${esc(n.body)}` : ""}`,
      kb,
    );
    await prisma.notification.update({
      where: { id: n.id },
      data: { pushed: true },
    });
  }
}

let lastBackupDay = null;
let reportDay = null;
const sentReports = new Set();
function startScheduler() {
  setInterval(async () => {
    try {
      const now = new Date();
      const day = now.toDateString();
      const hour = now.getHours();
      if (reportDay !== day) {
        reportDay = day;
        sentReports.clear();
      }

      // Near-real-time push of new notifications.
      await deliverNotifications();

      // Per-user morning/evening reports (respecting preferences + hours).
      const users = await prisma.user.findMany();
      for (const u of users) {
        if (u.notifyMorning && hour === u.morningHour && !sentReports.has(`${u.id}:m`)) {
          sentReports.add(`${u.id}:m`);
          await sendMorning(u);
        }
        if (u.notifyEvening && hour === u.eveningHour && !sentReports.has(`${u.id}:e`)) {
          sentReports.add(`${u.id}:e`);
          await sendEvening(u);
        }
        if (
          now.getDay() === 1 &&
          hour === u.morningHour &&
          !sentReports.has(`${u.id}:w`)
        ) {
          sentReports.add(`${u.id}:w`);
          await sendWeeklyReview(u);
        }
      }

      // Nightly backup (linked users only).
      if (hour === BACKUP_HOUR && lastBackupDay !== day) {
        lastBackupDay = day;
        for (const u of users) if (u.telegramChatId) await sendBackup(u);
      }
    } catch (e) {
      console.error("[bot] scheduler:", e?.message);
    }
  }, 60 * 1000);
}

// --- long-polling ----------------------------------------------------------
let offset = 0;
async function poll() {
  const res = await tg("getUpdates", { timeout: 50, offset, allowed_updates: ["message", "callback_query"] });
  if (res?.ok) {
    for (const u of res.result) {
      offset = u.update_id + 1;
      try {
        if (u.message) await handleMessage(u.message);
        else if (u.callback_query) await handleCallback(u.callback_query);
      } catch (e) {
        console.error("[bot] update:", e?.message);
      }
    }
  } else {
    await new Promise((r) => setTimeout(r, 3000));
  }
  setImmediate(poll);
}

console.log(`[bot] running (per-user reports, backup ${BACKUP_HOUR}:00)`);
startScheduler();
poll();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
