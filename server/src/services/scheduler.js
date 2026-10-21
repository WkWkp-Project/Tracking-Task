// Deadline reminders.
// Each unfinished draft (phase) is reminded in its assignee's self-chat at
// four escalating tiers: 2 days, 1 day and 5 hours before the deadline, then
// once when it is overdue. A tier is sent at most once per draft, and only
// during working hours so nobody is pinged at night. A deadline date means
// DEADLINE_HOUR:00 (end of the working day) in the configured time zone.

import db from '../db.js';
import { config } from '../config.js';
import { selfChannelKey } from './chat.js';
import { emitMessage, saveMessage } from '../realtime.js';

const STD_DAY = 8;
const effort = (draft) =>
  (Number(draft.estDays) || 0) * STD_DAY + (Number(draft.estHours) || 0);

function zonedParts(now, timeZone = config.reminderTimeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function dayKeyInTimeZone(now, timeZone = config.reminderTimeZone) {
  const { year, month, day } = zonedParts(now, timeZone);
  return `${year}-${month}-${day}`;
}

export const DEADLINE_HOUR = 18;
export const WORK_START_HOUR = 9;
const HOUR_MS = 3600000;

// Ordered from earliest to latest trigger.
export const REMINDER_TIERS = [
  { key: 'T2d', hoursBefore: 48, label: 'เหลือ 2 วัน' },
  { key: 'T1d', hoursBefore: 24, label: 'เหลือ 1 วัน' },
  { key: 'T5h', hoursBefore: 5, label: 'เหลืออีกประมาณ 5 ชั่วโมง' },
  { key: 'overdue', hoursBefore: 0, label: '🚨 เลยกำหนดส่งแล้ว' },
];

export function isWorkingHour(now, timeZone = config.reminderTimeZone) {
  const hour = Number(zonedParts(now, timeZone).hour);
  return hour >= WORK_START_HOUR && hour < DEADLINE_HOUR;
}

// The UTC instant at which `dateStr` (YYYY-MM-DD) is `hour`:00 in `timeZone`.
export function zonedInstant(dateStr, hour, timeZone = config.reminderTimeZone) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  const p = zonedParts(new Date(guess), timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, Number(p.hour));
  return new Date(guess - (asIfUtc - guess));
}

function calDaysLeft(deadline, todayKey) {
  const deadlineMs = Date.parse(`${deadline}T00:00:00Z`);
  const todayMs = Date.parse(`${todayKey}T00:00:00Z`);
  return Math.round((deadlineMs - todayMs) / 86400000);
}

export function selectDeadlineReminders(
  { tasks, drafts, users },
  now = new Date(),
  force = false,
  timeZone = config.reminderTimeZone
) {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const draftsByTask = new Map();
  for (const draft of drafts) {
    const rows = draftsByTask.get(draft.taskId) || [];
    rows.push(draft);
    draftsByTask.set(draft.taskId, rows);
  }
  if (!isWorkingHour(now, timeZone)) return [];
  const reminders = [];

  for (const task of tasks.filter(
    (item) => !['Done', 'Cancelled', 'Archive'].includes(item.status)
  )) {
    // Recipient selection is intentionally exact: the task's lead assignee, or
    // the task's own PM when nobody is assigned yet. Project members and
    // unrelated users are never expanded here.
    const lead = usersById.get(task.assigneeId);
    const pm = usersById.get(task.pmId);
    const assignee = lead && !lead.disabled ? lead : !task.assigneeId && pm && !pm.disabled ? pm : null;
    if (!assignee) continue;
    const unassigned = assignee !== lead;
    const taskDrafts = [...(draftsByTask.get(task.id) || [])].sort(
      (a, b) => a.order - b.order
    );

    for (const draft of taskDrafts) {
      if (draft.status === 'Approved') continue;
      const remaining = Math.max(
        effort(draft) - (Number(draft.loggedHours) || 0),
        0
      );
      if (remaining <= 0) continue;

      const deadline = draft.dueDate || task.endDate;
      const deadlineAt = zonedInstant(deadline, DEADLINE_HOUR, timeZone).getTime();
      const crossed = REMINDER_TIERS.filter(
        (tier) => deadlineAt - tier.hoursBefore * HOUR_MS <= now.getTime()
      );
      if (!crossed.length) continue;
      // Only the most urgent tier reached is sent; earlier ones count as done.
      const tier = crossed[crossed.length - 1];
      const seen = draft.remindedTiers || [];
      if (!force && seen.includes(tier.key)) continue;
      // Don't nag about an almost-finished phase two days out.
      if (tier.key === 'T2d' && remaining <= 1) continue;

      const hoursLeft = Math.max(0, Math.round((deadlineAt - now.getTime()) / HOUR_MS));
      const body =
        `⏰ ${tier.label}: เฟส "${draft.step}" ของงาน "${task.title}" ` +
        `(กำหนดส่ง ${deadline} ${DEADLINE_HOUR}:00)` +
        (unassigned ? ' [งานนี้ยังไม่มีผู้รับผิดชอบ — แจ้ง PM แทน] ' : ' ') +
        `ยังเหลืองาน ~${remaining} ชม.` +
        (tier.key === 'overdue' ? '' : ` · อีก ~${hoursLeft} ชม.ก่อนถึงกำหนด`);
      reminders.push({
        recipientId: assignee.id,
        task,
        draft,
        tier: tier.key,
        seenTiers: [...new Set([...seen, ...crossed.map((item) => item.key)])],
        message: {
          senderId: assignee.id,
          channelType: 'dm',
          channelKey: selfChannelKey(assignee.id),
          body,
          taskId: task.id,
          attachment: null,
          system: true,
          markSenderRead: false,
        },
      });
    }
  }
  return reminders;
}

// force=true ignores the once-per-tier dedupe (the admin endpoint uses it to
// preview what is currently due); the tier windows themselves still apply.
export function runDeadlineReminders(now = new Date(), force = false) {
  const reminders = selectDeadlineReminders(
    {
      tasks: db.tasks.all(),
      drafts: db.drafts.all(),
      users: db.users.all(),
    },
    now,
    force
  );

  for (const reminder of reminders) {
    const message = saveMessage(reminder.message);
    emitMessage(message);
    db.drafts.update(reminder.draft.id, { remindedTiers: reminder.seenTiers });
  }
  return reminders.length;
}

// Checked every few minutes so the 5-hour tier lands on time; each tier is
// deduped per draft, so repeated checks never resend.
export function startScheduler() {
  const tick = () => {
    const sent = runDeadlineReminders(new Date());
    if (sent) console.log(`[scheduler] sent ${sent} deadline reminder(s)`);
  };
  setInterval(tick, 5 * 60 * 1000);
  console.log(
    `[scheduler] deadline reminders at 2d / 1d / 5h / overdue (${config.reminderTimeZone}, ${WORK_START_HOUR}:00-${DEADLINE_HOUR}:00)`
  );
}
