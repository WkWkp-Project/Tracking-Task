import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth/jwt.js';
import { assertPlainObject, badRequest, forbidden } from '../http.js';
import { canConfigureKanban, normalizeKanbanPreferences } from '../services/kanbanConfig.js';

const router = Router();
router.use(requireAuth);

router.get('/config', (_req, res) => {
  res.json({ columns: normalizeKanbanPreferences(db.raw.meta?.kanbanColumns) });
});

router.patch('/config', (req, res) => {
  if (!canConfigureKanban(req.user)) throw forbidden('Only PM or Admin can configure the Kanban board');
  assertPlainObject(req.body);
  if (!Array.isArray(req.body.columns)) {
    throw badRequest('VALIDATION_ERROR', 'columns must be an array');
  }
  const columns = normalizeKanbanPreferences(req.body.columns);
  db.raw.meta = { ...(db.raw.meta || {}), kanbanColumns: columns };
  db.persist();
  res.json({ columns });
});

export default router;
