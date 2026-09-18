'use strict';
// Who is allowed to be an admin. Set ADMIN_PHONES on Vercel to one or more phone
// numbers in +2519xxxxxxxx form, separated by commas. We use PHONE (not email)
// because phones are proven with an SMS code at sign-up; emails are not checked,
// so anyone could type someone else's email.
function adminPhones(envValue = process.env.ADMIN_PHONES) {
  return String(envValue || '')
    .split(',')
    .map((p) => p.replace(/[\s()-]/g, ''))
    .filter((p) => /^\+[1-9]\d{7,14}$/.test(p));
}

function shouldBeAdmin(user, envValue) {
  if (!user || !user.phone || !user.phoneVerifiedAt) return false;
  return adminPhones(envValue).includes(user.phone);
}

module.exports = { adminPhones, shouldBeAdmin };
