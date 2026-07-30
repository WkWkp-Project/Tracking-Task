import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin, publicUser } from '../auth/jwt.js';
import { newUser, hashPassword, ROLES } from '../services/users.js';
import { buildWorkload, assessRisk } from '../services/riskEngine.js';

const router = Router();
router.use(requireAuth);

// List all members (everyone can see the team)
router.get('/', (_req, res) => {
  res.json({ users: db.users.all().map(publicUser) });
});

// Admin: create a user with id/password (manual onboarding)
router.post('/', requireAdmin, async (req, res) => {
  const { name, email, role, password, capacityHoursPerDay } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const exists = db.users.findOne((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'A user with that email already exists' });
  if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' });

  const u = newUser({ name, email, role, capacityHoursPerDay });
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be >= 6 chars' });
    u.passwordHash = await hashPassword(password);
  }
  db.users.insert(u);
  res.status(201).json({ user: publicUser(u) });
});

// Admin: update a user (role, capacity, name, disabled, reset password)
router.patch('/:id', requireAdmin, async (req, res) => {
  const target = db.users.byId(req.params.id);
  if (!target) return res.status(404).json({ error: 'not found' });
  const { name, role, capacityHoursPerDay, disabled, password } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' });
    patch.role = role;
    patch.roleConfirmed = true; // admin assigning a role is authoritative — clears the self-pick gate
  }
  if (capacityHoursPerDay !== undefined) patch.capacityHoursPerDay = Number(capacityHoursPerDay) || 8;
  if (disabled !== undefined) patch.disabled = !!disabled;
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be >= 6 chars' });
    patch.passwordHash = await hashPassword(password);
  }
  db.users.update(target.id, patch);
  res.json({ user: publicUser(db.users.byId(target.id)) });
});

// Admin: delete a user
router.delete('/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'You cannot delete yourself' });
  const ok = db.users.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// Workload calendar + per-task risk for one member (PM capacity planning view)
router.get('/:id/workload', (req, res) => {
  const user = db.users.byId(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  const myTasks = db.tasks.find((t) => t.assigneeId === user.id);
  const calendar = buildWorkload(user, myTasks);
  const risks = myTasks.map((t) =>
    assessRisk(t, user, myTasks.filter((o) => o.id !== t.id), db.drafts.find((dr) => dr.taskId === t.id))
  );
  res.json({
    user: publicUser(user),
    capacityPerDay: user.capacityHoursPerDay || 8,
    calendar,
    tasks: myTasks,
    risks,
  });
});

export default router;
