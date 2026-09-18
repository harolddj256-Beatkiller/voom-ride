'use strict';
const { verifyToken } = require('../auth/jwt');
const { HttpError } = require('../errors');
const { prisma } = require('../db');
const { shouldBeAdmin } = require('../policy/admins');
const { driverBlockReason } = require('../policy/drivers');

function authenticate() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const [scheme, headerToken] = header.split(' ');
      // <img> tags can't set an Authorization header, so the admin photo viewer
      // passes the token as a query param instead; every other caller uses the header.
      const token = scheme === 'Bearer' ? headerToken : (typeof req.query?.token === 'string' ? req.query.token : null);
      if (!token) throw new HttpError(401, 'Missing or invalid Authorization header.');
      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        throw new HttpError(401, 'Invalid or expired token.');
      }
      let user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new HttpError(401, 'Account no longer exists.');
      // Phones listed in ADMIN_PHONES become admins the first time they use the app.
      if (user.role !== 'ADMIN' && shouldBeAdmin(user)) {
        user = await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      }
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

// Only drivers an admin has approved may see or accept ride requests.
function requireVerifiedDriver() {
  return (req, res, next) => {
    const reason = driverBlockReason(req.user);
    if (reason) return next(new HttpError(403, reason));
    next();
  };
}

module.exports = { authenticate, requireRole, requireVerifiedDriver };
