'use strict';
const crypto = require('node:crypto');
const { prisma } = require('../db');
const { HttpError } = require('../errors');
const { sendSms } = require('./sms');

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_WINDOW_MS = 60 * 1000;

function normalizePhone(phone) {
  if (typeof phone !== 'string') throw new HttpError(400, 'Invalid phone number.');
  const trimmed = phone.trim();
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) throw new HttpError(400, 'Phone number must be in E.164 format, e.g. +2519xxxxxxxx.');
  return trimmed;
}
function hashCode(code, phone) {
  const pepper = process.env.JWT_SECRET || 'dev-otp-pepper';
  return crypto.createHmac('sha256', pepper).update(`${phone}:${code}`).digest('hex');
}
function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function requestOtp(phoneInput) {
  const phone = normalizePhone(phoneInput);
  const recent = await prisma.otpCode.findFirst({
    where: { phone, createdAt: { gt: new Date(Date.now() - RESEND_WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) throw new HttpError(429, 'Wait a minute before requesting another code.');
  const code = generateCode();
  await prisma.otpCode.create({
    data: { phone, codeHash: hashCode(code, phone), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  await sendSms(phone, `Your VOOM verification code is ${code}. It expires in 5 minutes.`);
  return { phone };
}

async function verifyOtp(phoneInput, codeInput) {
  const phone = normalizePhone(phoneInput);
  if (typeof codeInput !== 'string' || !/^\d{6}$/.test(codeInput)) throw new HttpError(400, 'Invalid code.');
  const record = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) throw new HttpError(400, 'Code expired or not found. Request a new one.');
  if (record.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Too many attempts. Request a new code.');
  const matches = record.codeHash === hashCode(codeInput, phone);
  if (!matches) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, 'Incorrect code.');
  }
  await prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return { phone };
}

module.exports = { requestOtp, verifyOtp, normalizePhone };
