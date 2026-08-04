import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessRisk,
  buildWorkload,
  detectConflicts,
  normalCdf,
  remainingHours,
  workdaysBetween,
  workweekMetric,
} from '../src/services/riskEngine.js';

const user = { id: 'worker', capacityHoursPerDay: 8 };

function task(overrides = {}) {
  return {
    id: 'task-1',
    title: 'Campaign',
    projectId: 'project-1',
    assigneeId: user.id,
    status: 'To Do',
    startDate: '2026-07-27',
    endDate: '2026-07-31',
    estimatedHours: 20,
    loggedHours: 0,
    ...overrides,
  };
}

test('workdaysBetween includes weekdays and excludes weekends', () => {
  assert.deepEqual(workdaysBetween('2026-07-31', '2026-08-03'), [
    '2026-07-31',
    '2026-08-03',
  ]);
  assert.deepEqual(workdaysBetween('2026-08-01', '2026-08-02'), []);
  assert.deepEqual(workweekMetric(), {
    days: [1, 2, 3, 4, 5],
    label: 'Monday–Friday',
    excludesWeekends: true,
  });
});

test('weekend-only tasks consume no workload capacity', () => {
  const weekendTask = task({
    startDate: '2026-08-01',
    endDate: '2026-08-02',
    estimatedHours: 16,
  });
  assert.deepEqual(buildWorkload(user, [weekendTask]), {});
});

test('editing the task date range redistributes remaining effort across the new workdays', () => {
  const original = buildWorkload(user, [task({ estimatedHours: 40 })]);
  assert.equal(original['2026-07-27'].load, 8);
  assert.equal(original['2026-07-31'].load, 8);

  const moved = buildWorkload(user, [task({
    startDate: '2026-07-29',
    endDate: '2026-08-03',
    estimatedHours: 40,
  })]);
  assert.deepEqual(Object.keys(moved), [
    '2026-07-29',
    '2026-07-30',
    '2026-07-31',
    '2026-08-03',
  ]);
  assert.equal(moved['2026-07-29'].load, 10);
  assert.equal(moved['2026-08-03'].load, 10);
  assert.equal(moved['2026-08-01'], undefined);
  assert.equal(moved['2026-08-02'], undefined);
});

test('remaining hours never becomes negative', () => {
  assert.equal(remainingHours(task({ estimatedHours: 8, loggedHours: 12 })), 0);
});

test('normal CDF is centered and monotonic', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(normalCdf(-1) < normalCdf(0));
  assert.ok(normalCdf(1) > normalCdf(0));
});

test('conflict engine identifies shared-capacity overload', () => {
  const first = task({ id: 'a', estimatedHours: 32 });
  const second = task({ id: 'b', estimatedHours: 24 });
  const result = detectConflicts(user, [first], second);
  assert.equal(result.hasConflict, true);
  assert.equal(result.overloadedDays.length, 5);
  assert.ok(result.peakUtilization > 1);
  assert.equal(result.overlapsWith[0].taskId, 'a');
});

test('terminal and archived tasks do not consume workload capacity', () => {
  const calendar = buildWorkload(user, [
    task({ id: 'done', status: 'Done' }),
    task({ id: 'cancelled', status: 'Cancelled' }),
    task({ id: 'archived', status: 'Archive' }),
  ]);
  assert.deepEqual(calendar, {});
});

test('unfinished overdue work is critical', () => {
  const result = assessRisk(
    task({ endDate: '2026-07-30', estimatedHours: 8 }),
    user,
    [],
    [],
    new Date('2026-07-31T12:00:00Z')
  );
  assert.equal(result.level, 'Critical');
  assert.ok(result.onTimeProbability <= 0.1);
});

test('approved phases clear phase risk and capacity demand', () => {
  const result = assessRisk(
    task({ status: 'Approval', estimatedHours: 8 }),
    user,
    [],
    [{ id: 'draft', step: 'Final', estDays: 1, estHours: 0, loggedHours: 0, status: 'Approved' }],
    new Date('2026-07-28T12:00:00Z')
  );
  assert.equal(result.level, 'Done');
  assert.equal(result.expectedRemainingHours, 0);
  assert.equal(result.phases[0].level, 'Done');
});
