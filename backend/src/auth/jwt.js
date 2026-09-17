'use strict';
const jwt = require('jsonwebtoken');

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('Set JWT_SECRET to at least 32 random characters.');
  return s;
}
function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: '30d' });
}
function verifyToken(token) {
  return jwt.verify(token, secret());
}
module.exports = { signToken, verifyToken };
