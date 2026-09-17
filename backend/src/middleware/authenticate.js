'use strict';
const { verifyToken } = require('../auth/jwt');
const { HttpError } = require('../errors');
const { prisma } = require('../db');

function authenticate() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Missing or invalid Authorization header.');
      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        throw new HttpError(401, 'Invalid or expired token.');
      }
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new HttpError(401, 'Account no longer exists.');
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'Not allowed for this account type.'));
    next();
  };
}

module.exports = { authenticate, requireRole };
