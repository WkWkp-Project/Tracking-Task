import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, readState } from '../src/auth/oauthState.js';

test('state round-trips its details', () => {
  const state = createState({ mode: 'link', userId: 'u1' }, 60_000);
  const read = readState(state);
  assert.equal(read.mode, 'link');
  assert.equal(read.userId, 'u1');
});

test('expired, tampered and malformed states are rejected', () => {
  const state = createState({ mode: 'login' }, 1000, 0);
  assert.equal(readState(state, 5000), null);
  const [data, sig] = createState({ mode: 'login' }, 60_000).split('.');
  const forged = Buffer.from(JSON.stringify({ mode: 'link', userId: 'admin', exp: 9e15 })).toString('base64url');
  assert.equal(readState(`${forged}.${sig}`), null);
  assert.equal(readState(`${data}.x`), null);
  assert.equal(readState('garbage'), null);
  assert.equal(readState(''), null);
});

test('two states for the same details differ', () => {
  assert.notEqual(createState({ mode: 'login' }, 1000), createState({ mode: 'login' }, 1000));
});
