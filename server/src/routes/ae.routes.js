// Account-Executive work board — flat spreadsheet rows (one deadline per row).
// Shares the app's users/auth/notify; AE people are users with role 'ae'.

import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../auth/jwt.js';
import { notify } from '../services/notify.js';

const router = Router();
router.use(requireAuth);

export const AE_PRIORITY = ['urgent', 'daily', 'follow'];
export const AE_STATUS = ['not_started', 'in_progress', 'waiting_client', 'waiting_internal', 'done'];
export const AE_MANHOUR = ['<0.5', '1', '2', '3', '4', '5', '6', '7'];

const today = () => new Date().toISOString().slice(0, 10);
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const estFromManHour = (mh) => (mh === '<0.5' ? 0.5 : Number(mh) || 0);

// List (optionally filter by inChargeId), newest assign first
router.get('/', (req, res) => {
  const { inChargeId } = req.query;
  let rows = db.aeTasks.all();
  if (inChargeId) rows = rows.filter((r) => r.inChargeId === inChargeId);
  rows = [...rows].sort((a, b) => (b.assignDate || '').localeCompare(a.assignDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json({ tasks: rows });
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const manHour = AE_MANHOUR.includes(b.manHour) ? b.manHour : '<0.5';
  const row = {
    id: `ae_${nanoid(8)}`,
    assignDate: b.assignDate || today(),
    inChargeId: b.inChargeId || null,
    project: b.project || '',
    workDetails: b.workDetails || '',
    priority: AE_PRIORITY.includes(b.priority) ? b.priority : 'daily',
    status: AE_STATUS.includes(b.status) ? b.status : 'not_started',
    startDate: b.startDate || today(),
    dueDate: b.dueDate || plus(3),
    manHour,
    estWorkday: b.estWorkday != null ? Number(b.estWorkday) : estFromManHour(manHour),
    assets: Array.isArray(b.assets) ? b.assets : [],
    notes: b.notes || '',
    createdAt: new Date().toISOString(),
    createdBy: req.user.id,
  };
  db.aeTasks.insert(row);
  // notify the assignee (if it's someone else)
  if (row.inChargeId && row.inChargeId !== req.user.id) {
    notify(row.inChargeId, {
      type: 'ae_assigned',
      title: `📊 งาน AE ใหม่: ${row.workDetails || row.project || 'งาน'}`,
      body: `กำหนดส่ง ${row.dueDate}`,
      meta: { aeTaskId: row.id },
    });
  }
  res.status(201).json({ task: row });
});

router.patch('/:id', (req, res) => {
  const row = db.aeTasks.byId(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const patch = {};
  for (const f of ['assignDate', 'inChargeId', 'project', 'workDetails', 'startDate', 'dueDate', 'notes', 'assets']) {
    if (b[f] !== undefined) patch[f] = b[f];
  }
  if (b.priority !== undefined && AE_PRIORITY.includes(b.priority)) patch.priority = b.priority;
  if (b.status !== undefined && AE_STATUS.includes(b.status)) patch.status = b.status;
  if (b.manHour !== undefined && AE_MANHOUR.includes(b.manHour)) {
    patch.manHour = b.manHour;
    if (b.estWorkday === undefined) patch.estWorkday = estFromManHour(b.manHour);
  }
  if (b.estWorkday !== undefined) patch.estWorkday = Number(b.estWorkday) || 0;
  db.aeTasks.update(row.id, patch);
  res.json({ task: db.aeTasks.byId(row.id) });
});

router.delete('/:id', (req, res) => {
  const ok = db.aeTasks.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

export default router;
