import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, newUser } from '../src/services/users.js';
import { config, isSuperAdminEmail } from '../src/config.js';

test('production roles can be picked and stay assignable workers', () => {
  for (const role of ['art_director', 'graphic', 'content_creator', 'editor', 'director', 'producer'])
    assert.ok(ROLES.includes(role), role);
  assert.equal(newUser({ email: 'a@x.com', role: 'producer' }).role, 'producer');
  assert.equal(newUser({ email: 'a@x.com', role: 'nonsense' }).role, 'creative');
});

test('existing role keys are unchanged', () => {
  for (const role of ['admin', 'pm', 'ae', 'creative', 'copywriter', 'video'])
    assert.ok(ROLES.includes(role), role);
});

test('super admin check is case-insensitive and exact', () => {
  assert.ok(config.superAdminEmails.includes('jarupat@team.wkwkp.com'));
  assert.equal(isSuperAdminEmail('Jarupat@Team.WkWkp.com'), true);
  assert.equal(isSuperAdminEmail(' jarupat@team.wkwkp.com '), true);
  assert.equal(isSuperAdminEmail('other@team.wkwkp.com'), false);
  assert.equal(isSuperAdminEmail('jarupat@team.wkwkp.com.evil.io'), false);
  assert.equal(isSuperAdminEmail(''), false);
});
