import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDatabase } from '../src/db.js';

test('invalid database JSON fails closed instead of returning an empty database', () => {
  assert.throws(
    () => parseDatabase('{ broken json', 'test-db.json'),
    /Refusing to start.*test-db\.json/i
  );
});

test('database parsing restores collections missing from an older schema', () => {
  const parsed = parseDatabase('{"users":[{"id":"u1"}]}', 'test-db.json');
  assert.equal(parsed.users[0].id, 'u1');
  assert.deepEqual(parsed.tasks, []);
  assert.deepEqual(parsed.groups, []);
});

test('database parsing rejects syntactically valid but unsafe collection shapes', () => {
  assert.throws(
    () => parseDatabase('{"users":{},"tasks":[]}', 'test-db.json'),
    /users must be an array/i
  );
});
