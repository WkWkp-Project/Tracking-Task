import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileDraftDueDates } from '../src/services/taskSchedule.js';

test('moving a task range clamps phase deadlines outside the new range', () => {
  const adjustments = reconcileDraftDueDates([
    { id: 'early', step: 'Brief', dueDate: '2026-07-28' },
    { id: 'inside', step: 'Review', dueDate: '2026-08-05' },
    { id: 'late', step: 'Final', dueDate: '2026-08-12' },
    { id: 'auto', step: 'Auto', dueDate: null },
  ], '2026-08-01', '2026-08-10');

  assert.deepEqual(adjustments, [
    { draftId: 'early', step: 'Brief', from: '2026-07-28', to: '2026-08-01' },
    { draftId: 'late', step: 'Final', from: '2026-08-12', to: '2026-08-10' },
  ]);
});

test('unchanged and automatic deadlines need no adjustment', () => {
  assert.deepEqual(reconcileDraftDueDates([
    { id: 'inside', dueDate: '2026-08-05' },
    { id: 'auto', dueDate: null },
  ], '2026-08-01', '2026-08-10'), []);
});
