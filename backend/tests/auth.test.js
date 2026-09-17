'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'x'.repeat(32);

const { hashPassword, verifyPassword } = require('../src/auth/password');
const { signToken, verifyToken } = require('../src/auth/jwt');
const { normalizePhone } = require('../src/auth/otp');

test('passwords hash and verify round-trip, and reject the wrong password', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
});

test('JWT round-trips the user id and role', () => {
  const token = signToken({ id: 'user_123', role: 'DRIVER' });
  const payload = verifyToken(token);
  assert.equal(payload.sub, 'user_123');
  assert.equal(payload.role, 'DRIVER');
});

test('a tampered JWT is rejected', () => {
  const token = signToken({ id: 'user_123', role: 'RIDER' });
  assert.throws(() => verifyToken(token.slice(0, -2) + 'xx'));
});

test('phone numbers must be E.164', () => {
  assert.equal(normalizePhone('+251911223344'), '+251911223344');
  for (const bad of ['0911223344', '+1abc', '', 123, null]) {
    assert.throws(() => normalizePhone(bad));
  }
});
