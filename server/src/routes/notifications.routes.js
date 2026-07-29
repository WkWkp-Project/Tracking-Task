import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth/jwt.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const list = db.notifications
    .find((n) => n.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  const unread = list.filter((n) => !n.read).length;
  res.json({ notifications: list, unread });
});

router.post('/:id/read', (req, res) => {
  const n = db.notifications.byId(req.params.id);
  if (!n || n.userId !== req.user.id) return res.status(404).json({ error: 'not found' });
  db.notifications.update(n.id, { read: true });
  res.json({ ok: true });
});

router.post('/read-all', (req, res) => {
  db.notifications
    .find((n) => n.userId === req.user.id && !n.read)
    .forEach((n) => db.notifications.update(n.id, { read: true }));
  res.json({ ok: true });
});

export default router;
