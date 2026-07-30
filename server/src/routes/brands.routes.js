// Shared brand registry — the single canonical name list both PM projects
// and AE work rows draw from, so "Molle" in one side and the other resolve
// to the exact same brand without either side displaying the other's work.

import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../auth/jwt.js';

const router = Router();
router.use(requireAuth);

router.get('/', (_req, res) => {
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
  if (req.body?.name !== undefined) {
    const name = req.body.name.trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    patch.name = name;
  }
  if (req.body?.logoUrl !== undefined) patch.logoUrl = req.body.logoUrl.trim() || null;
  db.brands.update(brand.id, patch);
  res.json({ brand: db.brands.byId(brand.id) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const ok = db.brands.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

export default router;
