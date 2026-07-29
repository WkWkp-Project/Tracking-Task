import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth/jwt.js';
import { runDeadlineReminders } from '../services/scheduler.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Manually fire the deadline-reminder scan (for testing without waiting for 10:00)
router.post('/run-reminders', (req, res) => {
  const force = req.body?.force !== false; // default true for manual runs
  const sent = runDeadlineReminders(new Date(), force);
  res.json({ ok: true, sent });
});

export default router;
