import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth } from '../auth/jwt.js';

const router = Router();
router.use(requireAuth);

router.get('/', (_req, res) => {
  res.json({ projects: db.projects.find((p) => !p.archived) });
});

router.post('/', (req, res) => {
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
  const { archived } = req.body || {};
  const patch = {};
  ['brand', 'name', 'clientEmail', 'pmId', 'description', 'logoUrl', 'links'].forEach((k) => {
    if (req.body?.[k] !== undefined) patch[k] = req.body[k];
  });
  if (archived !== undefined) patch.archived = !!archived;
  db.projects.update(p.id, patch);
  res.json({ project: db.projects.byId(p.id) });
});

router.delete('/:id', (req, res) => {
  const tasks = db.tasks.find((t) => t.projectId === req.params.id);
  tasks.forEach((t) => {
    db.drafts.removeWhere((dr) => dr.taskId === t.id);
    db.tasks.remove(t.id);
  });
  const ok = db.projects.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

export default router;
