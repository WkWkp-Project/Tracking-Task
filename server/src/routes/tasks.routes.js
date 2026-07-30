import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../auth/jwt.js';
import { detectConflicts, assessRisk } from '../services/riskEngine.js';
import { notify, notifyMany } from '../services/notify.js';
import { upsertTaskEvent, deleteTaskEvent } from '../services/calendar.js';

const router = Router();
router.use(requireAuth);

export const TASK_STATUSES = [
  'To Do', 'Draft 1', 'Draft 2', 'Final', 'Client Review', 'Approval', 'Done', 'Cancelled',
];

function isPmWorker(user) {
  return !!user && !user.disabled && !['admin', 'pm', 'ae'].includes(user.role);
}

// A "day of work" converts to this many effort-hours when a draft estimate is
// entered as days + hours (e.g. "1 วัน 15 ชม" => 1*8 + 15 = 23h).
export const STD_DAY_HOURS = 8;
export function draftEffortHours(dr) {
  return (Number(dr.estDays) || 0) * STD_DAY_HOURS + (Number(dr.estHours) || 0);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function recomputeHours(task) {
  const drafts = db.drafts.find((dr) => dr.taskId === task.id).sort((a, b) => a.order - b.order);
  if (drafts.length) {
    const est = drafts.reduce((s, dr) => s + draftEffortHours(dr), 0);
    const logged = drafts.reduce((s, dr) => s + (Number(dr.loggedHours) || 0), 0);
    db.tasks.update(task.id, { estimatedHours: est, loggedHours: logged });
  }
  return db.tasks.byId(task.id);
}

function assigneeOtherTasks(task) {
  return db.tasks.find((t) => t.assigneeId === task.assigneeId && t.id !== task.id);
}

function decorate(task) {
  const drafts = db.drafts
    .find((dr) => dr.taskId === task.id)
    .sort((a, b) => a.order - b.order)
    .map((dr) => ({ ...dr, effortHours: draftEffortHours(dr) }));
  const attachments = db.attachments.find((a) => a.taskId === task.id);
  const assignee = db.users.byId(task.assigneeId);
  const risk = assignee ? assessRisk(task, assignee, assigneeOtherTasks(task), drafts) : null;
  return { ...task, drafts, attachments, risk };
}

// risk for a task, loading its drafts (for handlers that don't decorate)
function riskFor(task) {
  const assignee = db.users.byId(task.assigneeId);
  if (!assignee) return null;
  const drafts = db.drafts.find((dr) => dr.taskId === task.id);
  return assessRisk(task, assignee, assigneeOtherTasks(task), drafts);
}

function makeDraftsFromInput(taskId, draftsInput) {
  // draftsInput: [{ step, estHours, dueDate }]
  const list = (draftsInput && draftsInput.length
    ? draftsInput
    : [
        { step: 'Draft 1', estHours: 8 },
        { step: 'Draft 2', estHours: 4 },
        { step: 'Final', estHours: 4 },
      ]
  );
  return list.map((dft, i) => ({
    id: `dft_${nanoid(6)}`,
    taskId,
    step: dft.step || `Draft ${i + 1}`,
    order: i,
    estDays: Number(dft.estDays) || 0,
    estHours: Number(dft.estHours) || 0,
    loggedHours: Number(dft.loggedHours) || 0,
    status: dft.status || 'Pending', // Pending | In Progress | Revising | Approved
    dueDate: dft.dueDate || null,
    fileName: dft.fileName || null,
    fileType: dft.fileType || null,
    fileUrl: dft.fileUrl || null,
  }));
}

// ── List tasks (optionally by project), decorated with drafts + risk ─────────
router.get('/', (req, res) => {
  const { projectId, assigneeId } = req.query;
  let tasks = db.tasks.all();
  if (projectId) tasks = tasks.filter((t) => t.projectId === projectId);
  if (assigneeId) tasks = tasks.filter((t) => t.assigneeId === assigneeId);
  res.json({ tasks: tasks.map(decorate) });
});

// ── Conflict + risk preview (call BEFORE creating to warn the PM) ────────────
router.post('/conflict-check', (req, res) => {
  const { assigneeId, startDate, endDate, estimatedHours, drafts, taskId } = req.body || {};
  if (!assigneeId || !startDate || !endDate)
    return res.status(400).json({ error: 'assigneeId, startDate, endDate required' });
  const assignee = db.users.byId(assigneeId);
  if (!isPmWorker(assignee)) return res.status(400).json({ error: 'assignee must be an active PM production worker' });

  const est =
    Number(estimatedHours) ||
    (drafts || []).reduce((s, dr) => s + draftEffortHours(dr), 0) ||
    0;
  const candidate = {
    id: taskId || `__candidate__`,
    assigneeId,
    startDate,
    endDate,
    estimatedHours: est,
    loggedHours: 0,
    status: 'To Do',
    title: req.body.title || 'งานใหม่',
  };
  const existing = db.tasks.find((t) => t.assigneeId === assigneeId);
  const conflict = detectConflicts(assignee, existing, candidate);
  const candDrafts = (drafts || []).map((dr, i) => ({
    id: `c${i}`, step: dr.step, estDays: dr.estDays, estHours: dr.estHours,
    loggedHours: 0, status: 'Pending', dueDate: dr.dueDate || null,
  }));
  const risk = assessRisk(candidate, assignee, existing.filter((t) => t.id !== candidate.id), candDrafts);
  res.json({ conflict, risk, assignee: { id: assignee.id, name: assignee.name } });
});

// ── Get one task ─────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const task = db.tasks.byId(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  res.json({ task: decorate(task) });
});

