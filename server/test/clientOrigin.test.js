import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrigin } from '../src/config.js';

test('adds https:// when the scheme is missing', () => {
  assert.equal(normalizeOrigin('tasks.wkwkp.com'), 'https://tasks.wkwkp.com');
});

test('keeps an explicit scheme and drops trailing slashes', () => {
  assert.equal(normalizeOrigin('https://tasks.wkwkp.com/'), 'https://tasks.wkwkp.com');
  assert.equal(normalizeOrigin('http://localhost:5173'), 'http://localhost:5173');
  assert.equal(normalizeOrigin('  https://a.example.com//  '), 'https://a.example.com');
});

test('localhost without a scheme defaults to http', () => {
  assert.equal(normalizeOrigin('localhost:5173'), 'http://localhost:5173');
  assert.equal(normalizeOrigin('127.0.0.1:4000'), 'http://127.0.0.1:4000');
});

test('empty value falls back', () => {
  assert.equal(normalizeOrigin('', 'http://localhost:5173'), 'http://localhost:5173');
  assert.equal(normalizeOrigin(undefined, 'http://localhost:5173'), 'http://localhost:5173');
});
