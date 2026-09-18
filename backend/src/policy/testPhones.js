'use strict';
// TESTING ONLY. Until a real SMS service is set up, phone numbers listed in
// TEST_PHONES get no SMS; instead the code is the one you chose in TEST_OTP_CODE.
// Real users are not affected. Remove both settings before the public launch.
const { adminPhones } = require('./admins');

function testOtpCode(env = process.env) {
  const code = String(env.TEST_OTP_CODE || '').trim();
  return /^\d{6}$/.test(code) ? code : null;
}

function isTestPhone(phone, env = process.env) {
  if (!testOtpCode(env)) return false;
  return adminPhones(env.TEST_PHONES).includes(phone);
}

module.exports = { testOtpCode, isTestPhone };
