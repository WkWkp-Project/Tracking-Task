// Deadline reminders.
// For every active draft (phase) whose deadline is within the next 3 days and
// still has remaining work, send a chat DM to the assignee + a bell notification.
// Runs once per day at 10:00 (local time). Each phase is reminded at most once
// per day (tracked via draft.remindedDates), so the assignee gets a nudge on
// each of the 3 remaining days before the due date.

import db from '../db.js';
import { dmChannelKey } from './chat.js';
import { saveMessage, emitMessage } from '../realtime.js';
import { notify } from './notify.js';

const STD_DAY = 8;
const effort = (dr) => (Number(dr.estDays) || 0) * STD_DAY + (Number(dr.estHours) || 0);

function dayKeyLocal(now) {
  // local calendar day (matches "10 โมงเช้า" local)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function calDaysLeft(deadline, todayKey) {
  const a = new Date(`${deadline}T12:00:00`);
  const b = new Date(`${todayKey}T12:00:00`);
  return Math.ceil((a - b) / 86400000);
}

// force=true ignores both the per-day dedupe and the 3-day window cap=stays,
// used by the admin test endpoint to preview reminders immediately.
export function runDeadlineReminders(now = new Date(), force = false) {
  const today = dayKeyLocal(now);
  let sent = 0;
  const tasks = db.tasks.all().filter((t) => t.status !== 'Done' && t.status !== 'Cancelled');

  for (const task of tasks) {
    const assignee = db.users.byId(task.assigneeId);
    if (!assignee || assignee.disabled) continue;
    const drafts = db.drafts.find((dr) => dr.taskId === task.id).sort((a, b) => a.order - b.order);

    for (const dft of drafts) {
      if (dft.status === 'Approved') continue;
      const remaining = Math.max(effort(dft) - (Number(dft.loggedHours) || 0), 0);
      if (remaining <= 0) continue;

      const deadline = dft.dueDate || task.endDate;
      const dl = calDaysLeft(deadline, today);
      // within the 3-day pre-deadline window (and the due day itself)
      if (dl < 0 || dl > 3) continue;

      const seen = dft.remindedDates || [];
      if (!force && seen.includes(today)) continue; // already nudged today

      const dueTxt = dl === 0 ? 'วันนี้' : `อีก ${dl} วัน`;
      const body =
        `🤖 แจ้งเตือนอัตโนมัติ: เฟส "${dft.step}" ของงาน "${task.title}" ใกล้กำหนดส่ง (${dueTxt} — ${deadline}) ` +
        `ยังเหลือ ~${remaining} ชม. รีบเคลียร์ก่อนเข้าวิกฤตนะครับ`;

      // 1) into chat (DM from the PM so it lands in the worker's chat thread)
      const senderId = task.pmId && task.pmId !== assignee.id ? task.pmId : null;
      if (senderId) {
        const msg = saveMessage({ senderId, channelType: 'dm', channelKey: dmChannelKey(senderId, assignee.id), body });
        emitMessage(msg);
      }
      // 2) bell notification
      notify(assignee.id, {
        type: 'deadline_reminder',
        severity: dl <= 1 ? 'critical' : 'warning',
        title: `⏰ ใกล้กำหนดส่ง: ${dft.step}`,
        body: `${task.title} — ${dueTxt} (เหลือ ${remaining} ชม.)`,
        link: `/tasks/${task.id}`,
        meta: { taskId: task.id, draftId: dft.id },
      });

      db.drafts.update(dft.id, { remindedDates: [...seen, today] });
      sent++;
    }
  }
  return sent;
}

let lastTenAmDay = null;
export function startScheduler() {
  const tick = () => {
    const now = new Date();
    if (now.getHours() === 10) {
      const key = dayKeyLocal(now);
      if (lastTenAmDay !== key) {
        lastTenAmDay = key;
        const n = runDeadlineReminders(now);
        if (n) console.log(`[scheduler] sent ${n} deadline reminder(s) at 10:00`);
      }
    }
  };
  setInterval(tick, 60 * 1000); // check every minute
  console.log('[scheduler] deadline-reminder scheduler started (fires daily at 10:00)');
}
