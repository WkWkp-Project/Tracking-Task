import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth/jwt.js';
import { googleConfigured } from '../config.js';
import { sendEmail } from '../services/gmail.js';
import { upsertTaskEvent, deleteTaskEvent } from '../services/calendar.js';
import { notify } from '../services/notify.js';

const router = Router();
router.use(requireAuth);

router.get('/status', (req, res) => {
  res.json({
    configured: googleConfigured,
    linked: Boolean(req.user.googleRefreshToken),
  });
});

// Send a client email through the logged-in user's Gmail
router.post('/gmail/send', async (req, res) => {
  const { to, cc, subject, text, html, taskId } = req.body || {};
  if (!to || !subject) return res.status(400).json({ error: 'to & subject required' });
  try {
    const result = await sendEmail(req.user, { to, cc, subject, text, html });
    // log it into the task's client channel as a record
    if (taskId) {
      notify(req.user.id, {
        type: 'email_sent',
        title: `📧 ส่งอีเมลถึงลูกค้าแล้ว`,
        body: `${subject} → ${to}`,
        link: `/tasks/${taskId}`,
        meta: { taskId, messageId: result.id },
      });
    }
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(e.code === 'GOOGLE_NOT_CONFIGURED' ? 503 : 400).json({ error: e.message, code: e.code });
  }
});

// Push (or refresh) a task onto the user's Google Calendar
router.post('/calendar/sync', async (req, res) => {
  const { taskId } = req.body || {};
  const task = db.tasks.byId(taskId);
  if (!task) return res.status(404).json({ error: 'task not found' });
  try {
    const assignee = db.users.byId(task.assigneeId);
    const pm = db.users.byId(task.pmId);
    const { eventId, htmlLink } = await upsertTaskEvent(req.user, task, [assignee?.email, pm?.email]);
    db.tasks.update(task.id, { calendarEventId: eventId, syncCalendar: true });
    res.json({ ok: true, eventId, htmlLink });
  } catch (e) {
    res.status(e.code === 'GOOGLE_NOT_CONFIGURED' ? 503 : 400).json({ error: e.message, code: e.code });
  }
});

router.post('/calendar/unsync', async (req, res) => {
  const { taskId } = req.body || {};
  const task = db.tasks.byId(taskId);
  if (!task) return res.status(404).json({ error: 'task not found' });
  try {
    if (task.calendarEventId) await deleteTaskEvent(req.user, task.calendarEventId);
    db.tasks.update(task.id, { calendarEventId: null, syncCalendar: false });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code });
  }
});

export default router;
