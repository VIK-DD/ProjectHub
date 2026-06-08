import assert from "node:assert/strict";
import { test } from "node:test";

import {
  esc,
  startOfToday,
  startOfWeek,
  startOfTomorrow,
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
} from "../bot/pure.mjs";

const DAY = 86_400_000;

test("esc neutralizes HTML and tolerates nullish input", () => {
  assert.equal(esc("a & b <c> \"d\""), "a &amp; b &lt;c&gt; \"d\"");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(42), "42");
});

test("pad2 zero-pads to two digits", () => {
  assert.equal(pad2(0), "00");
  assert.equal(pad2(7), "07");
  assert.equal(pad2(20), "20");
});

test("startOfToday is local midnight; startOfWeek is Monday", () => {
  const t = startOfToday();
  assert.equal(t.getHours(), 0);
  assert.equal(t.getMinutes(), 0);
  assert.equal(t.getSeconds(), 0);

  const w = startOfWeek();
  assert.equal(w.getDay(), 1, "week starts on Monday");
  assert.ok(w.getTime() <= t.getTime(), "week start is on or before today");
  assert.ok(t.getTime() - w.getTime() < 7 * DAY, "within the current week");

  assert.equal(startOfTomorrow().getTime(), t.getTime() + DAY);
});

test("dueFromChoice maps quick-choices to noon dates", () => {
  assert.equal(dueFromChoice("none"), null);

  const base = startOfToday();
  base.setHours(12, 0, 0, 0);

  assert.equal(dueFromChoice("today")!.getTime(), base.getTime());
  assert.equal(dueFromChoice("tomorrow")!.getTime(), base.getTime() + DAY);
  assert.equal(dueFromChoice("3d")!.getTime(), base.getTime() + 3 * DAY);
  assert.equal(dueFromChoice("week")!.getTime(), base.getTime() + 7 * DAY);
});

test("fmtDue labels overdue / today / future", () => {
  assert.equal(fmtDue(null), "");

  const today = startOfToday();
  today.setHours(10, 0, 0, 0);
  assert.equal(fmtDue(today), " · 📅 today");

  assert.equal(fmtDue(new Date(Date.now() - 2 * DAY)), " · ⚠️ overdue");

  const future = new Date(Date.now() + 5 * DAY);
  assert.ok(fmtDue(future).startsWith(" · 📅 "));
  assert.ok(!fmtDue(future).includes("today"));
});

test("fmtDur formats seconds as h/m", () => {
  assert.equal(fmtDur(0), "0m");
  assert.equal(fmtDur(59), "0m");
  assert.equal(fmtDur(90), "1m");
  assert.equal(fmtDur(3600), "1h 0m");
  assert.equal(fmtDur(3720), "1h 2m");
});

test("pendingMentionQuery detects a trailing @handle being typed", () => {
  assert.equal(pendingMentionQuery("ping @jo"), "jo");
  assert.equal(pendingMentionQuery("@Alice_1"), "alice_1");
  assert.equal(pendingMentionQuery("hey @"), "");
  assert.equal(pendingMentionQuery("no handle here"), null);
  assert.equal(pendingMentionQuery("send to a@b.com"), null, "mid-word @ is not a mention");
  assert.equal(pendingMentionQuery("@bob done"), null, "only a trailing handle counts");
});

test("inlineTaskIdFromMessage recovers the task id from callback_data", () => {
  const make = (data: string) => ({
    reply_markup: { inline_keyboard: [[{ callback_data: data }]] },
  });
  assert.equal(inlineTaskIdFromMessage(make("ts:task_1")), "task_1");
  assert.equal(inlineTaskIdFromMessage(make("cmt:task_2")), "task_2");
  assert.equal(inlineTaskIdFromMessage(make("setstatus:task_3:DONE")), "task_3");
  assert.equal(inlineTaskIdFromMessage(make("tdelete:task_4")), "task_4");
  assert.equal(inlineTaskIdFromMessage(make("home")), null);
  assert.equal(inlineTaskIdFromMessage(undefined), null);
  assert.equal(inlineTaskIdFromMessage({}), null);
});

test("access where-clauses cover owner, assignee and project membership", () => {
  const filter = taskAccessFilter("u1");
  assert.deepEqual(filter, {
    OR: [
      { userId: "u1" },
      { assigneeId: "u1" },
      { project: { OR: [{ userId: "u1" }, { members: { some: { userId: "u1" } } }] } },
    ],
  });

  const single = accessTaskWhere("u1", "t9");
  assert.equal(single.id, "t9");
  assert.deepEqual(single.OR, filter.OR);
});

test("callback routing builders include projectId only when present", () => {
  assert.equal(bugBackData("b1", 2, "p1"), "bug:b1:2:p1");
  assert.equal(bugBackData("b1", 0, null), "bug:b1:0");

  assert.equal(noteBackData(3, "p1"), "notes:3:p1");
  assert.equal(noteBackData(0, null), "notes:0");

  assert.equal(noteOpenData("n1", 1, "p1"), "note:n1:1:p1");
  assert.equal(noteOpenData("n1", 0, null), "note:n1:0");
});