// ── Create task (with drafts) + conflict warning + optional calendar sync ────
router.post('/', async (req, res) => {
  const {
    projectId, title, description, pmId, assigneeId, status,
    startDate, endDate, priority, syncCalendar, drafts,
  } = req.body || {};

  if (!projectId || !title || !assigneeId || !startDate || !endDate)
    return res.status(400).json({ error: 'projectId, title, assigneeId, startDate, endDate required' });
  if (status && !TASK_STATUSES.includes(status))
    return res.status(400).json({ error: 'invalid status' });
  const project = db.projects.byId(projectId);
  if (!project) return res.status(404).json({ error: 'project not found' });
  if (project.archived) return res.status(409).json({ error: 'cannot create a task in an archived project' });
  const assignee = db.users.byId(assigneeId);
  if (!isPmWorker(assignee)) return res.status(400).json({ error: 'assignee must be an active PM production worker' });

  const id = `tsk_${nanoid(8)}`;
  const draftRows = makeDraftsFromInput(id, drafts);
  const estimatedHours = draftRows.reduce((s, dr) => s + draftEffortHours(dr), 0);

  const task = {
    id,
    projectId,
    title,
    description: description || '',
    pmId: pmId || req.user.id,
    assigneeId,
    status: status || 'To Do',
    startDate,
    endDate,
    priority: priority || 'normal', // low | normal | high
    estimatedHours,
    loggedHours: 0,
    syncCalendar: !!syncCalendar,
    calendarEventId: null,
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
  };
  db.tasks.insert(task);
  draftRows.forEach((dr) => db.drafts.insert(dr));

  // ── conflict / risk evaluation -> notify PM if dangerous ──
  const others = assigneeOtherTasks(task);
  const conflict = detectConflicts(assignee, others, task);
  const risk = riskFor(task);

  if (conflict.hasConflict || ['High', 'Critical'].includes(risk.level)) {
    notify(task.pmId, {
      type: 'task_conflict',
      severity: risk.level === 'Critical' ? 'critical' : 'warning',
      title: `⚠️ งานชน/เสี่ยง: ${title}`,
      body:
        `${assignee?.name} โหลดสูงสุด ${conflict.peakUtilization}× ของ capacity` +
        (conflict.overloadedDays.length ? ` (เกินใน ${conflict.overloadedDays.length} วัน)` : '') +
        ` • โอกาสเสร็จทัน ${Math.round(risk.onTimeProbability * 100)}%`,
      link: `/tasks/${id}`,
      meta: { taskId: id, conflict, risk },
    });
  }
  // notify the assignee they got a new task
  if (assigneeId !== req.user.id) {
    notify(assigneeId, {
      type: 'task_assigned',
      title: `📌 ได้รับงานใหม่: ${title}`,
      body: `กำหนดส่ง ${endDate}`,
      link: `/tasks/${id}`,
      meta: { taskId: id },
    });
  }

  // ── optional google calendar sync ──
  let calendarWarning = null;
  if (task.syncCalendar) {
    try {
      const { eventId } = await upsertTaskEvent(req.user, task, [
        assignee?.email,
        db.users.byId(task.pmId)?.email,
      ]);
      db.tasks.update(id, { calendarEventId: eventId });
    } catch (e) {
      calendarWarning = e.code || e.message;
    }
  }

  res.status(201).json({ task: decorate(db.tasks.byId(id)), conflict, risk, calendarWarning });
});

