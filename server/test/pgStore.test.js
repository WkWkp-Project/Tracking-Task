import test from 'node:test';
import assert from 'node:assert/strict';
import { createPgStore } from '../src/pgStore.js';
import { parseDatabase } from '../src/db.js';

// Minimal in-memory stand-in for a pg Pool holding the single app_state row.
function fakePool() {
  const rows = new Map();
  const calls = [];
  return {
    calls,
    async query(text, params = []) {
      calls.push(text.trim().split(/\s+/).slice(0, 3).join(' '));
      if (/^SELECT/i.test(text.trim())) {
        return { rows: rows.has(params[0]) ? [{ raw: rows.get(params[0]) }] : [] };
      }
      if (/^INSERT/i.test(text.trim())) {
        rows.set(params[0], params[1]);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

test('load returns null before anything is saved', async () => {
  const store = createPgStore(fakePool());
  await store.init();
  assert.equal(await store.load(), null);
});

test('saved snapshot round-trips through load and parseDatabase', async () => {
  const store = createPgStore(fakePool());
  await store.init();
  await store.save(JSON.stringify({ users: [{ id: 'u1', email: 'a@x.com' }], tasks: [] }));
  const parsed = parseDatabase(await store.load(), 'test');
  assert.equal(parsed.users[0].id, 'u1');
  assert.deepEqual(parsed.drafts, []); // missing collections are restored
});

test('a later save replaces the earlier snapshot (single row)', async () => {
  const store = createPgStore(fakePool());
  await store.save(JSON.stringify({ users: [{ id: 'old' }] }));
  await store.save(JSON.stringify({ users: [{ id: 'new' }] }));
  assert.equal(JSON.parse(await store.load()).users[0].id, 'new');
});
