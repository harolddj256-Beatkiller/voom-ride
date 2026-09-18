'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { adminPhones, shouldBeAdmin } = require('../src/policy/admins');
const { driverBlockReason } = require('../src/policy/drivers');

test('ADMIN_PHONES is read as a clean list of phone numbers', () => {
  assert.deepEqual(adminPhones(' +251 911 223344, +256700000000 ,junk,'), ['+251911223344', '+256700000000']);
  assert.deepEqual(adminPhones(''), []);
  assert.deepEqual(adminPhones(undefined), []);
});

test('only a listed, SMS-verified phone becomes admin', () => {
  const env = '+251911223344';
  assert.equal(shouldBeAdmin({ phone: '+251911223344', phoneVerifiedAt: new Date() }, env), true);
  assert.equal(shouldBeAdmin({ phone: '+251911223344', phoneVerifiedAt: null }, env), false);
  assert.equal(shouldBeAdmin({ phone: '+251900000000', phoneVerifiedAt: new Date() }, env), false);
  assert.equal(shouldBeAdmin({ phone: '+251911223344', phoneVerifiedAt: new Date() }, ''), false);
});

test('only approved drivers may see or take ride requests', () => {
  assert.equal(driverBlockReason({ role: 'DRIVER', verificationStatus: 'VERIFIED' }), null);
  assert.match(driverBlockReason({ role: 'DRIVER', verificationStatus: 'PENDING' }), /being reviewed/);
  assert.match(driverBlockReason({ role: 'DRIVER', verificationStatus: 'REJECTED' }), /rejected/);
  assert.ok(driverBlockReason({ role: 'RIDER', verificationStatus: 'NOT_REQUIRED' }));
  assert.ok(driverBlockReason(null));
});