// ── Update task ──────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const task = db.tasks.byId(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  const prevStatus = task.status;
  const prevAssigneeId = task.assigneeId;

  const fields = ['title', 'description', 'pmId', 'assigneeId', 'status', 'startDate', 'endDate', 'priority', 'syncCalendar'];
  const patch = {};
  for (const f of fields) if (req.body?.[f] !== undefined) patch[f] = req.body[f];
  if (patch.status && !TASK_STATUSES.includes(patch.status))
    return res.status(400).json({ error: 'invalid status' });
  if (patch.assigneeId && !isPmWorker(db.users.byId(patch.assigneeId)))
    return res.status(400).json({ error: 'assignee must be an active PM production worker' });
  db.tasks.update(task.id, patch);
  let updated = recomputeHours(db.tasks.byId(task.id));

  // notify assignee on status change
  if (patch.status && patch.status !== prevStatus && updated.assigneeId !== req.user.id) {
    notify(updated.assigneeId, {
      type: 'task_status',
      title: `🔁 สถานะงานเปลี่ยน: ${updated.title}`,
      body: `${prevStatus} → ${patch.status}`,
      link: `/tasks/${updated.id}`,
      meta: { taskId: updated.id },
    });
  }

  // re-evaluate conflict/risk, warn PM if it just became dangerous
  const assignee = db.users.byId(updated.assigneeId);
  const others = assigneeOtherTasks(updated);
  const conflict = detectConflicts(assignee, others, updated);
  const risk = riskFor(updated);

  // reassigned to a different worker (e.g. someone takes over) → notify them
  if (patch.assigneeId && patch.assigneeId !== prevAssigneeId && patch.assigneeId !== req.user.id) {
    notify(patch.assigneeId, {
      type: 'task_assigned',
      severity: conflict.hasConflict ? 'warning' : 'info',
      title: `🔄 ได้รับมอบหมายงาน (ทดแทน): ${updated.title}`,
      body: `กำหนดส่ง ${updated.endDate}` + (conflict.hasConflict ? ' • ระวังงานชน' : ''),
      link: `/tasks/${updated.id}`,
      meta: { taskId: updated.id },
    });
  }
  if (conflict.hasConflict || risk.level === 'Critical') {
    notify(updated.pmId, {
      type: 'task_conflict',
      severity: risk.level === 'Critical' ? 'critical' : 'warning',
      title: `⚠️ ความเสี่ยงอัปเดต: ${updated.title}`,
      body: `peak ${conflict.peakUtilization}× • เสร็จทัน ${Math.round(risk.onTimeProbability * 100)}%`,
      link: `/tasks/${updated.id}`,
      meta: { taskId: updated.id, conflict, risk },
    });
  }

  // keep calendar in sync
  let calendarWarning = null;
  if (updated.syncCalendar) {
    try {
      const { eventId } = await upsertTaskEvent(req.user, updated, [
        assignee?.email,
        db.users.byId(updated.pmId)?.email,
      ]);
      if (eventId !== updated.calendarEventId) db.tasks.update(updated.id, { calendarEventId: eventId });
    } catch (e) {
      calendarWarning = e.code || e.message;
    }
  } else if (!updated.syncCalendar && updated.calendarEventId) {
    try { await deleteTaskEvent(req.user, updated.calendarEventId); } catch {}
    db.tasks.update(updated.id, { calendarEventId: null });
  }

  res.json({ task: decorate(db.tasks.byId(updated.id)), conflict, risk, calendarWarning });
});

