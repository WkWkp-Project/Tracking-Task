import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth/jwt.js';
import { googleConfigured } from '../config.js';
import { sendEmail } from '../services/gmail.js';
import { calendarOwnerForTask, upsertTaskEvent, deleteTaskEvent } from '../services/calendar.js';
import { notify } from '../services/notify.js';
import { canContributeToTask } from '../services/taskWorkflow.js';
import { asyncRoute, forbidden } from '../http.js';

const router = Router();
router.use(requireAuth);

router.get('/status', (req, res) => {
  res.json({
    configured: googleConfigured,
    linked: Boolean(req.user.googleRefreshToken),
    email: req.user.email,
  });
});

// Send a client email through the logged-in user's Gmail
router.post('/gmail/send', asyncRoute(async (req, res) => {
  const { to, cc, bcc, subject, text, html, attachments, taskId } = req.body || {};
  if (!to || !subject) return res.status(400).json({ error: 'to & subject required' });
  if (taskId) {
    const task = db.tasks.byId(taskId);
    if (!task) return res.status(404).json({ error: 'task not found', code: 'NOT_FOUND' });
    const project = db.projects.byId(task.projectId);
    if (!canContributeToTask(req.user, task, project)) throw forbidden();
  }
  try {
    const result = await sendEmail(req.user, { to, cc, bcc, subject, text, html, attachments });
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
}));

// Push (or refresh) a task onto the user's Google Calendar
router.post('/calendar/sync', asyncRoute(async (req, res) => {
  const { taskId } = req.body || {};
  const task = db.tasks.byId(taskId);
  if (!task) return res.status(404).json({ error: 'task not found' });
  if (!canContributeToTask(req.user, task, db.projects.byId(task.projectId))) throw forbidden();
  try {
    const assignee = db.users.byId(task.assigneeId);
    const pm = db.users.byId(task.pmId);
    const owner = calendarOwnerForTask(task, req.user, (id) => db.users.byId(id));
    const { eventId, htmlLink } = await upsertTaskEvent(owner, task, [assignee?.email, pm?.email]);
    db.tasks.update(task.id, {
      calendarEventId: eventId,
      calendarOwnerId: owner.id,
      syncCalendar: true,
    });
    res.json({ ok: true, eventId, htmlLink });
  } catch (e) {
    res.status(e.code === 'GOOGLE_NOT_CONFIGURED' ? 503 : 400).json({ error: e.message, code: e.code });
  }
}));

router.post('/calendar/unsync', asyncRoute(async (req, res) => {
  const { taskId } = req.body || {};
  const task = db.tasks.byId(taskId);
  if (!task) return res.status(404).json({ error: 'task not found' });
  if (!canContributeToTask(req.user, task, db.projects.byId(task.projectId))) throw forbidden();
  try {
    if (task.calendarEventId) {
      const owner = calendarOwnerForTask(task, req.user, (id) => db.users.byId(id));
      await deleteTaskEvent(owner, task.calendarEventId);
    }
    db.tasks.update(task.id, { calendarEventId: null, calendarOwnerId: null, syncCalendar: false });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code });
  }
}));

export default router;
