import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessDmChannel,
  dmChannelMembers,
  dmChannelKey,
  selfChannelKey,
} from '../src/services/chat.js';

test('self-chat uses the existing canonical DM channel model', () => {
  assert.equal(selfChannelKey('worker'), 'worker::worker');
  assert.equal(dmChannelKey('worker', 'worker'), 'worker::worker');
  assert.deepEqual(dmChannelMembers('worker::worker'), ['worker', 'worker']);
  assert.equal(canAccessDmChannel('worker', 'worker::worker'), true);
  assert.equal(canAccessDmChannel('unrelated', 'worker::worker'), false);
});

test('DM authorization accepts only canonical channels containing the user', () => {
  assert.equal(canAccessDmChannel('a', 'a::b'), true);
  assert.equal(canAccessDmChannel('b', 'a::b'), true);
  assert.equal(canAccessDmChannel('c', 'a::b'), false);
  assert.equal(canAccessDmChannel('a', 'b::a'), false);
  assert.equal(canAccessDmChannel('a', 'a::b::c'), false);
  assert.equal(canAccessDmChannel('a', ''), false);
});