// ── Delete task ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const task = db.tasks.byId(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (task.calendarEventId) { try { await deleteTaskEvent(req.user, task.calendarEventId); } catch {} }
  db.drafts.removeWhere((dr) => dr.taskId === task.id);
  db.attachments.removeWhere((a) => a.taskId === task.id);
  db.taskUpdates.removeWhere((entry) => entry.taskId === task.id);
  db.tasks.remove(task.id);
  res.json({ ok: true });
});

// ── Task notes & team comments ──────────────────────────────────────────────
router.get('/:id/updates', (req, res) => {
  const task = db.tasks.byId(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  const updates = db.taskUpdates
    .find((entry) => entry.taskId === task.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((entry) => ({
      ...entry,
      author: (() => {
        const user = db.users.byId(entry.authorId);
        return user ? { id: user.id, name: user.name, role: user.role, avatarUrl: user.avatarUrl || null } : null;
      })(),
      canDelete: entry.authorId === req.user.id || task.pmId === req.user.id || req.user.role === 'admin',
    }));
  res.json({ updates });
});

router.post('/:id/updates', (req, res) => {
  const task = db.tasks.byId(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  const draftId = req.body?.draftId || null;
  if (draftId) {
    const draft = db.drafts.byId(draftId);
    if (!draft || draft.taskId !== task.id)
      return res.status(400).json({ error: 'draft not found in task' });
  }
  const type = req.body?.type === 'note' ? 'note' : 'comment';
  const body = (req.body?.body || '').trim();
  const attachment = req.body?.attachment || null;
  if (!body && !attachment?.url) return res.status(400).json({ error: 'body or attachment required' });
  const entry = {
    id: `upd_${nanoid(8)}`,
    taskId: task.id,
    draftId,
    type,
    body,
    attachment: attachment?.url ? {
      name: (attachment.name || 'attachment').slice(0, 160),
      type: attachment.type || 'file',
      url: attachment.url,
    } : null,
    authorId: req.user.id,
    createdAt: new Date().toISOString(),
  };
  db.taskUpdates.insert(entry);
  const recipients = [task.pmId, task.assigneeId].filter((id) => id && id !== req.user.id);
  if (recipients.length) {
    notifyMany(recipients, {
      type: 'task_comment',
      title: `${type === 'note' ? '📝 โน้ตใหม่' : '💬 คอมเมนต์ใหม่'}: ${task.title}`,
      body: body || `แนบไฟล์ ${entry.attachment?.name}`,
      link: `/tasks/${task.id}`,
      meta: { taskId: task.id, updateId: entry.id },
    });
  }
  res.status(201).json({
    update: {
      ...entry,
      author: { id: req.user.id, name: req.user.name, role: req.user.role, avatarUrl: req.user.avatarUrl || null },
      canDelete: true,
    },
  });
});

router.delete('/:id/updates/:updateId', (req, res) => {
  const task = db.tasks.byId(req.params.id);
  const entry = db.taskUpdates.byId(req.params.updateId);
  if (!task || !entry || entry.taskId !== task.id) return res.status(404).json({ error: 'not found' });
  if (entry.authorId !== req.user.id && task.pmId !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบรายการนี้' });
  db.taskUpdates.remove(entry.id);
  res.json({ ok: true });
});

// ── Add a draft step ─────────────────────────────────────────────────────────
router.post('/:id/drafts', (req, res) => {
  const task = db.tasks.byId(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  const existing = db.drafts.find((dr) => dr.taskId === task.id);
  const { step, estDays, estHours, dueDate } = req.body || {};
  const draft = {
    id: `dft_${nanoid(6)}`,
    taskId: task.id,
    step: step || `Draft ${existing.length + 1}`,
    order: existing.length,
    estDays: Number(estDays) || 0,
    estHours: Number(estHours) || 0,
    loggedHours: 0,
    status: 'Pending',
    dueDate: dueDate || null,
    fileName: null, fileType: null, fileUrl: null,
  };
  db.drafts.insert(draft);
  recomputeHours(task);
  res.status(201).json({ task: decorate(db.tasks.byId(task.id)) });
});

// ── Update a draft (hours, status, file, dueDate) ────────────────────────────
router.patch('/:id/drafts/:draftId', (req, res) => {
  const task = db.tasks.byId(req.params.id);
  const draft = db.drafts.byId(req.params.draftId);
  if (!task || !draft || draft.taskId !== task.id)
    return res.status(404).json({ error: 'not found' });
  const { step, estDays, estHours, loggedHours, status, dueDate, fileName, fileType, fileUrl } = req.body || {};
  const patch = {};
  if (step !== undefined) patch.step = step;
  if (estDays !== undefined) patch.estDays = Number(estDays) || 0;
  if (estHours !== undefined) patch.estHours = Number(estHours) || 0;
  if (loggedHours !== undefined) patch.loggedHours = Number(loggedHours) || 0;
  if (status !== undefined) patch.status = status;
  if (dueDate !== undefined) patch.dueDate = dueDate;
  if (fileName !== undefined) { patch.fileName = fileName; patch.fileType = fileType || null; patch.fileUrl = fileUrl || null; }
  db.drafts.update(draft.id, patch);
  recomputeHours(task);
  res.json({ task: decorate(db.tasks.byId(task.id)) });
});

// ── Delete a draft step and its associated hour logs ────────────────────────
router.delete('/:id/drafts/:draftId', (req, res) => {
  const task = db.tasks.byId(req.params.id);
  const draft = db.drafts.byId(req.params.draftId);
  if (!task || !draft || draft.taskId !== task.id)
    return res.status(404).json({ error: 'not found' });

  db.timeLogs.removeWhere((entry) => entry.taskId === task.id && entry.draftId === draft.id);
  db.taskUpdates.removeWhere((entry) => entry.taskId === task.id && entry.draftId === draft.id);
  db.drafts.remove(draft.id);
  db.drafts
    .find((entry) => entry.taskId === task.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach((entry, order) => db.drafts.update(entry.id, { order }));
  recomputeHours(task);
  res.json({ task: decorate(db.tasks.byId(task.id)) });
});

// ── Log work hours against a task/draft (adds to loggedHours) ────────────────
router.post('/:id/log-hours', (req, res) => {
  const task = db.tasks.byId(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  const { draftId, hours, date, note } = req.body || {};
  const h = Number(hours);
  if (!h || h <= 0) return res.status(400).json({ error: 'hours must be > 0' });

  const entry = {
    id: `log_${nanoid(8)}`,
    taskId: task.id,
    draftId: draftId || null,
    userId: req.user.id,
    hours: h,
    date: date || new Date().toISOString().slice(0, 10),
    note: note || '',
    createdAt: new Date().toISOString(),
  };
  db.timeLogs.insert(entry);

  if (draftId) {
    const draft = db.drafts.byId(draftId);
    if (draft && draft.taskId === task.id)
      db.drafts.update(draftId, { loggedHours: (Number(draft.loggedHours) || 0) + h });
  }
  recomputeHours(task);

  // re-assess; warn PM if logging pushed it over budget / into risk
  const updated = db.tasks.byId(task.id);
  const risk = riskFor(updated);
  if (updated.loggedHours > updated.estimatedHours || ['High', 'Critical'].includes(risk.level)) {
    notify(updated.pmId, {
      type: 'over_budget',
      severity: risk.level === 'Critical' ? 'critical' : 'warning',
      title: `⏱️ ชั่วโมงเกิน/เสี่ยง: ${updated.title}`,
      body: `logged ${updated.loggedHours}h / est ${updated.estimatedHours}h • เสร็จทัน ${Math.round(risk.onTimeProbability * 100)}%`,
      link: `/tasks/${updated.id}`,
      meta: { taskId: updated.id },
    });
  }
  res.json({ task: decorate(updated), risk, entry });
});

// ── Add an attachment (metadata; brief/reference link or uploaded file name) ─
router.post('/:id/attachments', (req, res) => {
  const task = db.tasks.byId(req.params.id);
  if (!task) return res.status(404).json({ error: 'not found' });
  const { name, type, url } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const att = {
    id: `att_${nanoid(6)}`,
    taskId: task.id,
    name,
    type: type || 'link', // pdf | image | video | link
    url: url || null,
    uploadedBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  db.attachments.insert(att);
  res.status(201).json({ task: decorate(db.tasks.byId(task.id)) });
});

router.delete('/:id/attachments/:attId', (req, res) => {
  db.attachments.remove(req.params.attId);
  res.json({ task: decorate(db.tasks.byId(req.params.id)) });
});

export default router;
