// Deadline reminders.
// For every active draft (phase) whose deadline is within the next 3 days and
// still has remaining work, save one system message in the task assignee's
// self-chat. Runs once per day at 10:00 in the configured reminder time
// zone. Each phase is reminded at most once per calendar day in that zone.

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

export function isReminderHour(now, timeZone = config.reminderTimeZone) {
  return Number(zonedParts(now, timeZone).hour) === 10;
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
  const today = dayKeyInTimeZone(now, timeZone);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const draftsByTask = new Map();
  for (const draft of drafts) {
    const rows = draftsByTask.get(draft.taskId) || [];
    rows.push(draft);
    draftsByTask.set(draft.taskId, rows);
  }
  const reminders = [];

  for (const task of tasks.filter(
    (item) => !['Done', 'Cancelled', 'Archive'].includes(item.status)
  )) {
    // Recipient selection is intentionally exact: only task.assigneeId.
    // Project members, PMs, and unrelated users are never expanded here.
    const assignee = usersById.get(task.assigneeId);
    if (!assignee || assignee.disabled) continue;
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
      const daysLeft = calDaysLeft(deadline, today);
      if (daysLeft < 0 || daysLeft > 3) continue;

      const seen = draft.remindedDates || [];
      if (!force && seen.includes(today)) continue;

      const dueText = daysLeft === 0 ? 'วันนี้' : `อีก ${daysLeft} วัน`;
      const body =
        `🤖 แจ้งเตือนอัตโนมัติ: เฟส "${draft.step}" ของงาน "${task.title}" ` +
        `ใกล้กำหนดส่ง (${dueText} — ${deadline}) ยังเหลือ ~${remaining} ชม.`;
      reminders.push({
        recipientId: assignee.id,
        task,
        draft,
        today,
        seen,
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

// force=true ignores the once-per-day dedupe, while the 3-day deadline window
// remains in force. The admin endpoint uses this to preview eligible reminders.
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
    db.drafts.update(reminder.draft.id, {
      remindedDates: [...reminder.seen, reminder.today],
    });
  }
  return reminders.length;
}

let lastTenAmDay = null;
export function startScheduler() {
  const tick = () => {
    const now = new Date();
    if (isReminderHour(now)) {
      const key = dayKeyInTimeZone(now);
      if (lastTenAmDay !== key) {
        lastTenAmDay = key;
        const sent = runDeadlineReminders(now);
        if (sent)
          console.log(
            `[scheduler] sent ${sent} deadline reminder(s) at 10:00 ${config.reminderTimeZone}`
          );
      }
    }
  };
  setInterval(tick, 60 * 1000);
  console.log(
    `[scheduler] deadline-reminder scheduler started (fires daily at 10:00 ${config.reminderTimeZone})`
  );
}
