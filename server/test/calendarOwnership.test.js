import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarOwnerForTask } from '../src/services/calendar.js';

test('an existing calendar event is always operated on with its original owner', () => {
  const owner = { id: 'owner', googleRefreshToken: 'owner-token' };
  const actingUser = { id: 'acting', googleRefreshToken: 'acting-token' };
  const task = { calendarEventId: 'event', calendarOwnerId: owner.id };
  assert.equal(calendarOwnerForTask(task, actingUser, (id) => id === owner.id ? owner : null), owner);
});

test('legacy events without owner metadata retain the acting-user fallback', () => {
  const actingUser = { id: 'acting' };
  assert.equal(calendarOwnerForTask({ calendarEventId: 'legacy' }, actingUser, () => null), actingUser);
});

test('a missing stored calendar owner fails instead of touching another calendar', () => {
  assert.throws(
    () => calendarOwnerForTask(
      { calendarEventId: 'event', calendarOwnerId: 'missing' },
      { id: 'acting' },
      () => null
    ),
    (error) => error.code === 'CALENDAR_OWNER_UNAVAILABLE'
  );
});
