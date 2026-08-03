import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKeyInTimeZone,
  isReminderHour,
  selectDeadlineReminders,
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

test('deadline reminders select only the task assignee', () => {
  const reminders = selectDeadlineReminders(
    { tasks: [task], drafts: [draft], users },
    new Date('2026-07-31T03:00:00.000Z'),
    false,
    'Asia/Bangkok'
  );

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].recipientId, 'worker');
  assert.notEqual(reminders[0].recipientId, task.pmId);
  assert.deepEqual(
    reminders.map((reminder) => reminder.recipientId),
    ['worker']
  );
  assert.equal(reminders[0].message.channelType, 'dm');
  assert.equal(reminders[0].message.channelKey, 'worker::worker');
  assert.equal(reminders[0].message.senderId, 'worker');
  assert.equal(reminders[0].message.system, true);
  assert.equal(reminders[0].message.markSenderRead, false);
  assert.equal(reminders[0].message.taskId, task.id);
});

test('disabled or missing assignees receive no deadline reminder', () => {
  const disabledUsers = users.map((user) =>
    user.id === 'worker' ? { ...user, disabled: true } : user
  );
  assert.equal(
    selectDeadlineReminders(
      { tasks: [task], drafts: [draft], users: disabledUsers },
      new Date('2026-07-31T03:00:00.000Z'),
      false,
      'Asia/Bangkok'
    ).length,
    0
  );
  assert.equal(
    selectDeadlineReminders(
      { tasks: [{ ...task, assigneeId: 'missing' }], drafts: [draft], users },
      new Date('2026-07-31T03:00:00.000Z'),
      false,
      'Asia/Bangkok'
    ).length,
    0
  );
});

test('daily dedupe uses the configured timezone calendar date', () => {
  const now = new Date('2026-07-31T18:30:00.000Z');
  assert.equal(dayKeyInTimeZone(now, 'Asia/Bangkok'), '2026-08-01');
  assert.equal(dayKeyInTimeZone(now, 'UTC'), '2026-07-31');

  const alreadyReminded = {
    ...draft,
    dueDate: '2026-08-03',
    remindedDates: ['2026-08-01'],
  };
  assert.equal(
    selectDeadlineReminders(
      { tasks: [task], drafts: [alreadyReminded], users },
      now,
      false,
      'Asia/Bangkok'
    ).length,
    0
  );
});

test('10:00 schedule is evaluated in the configured timezone', () => {
  assert.equal(
    isReminderHour(new Date('2026-07-31T03:00:00.000Z'), 'Asia/Bangkok'),
    true
  );
  assert.equal(
    isReminderHour(new Date('2026-07-31T02:59:00.000Z'), 'Asia/Bangkok'),
    false
  );
  assert.equal(
    isReminderHour(new Date('2026-07-31T03:00:00.000Z'), 'UTC'),
    false
  );
});
