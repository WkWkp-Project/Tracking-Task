// Team workload calendar: per-user daily booked hours over a date range,
// with overloaded (conflict) days flagged. Powers the Calendar view.

import { Router } from 'express';
import db from '../db.js';
import { requireAuth, publicUser } from '../auth/jwt.js';
import { buildWorkload, detectConflicts } from '../services/riskEngine.js';

const router = Router();
router.use(requireAuth);

function inRange(day, from, to) {
  return (!from || day >= from) && (!to || day <= to);
}

// GET /api/workload?from=YYYY-MM-DD&to=YYYY-MM-DD&assigneeId=optional
router.get('/', (req, res) => {
  const { from, to, assigneeId } = req.query;
  let members = db.users.all().filter((u) => !u.disabled && u.role !== 'admin');
  if (assigneeId) members = members.filter((u) => u.id === assigneeId);

  const result = members.map((user) => {
    const myTasks = db.tasks.find((t) => t.assigneeId === user.id);
    const calendar = buildWorkload(user, myTasks);
    const cap = user.capacityHoursPerDay || 8;

    const days = {};
    let overloadedCount = 0;
    for (const [day, info] of Object.entries(calendar)) {
      if (!inRange(day, from, to)) continue;
      const over = info.load > cap + 1e-6;
      if (over) overloadedCount++;
      days[day] = {
        load: Math.round(info.load * 100) / 100,
        capacity: cap,
        over,
        tasks: info.tasks.map((t) => ({
          taskId: t.taskId,
          title: t.title,
          hours: Math.round(t.hours * 100) / 100,
        })),
      };
    }

    // pairwise overlaps among this person's tasks (the "งานชน" list)
    const conflict = detectConflicts(user, myTasks, null);
    const overlaps = [];
    const active = myTasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled');
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
          overlaps.push({
            a: { id: a.id, title: a.title, start: a.startDate, end: a.endDate, projectId: a.projectId },
            b: { id: b.id, title: b.title, start: b.startDate, end: b.endDate, projectId: b.projectId },
          });
        }
      }
    }

    return {
      user: publicUser(user),
      capacityPerDay: cap,
      days,
      overloadedCount,
      peakUtilization: conflict.peakUtilization,
      overlaps,
      tasks: active.map((t) => ({
        id: t.id, title: t.title, projectId: t.projectId,
        startDate: t.startDate, endDate: t.endDate,
        estimatedHours: t.estimatedHours, loggedHours: t.loggedHours, status: t.status,
      })),
    };
  });

  res.json({ from, to, members: result });
});

export default router;
