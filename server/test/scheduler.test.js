import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKeyInTimeZone,
  isWorkingHour,
  selectDeadlineReminders,
  zonedInstant,
} from '../src/services/scheduler.js';

const users = [
  { id: 'worker', role: 'creative', disabled: false },
  { id: 'pm', role: 'pm', disabled: false },
  { id: 'unrelated', role: 'creative', disabled: false },
];

const task = {
  id: 'task-1',
  title: 'Assigned work',
  status: 'Draft 1',
  assigneeId: 'worker',
  pmId: 'pm',
  endDate: '2026-08-03',
};

const draft = {
  id: 'draft-1',
  taskId: task.id,
  step: 'Draft 1',
  order: 0,
  status: 'In Progress',
  dueDate: '2026-08-03',
  estDays: 1,
  estHours: 0,
  loggedHours: 2,
  remindedDates: [],
};

const TZ = 'Asia/Bangkok';
// Deadline 2026-08-03 means 2026-08-03 18:00 Bangkok = 11:00Z.
const select = (iso, overrides = {}, force = false) =>
  selectDeadlineReminders(
    { tasks: [task], drafts: [{ ...draft, ...overrides }], users },
    new Date(iso),
    force,
    TZ
  );

test('each tier fires at its own time and only for the assignee', () => {
  assert.equal(select('2026-08-01T03:00:00Z').length, 0); // 3 days out
  const twoDays = select('2026-08-02T03:00:00Z'); // 10:00 on T-2d
  assert.equal(twoDays.length, 1);
  assert.equal(twoDays[0].tier, 'T2d');
});

test('most urgent crossed tier wins and earlier tiers are marked sent', () => {
  const oneDay = select('2026-08-02T08:00:00Z'); // 15:00 on T-2d, before T1d
  assert.equal(oneDay[0].tier, 'T2d');
  const fiveHours = select('2026-08-03T06:30:00Z'); // 13:30 on due day
  assert.equal(fiveHours[0].tier, 'T5h');
  assert.deepEqual(fiveHours[0].seenTiers.sort(), ['T1d', 'T2d', 'T5h']);
  const overdue = select('2026-08-04T03:00:00Z');
  assert.equal(overdue[0].tier, 'overdue');
});

test('a tier is never sent twice unless forced', () => {
  assert.equal(select('2026-08-02T03:00:00Z', { remindedTiers: ['T2d'] }).length, 0);
  assert.equal(select('2026-08-02T03:00:00Z', { remindedTiers: ['T2d'] }, true).length, 1);
});

test('no reminders outside working hours', () => {
  assert.equal(select('2026-08-03T12:00:00Z').length, 0); // 19:00
  assert.equal(select('2026-08-03T01:00:00Z').length, 0); // 08:00
});

test('finished or nearly finished phases are not nagged', () => {
  assert.equal(select('2026-08-02T03:00:00Z', { status: 'Approved' }).length, 0);
  assert.equal(select('2026-08-02T03:00:00Z', { loggedHours: 8 }).length, 0);
  assert.equal(select('2026-08-02T03:00:00Z', { loggedHours: 7.5 }).length, 0); // T2d skipped
  assert.equal(select('2026-08-03T06:30:00Z', { loggedHours: 7.5 }).length, 1); // T5h still sent
});

test('reminder is a system message in the assignee self-chat', () => {
  const [r] = select('2026-08-02T03:00:00Z');
  assert.equal(r.recipientId, 'worker');
  assert.notEqual(r.recipientId, task.pmId);
  assert.equal(r.message.channelKey, 'worker::worker');
  assert.equal(r.message.senderId, 'worker');
  assert.equal(r.message.system, true);
  assert.equal(r.message.markSenderRead, false);
  assert.equal(r.message.taskId, task.id);
  assert.match(r.message.body, /เหลือ 2 วัน/);
});

test('disabled or missing assignees receive no deadline reminder', () => {
  const disabledUsers = users.map((user) =>
    user.id === 'worker' ? { ...user, disabled: true } : user
  );
  const now = new Date('2026-08-02T03:00:00Z');
  assert.equal(
    selectDeadlineReminders({ tasks: [task], drafts: [draft], users: disabledUsers }, now, false, TZ).length,
    0
  );
  // an assignee id that points at nobody is not "unassigned": no reminder
  assert.equal(
    selectDeadlineReminders({ tasks: [{ ...task, assigneeId: 'missing' }], drafts: [draft], users }, now, false, TZ).length,
    0
  );
});

test('a task with no assignee reminds its PM instead', () => {
  const [r] = selectDeadlineReminders(
    { tasks: [{ ...task, assigneeId: null }], drafts: [draft], users },
    new Date('2026-08-02T03:00:00Z'),
    false,
    TZ
  );
  assert.equal(r.recipientId, 'pm');
  assert.equal(r.message.channelKey, 'pm::pm');
  assert.match(r.message.body, /ยังไม่มีผู้รับผิดชอบ/);
});

test('time zone helpers use the configured zone', () => {
  const now = new Date('2026-07-31T18:30:00.000Z');
  assert.equal(dayKeyInTimeZone(now, 'Asia/Bangkok'), '2026-08-01');
  assert.equal(dayKeyInTimeZone(now, 'UTC'), '2026-07-31');
  assert.equal(zonedInstant('2026-08-03', 18, 'Asia/Bangkok').toISOString(), '2026-08-03T11:00:00.000Z');
  assert.equal(isWorkingHour(new Date('2026-07-31T03:00:00Z'), 'Asia/Bangkok'), true);
  assert.equal(isWorkingHour(new Date('2026-07-31T11:00:00Z'), 'Asia/Bangkok'), false);
});
