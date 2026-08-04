import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKeyMs, timelineBounds, timelinePosition } from '../../client/src/dateSchedule.js';

test('timeline date arithmetic treats YYYY-MM-DD as stable calendar keys', () => {
  assert.equal((dateKeyMs('2026-08-03') - dateKeyMs('2026-07-31')) / 86400000, 3);
  assert.equal(dateKeyMs('2026-02-30'), null);
  assert.equal(dateKeyMs('08/03/2026'), null);
});

test('timeline positions preserve edited task duration and reject invalid ranges', () => {
  const task = { id: 'valid', startDate: '2026-08-03', endDate: '2026-08-07' };
  const bounds = timelineBounds([
    task,
    { id: 'invalid', startDate: '2026-08-10', endDate: '2026-08-01' },
  ]);
  assert.deepEqual(bounds.validTasks.map((entry) => entry.id), ['valid']);
  const position = timelinePosition(task, bounds);
  assert.equal(position.duration, 5);
  assert.ok(position.left >= 0);
  assert.ok(position.left + position.width <= 100);
});
