import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KANBAN_COLUMN_DEFAULTS,
  canConfigureKanban,
  normalizeKanbanPreferences,
} from '../src/services/kanbanConfig.js';

test('Kanban configuration is restricted to active PM and Admin users', () => {
  assert.equal(canConfigureKanban({ role: 'pm', disabled: false }), true);
  assert.equal(canConfigureKanban({ role: 'admin', disabled: false }), true);
  assert.equal(canConfigureKanban({ role: 'creative', disabled: false }), false);
  assert.equal(canConfigureKanban({ role: 'pm', disabled: true }), false);
});

test('Kanban preferences can rename, reorder and hide presentation columns only', () => {
  const result = normalizeKanbanPreferences([
    { id: 'review', label: 'Client Check', visible: true, statuses: ['Hacked'] },
    { id: 'brief', label: '  Intake  ', visible: false },
    { id: 'unknown', label: 'Unknown', visible: true },
  ]);
  assert.deepEqual(result.slice(0, 2), [
    { id: 'review', label: 'Client Check', visible: true },
    { id: 'brief', label: 'Intake', visible: false },
  ]);
  assert.equal(result.length, KANBAN_COLUMN_DEFAULTS.length);
  assert.equal(result.some((column) => column.id === 'unknown'), false);
  assert.equal(Object.hasOwn(result[0], 'statuses'), false);
});

test('Archive presentation cannot be disabled or removed', () => {
  const result = normalizeKanbanPreferences([{ id: 'archive', label: '', visible: false }]);
  const archive = result.find((column) => column.id === 'archive');
  assert.deepEqual(archive, { id: 'archive', label: 'Archive', visible: true });
});
