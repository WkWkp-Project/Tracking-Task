import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../auth/jwt.js';
import { deleteTaskCascade, removeTaskCalendarEvent } from '../services/cascade.js';

const router = Router();
router.use(requireAuth);

// Only an admin, or a PM, may create/own projects; edits & deletes are limited
// to an admin or the project's own PM. Workers (creative/copywriter/video/ae)
// can view projects but never mutate them.
const canManageProjects = (user) => user.role === 'admin' || user.role === 'pm';
const canManageProject = (user, project) =>
  user.role === 'admin' || (user.role === 'pm' && project?.pmId === user.id);

router.get('/', (_req, res) => {
  res.json({ projects: db.projects.find((p) => !p.archived) });
});

router.post('/', (req, res) => {
  if (!canManageProjects(req.user)) return res.status(403).json({ error: 'เฉพาะ PM หรือแอดมินเท่านั้นที่สร้างโปรเจกต์ได้' });
  const { brand, name, clientEmail, pmId, description, logoUrl, links } = req.body || {};
  if (!brand || !name) return res.status(400).json({ error: 'brand & name required' });
  const project = {
    id: `prj_${nanoid(8)}`,
    brand,
    name,
    clientEmail: clientEmail || '',
    pmId: pmId || req.user.id,
    description: description || '',
    logoUrl: logoUrl || '',
    links: Array.isArray(links) ? links : [], // [{ label, url }]
    archived: false,
    createdAt: new Date().toISOString(),
  };
  db.projects.insert(project);
  res.status(201).json({ project });
});

router.patch('/:id', (req, res) => {
  const p = db.projects.byId(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  if (!canManageProject(req.user, p)) return res.status(403).json({ error: 'เฉพาะ PM ที่ดูแลโปรเจกต์นี้หรือแอดมินเท่านั้น' });
  const { archived } = req.body || {};
  const patch = {};
  ['brand', 'name', 'clientEmail', 'pmId', 'description', 'logoUrl', 'links'].forEach((k) => {
    if (req.body?.[k] !== undefined) patch[k] = req.body[k];
  });
  if (archived !== undefined) patch.archived = !!archived;
  db.projects.update(p.id, patch);
  res.json({ project: db.projects.byId(p.id) });
});

router.delete('/:id', async (req, res) => {
  const project = db.projects.byId(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });
  if (!canManageProject(req.user, project)) return res.status(403).json({ error: 'เฉพาะ PM ที่ดูแลโปรเจกต์นี้หรือแอดมินเท่านั้น' });
  // Full cascade per task (drafts, attachments, notes, time logs, calendar) —
  // same cleanup a direct task delete performs, so nothing is orphaned.
  const tasks = db.tasks.find((t) => t.projectId === project.id);
  for (const t of tasks) {
    await removeTaskCalendarEvent(req.user, t);
    deleteTaskCascade(t.id);
  }
  db.projects.remove(project.id);
  res.json({ ok: true });
});

export default router;
