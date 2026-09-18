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

const { isTestPhone, testOtpCode } = require('../src/policy/testPhones');
test('test phones only work when a 6-digit test code is set', () => {
  const env = { TEST_PHONES: '+256770433003, +256700000001', TEST_OTP_CODE: '482915' };
  assert.equal(testOtpCode(env), '482915');
  assert.equal(isTestPhone('+256770433003', env), true);
  assert.equal(isTestPhone('+256700000001', env), true);
  assert.equal(isTestPhone('+251911223344', env), false);
  assert.equal(isTestPhone('+256770433003', { TEST_PHONES: '+256770433003', TEST_OTP_CODE: '12' }), false);
  assert.equal(isTestPhone('+256770433003', { TEST_PHONES: '+256770433003' }), false);
});
