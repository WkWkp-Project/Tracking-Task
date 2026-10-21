import test from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/db.js';
import { notifyChatRecipients } from '../src/services/notify.js';

function fixture() {
  Object.assign(db.raw, {
    users: [
      { id: 'cn-a', name: 'A', online: true },
      { id: 'cn-b', name: 'B', online: false },
      { id: 'cn-c', name: 'C', online: true },
    ],
    groups: [{ id: 'cn-g', name: 'Team', memberIds: ['cn-a', 'cn-b', 'cn-c'] }],
    notifications: [],
  });
}

test('DM to an offline recipient creates a chat notification', () => {
  fixture();
  notifyChatRecipients(
    { senderId: 'cn-a', channelType: 'dm', channelKey: 'cn-a::cn-b', body: 'hello' },
    'A'
  );
  assert.equal(db.raw.notifications.length, 1);
  assert.equal(db.raw.notifications[0].userId, 'cn-b');
});

test('DM to an online recipient does not create a notification', () => {
  fixture();
  notifyChatRecipients(
    { senderId: 'cn-b', channelType: 'dm', channelKey: 'cn-a::cn-b', body: 'hi' },
    'B'
  );
  assert.equal(db.raw.notifications.length, 0);
});

test('group message notifies only offline members other than the sender', () => {
  fixture();
  notifyChatRecipients(
    { senderId: 'cn-a', channelType: 'group', channelKey: 'group:cn-g', body: 'hey' },
    'A'
  );
  assert.deepEqual(db.raw.notifications.map((n) => n.userId), ['cn-b']);
});
