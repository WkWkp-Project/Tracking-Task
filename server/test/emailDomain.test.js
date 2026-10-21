import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedEmailDomain } from '../src/auth/google.js';

test('allows the domain and its subdomains', () => {
  assert.equal(isAllowedEmailDomain('a@wkwkp.com', 'wkwkp.com'), true);
  assert.equal(isAllowedEmailDomain('jarupat@team.wkwkp.com', 'wkwkp.com'), true);
  assert.equal(isAllowedEmailDomain('A@WKWKP.COM', 'wkwkp.com'), true);
});

test('rejects lookalike and unrelated domains', () => {
  assert.equal(isAllowedEmailDomain('a@evil-wkwkp.com', 'wkwkp.com'), false);
  assert.equal(isAllowedEmailDomain('a@wkwkp.com.evil.io', 'wkwkp.com'), false);
  assert.equal(isAllowedEmailDomain('a@gmail.com', 'wkwkp.com'), false);
  assert.equal(isAllowedEmailDomain('wkwkp.com@gmail.com', 'wkwkp.com'), false);
  assert.equal(isAllowedEmailDomain('', 'wkwkp.com'), false);
});

test('no configured domain means no restriction at this layer', () => {
  assert.equal(isAllowedEmailDomain('a@gmail.com', ''), true);
});

test('team.wkwkp.com config accepts team staff and not the bare parent domain', () => {
  assert.equal(isAllowedEmailDomain('jarupat@team.wkwkp.com', 'team.wkwkp.com'), true);
  assert.equal(isAllowedEmailDomain('a@wkwkp.com', 'team.wkwkp.com'), false);
  assert.equal(isAllowedEmailDomain('a@evil-team.wkwkp.com', 'team.wkwkp.com'), false);
});
