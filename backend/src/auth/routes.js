'use strict';
const express = require('express');
const { prisma } = require('../db');
const { HttpError } = require('../errors');
const { hashPassword, verifyPassword } = require('./password');
const { signToken } = require('./jwt');
const { requestOtp, verifyOtp } = require('./otp');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

function requiredString(value, name, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new HttpError(400, `Invalid ${name}.`);
  }
  return value.trim();
}
function validRole(value) {
  return ['RIDER', 'DRIVER'].includes(value) ? value : 'RIDER';
}
function publicUser(user) {
  return {
    id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role,
    phoneVerified: !!user.phoneVerifiedAt, vehicleModel: user.vehicleModel, vehiclePlate: user.vehiclePlate,
  };
}
function vehicleFields(body, role) {
  if (role !== 'DRIVER') return {};
  const vehicleModel = typeof body?.vehicleModel === 'string' ? body.vehicleModel.trim().slice(0, 60) || null : null;
  const vehiclePlate = typeof body?.vehiclePlate === 'string' ? body.vehiclePlate.trim().slice(0, 20) || null : null;
  return { vehicleModel, vehiclePlate };
}

router.post('/register', async (req, res, next) => {
  try {
    const name = requiredString(req.body?.name, 'name', { min: 2, max: 80 });
    const email = requiredString(req.body?.email, 'email', { max: 160 }).toLowerCase();
    const password = requiredString(req.body?.password, 'password', { min: 8, max: 100 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Invalid email.');
    const role = validRole(req.body?.role);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'An account with this email already exists.');
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role, ...vehicleFields(req.body, role) },
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = requiredString(req.body?.email, 'email', { max: 160 }).toLowerCase();
    const password = requiredString(req.body?.password, 'password', { max: 100 });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, 'Incorrect email or password.');
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/otp/send', async (req, res, next) => {
  try {
    const { phone } = await requestOtp(req.body?.phone);
    res.json({ phone, sent: true });
  } catch (err) { next(err); }
});

router.post('/otp/verify', async (req, res, next) => {
  try {
    const { phone } = await verifyOtp(req.body?.phone, req.body?.code);
    const role = validRole(req.body?.role);
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim().slice(0, 80) : 'VOOM user';
      user = await prisma.user.create({ data: { name, phone, role, phoneVerifiedAt: new Date(), ...vehicleFields(req.body, role) } });
    } else if (!user.phoneVerifiedAt) {
      user = await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.get('/me', authenticate(), async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
