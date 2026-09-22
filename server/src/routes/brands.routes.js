// Shared brand registry — the single canonical name list both PM projects
// and AE work rows draw from, so "Molle" in one side and the other resolve
// to the exact same brand without either side displaying the other's work.

import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../auth/jwt.js';

const router = Router();
router.use(requireAuth);

function syncBrandsFromWork() {
  const known = new Map(db.brands.all().map((brand) => [brand.name.trim().toLowerCase(), brand]));
  const sources = [
    ...db.projects.all().map((project) => ({ name: project.brand, logoUrl: project.logoUrl || null })),
    ...db.aeTasks.all().map((task) => ({ name: task.project, logoUrl: null })),
  ];
  for (const source of sources) {
    const name = (source.name || '').trim();
    if (!name || known.has(name.toLowerCase())) continue;
    const brand = {
      id: `brd_${nanoid(8)}`,
      name,
      logoUrl: source.logoUrl,
      createdAt: new Date().toISOString(),
      createdBy: 'system-sync',
    };
    db.brands.insert(brand);
    known.set(name.toLowerCase(), brand);
  }
}

router.get('/', (_req, res) => {
  syncBrandsFromWork();
  const brands = [...db.brands.all()].sort((a, b) => a.name.localeCompare(b.name));
  res.json({ brands });
});

router.post('/', (req, res) => {
  const name = (req.body?.name || '').trim();
  const logoUrl = (req.body?.logoUrl || '').trim() || null;
  if (!name) return res.status(400).json({ error: 'name required' });
  const exists = db.brands.findOne((b) => b.name.toLowerCase() === name.toLowerCase());
  if (exists) return res.status(200).json({ brand: exists });
  const brand = { id: `brd_${nanoid(8)}`, name, logoUrl, createdAt: new Date().toISOString(), createdBy: req.user.id };
  db.brands.insert(brand);
  res.status(201).json({ brand });
});

router.patch('/:id', requireAdmin, (req, res) => {
  const brand = db.brands.byId(req.params.id);
  if (!brand) return res.status(404).json({ error: 'not found' });
  const patch = {};
  const oldName = brand.name;
  if (req.body?.name !== undefined) {
    const name = req.body.name.trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const duplicate = db.brands.findOne((entry) => entry.id !== brand.id && entry.name.toLowerCase() === name.toLowerCase());
    if (duplicate) return res.status(409).json({ error: 'มีชื่อแบรนด์นี้อยู่แล้ว' });
    patch.name = name;
  }
  if (req.body?.logoUrl !== undefined) patch.logoUrl = req.body.logoUrl.trim() || null;
  db.brands.update(brand.id, patch);

  const renamedTo = patch.name || oldName;
  db.projects
    .find((project) => (project.brand || '').trim().toLowerCase() === oldName.trim().toLowerCase())
    .forEach((project) => db.projects.update(project.id, {
      brand: renamedTo,
      ...(req.body?.logoUrl !== undefined ? { logoUrl: patch.logoUrl || '' } : {}),
    }));
  db.aeTasks
    .find((task) => (task.project || '').trim().toLowerCase() === oldName.trim().toLowerCase())
    .forEach((task) => db.aeTasks.update(task.id, { project: renamedTo }));

  res.json({ brand: db.brands.byId(brand.id) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const brand = db.brands.byId(req.params.id);
  if (!brand) return res.status(404).json({ error: 'not found' });
  // A brand still used by a project or AE row can't be deleted — the auto-sync
  // on the next list load would recreate it with a fresh id (losing logo/history).
  // Rename or clear those references first.
  const key = brand.name.trim().toLowerCase();
  const usedByProject = db.projects.findOne((p) => (p.brand || '').trim().toLowerCase() === key);
  const usedByAe = db.aeTasks.findOne((t) => (t.project || '').trim().toLowerCase() === key);
  if (usedByProject || usedByAe)
    return res.status(409).json({ error: 'ลบไม่ได้ — แบรนด์นี้ยังถูกใช้ในโปรเจกต์หรือตารางงาน AE อยู่' });
  db.brands.remove(brand.id);
  res.json({ ok: true });
});

export default router;
