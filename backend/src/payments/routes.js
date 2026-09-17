'use strict';
const express = require('express');
const crypto = require('node:crypto');
const { prisma } = require('../db');
const { HttpError } = require('../errors');
const { authenticate } = require('../middleware/authenticate');
const { initializeTransaction, verifyTransaction } = require('./chapa');
const { createReceiptForTrip } = require('../receipts/service');

const router = express.Router();

function baseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

router.post('/chapa/initialize', authenticate(), async (req, res, next) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.body?.tripId } });
    if (!trip || trip.riderId !== req.user.id) throw new HttpError(404, 'Trip not found.');
    if (trip.paymentMethod !== 'CHAPA') throw new HttpError(400, 'This trip is not set up for Chapa payment.');
    if (!['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(trip.status)) {
      throw new HttpError(409, 'Trip must be accepted before payment can be started.');
    }
    const existingPaid = await prisma.payment.findFirst({ where: { tripId: trip.id, status: 'SUCCESS' } });
    if (existingPaid) throw new HttpError(409, 'This trip has already been paid.');

    const txRef = `voom-${trip.id}-${crypto.randomBytes(4).toString('hex')}`;
    const payment = await prisma.payment.create({
      data: { tripId: trip.id, provider: 'CHAPA', txRef, amount: trip.fareAmount, currency: trip.currency, status: 'PENDING' },
    });
    const [firstName, ...rest] = (req.user.name || 'VOOM Rider').split(' ');
    const { checkoutUrl } = await initializeTransaction({
      amount: trip.fareAmount,
      currency: trip.currency,
      email: req.user.email || `${req.user.id}@voom.invalid`,
      firstName: firstName || 'VOOM',
      lastName: rest.join(' ') || 'Rider',
      txRef,
      callbackUrl: `${baseUrl(req)}/payments/chapa/webhook`,
      returnUrl: `${baseUrl(req)}/payments/chapa/return?tx_ref=${encodeURIComponent(txRef)}`,
      title: 'VOOM ride',
      description: `${trip.pickupLabel} to ${trip.destLabel}`,
    });
    res.status(201).json({ paymentId: payment.id, txRef, checkoutUrl });
  } catch (err) { next(err); }
});

async function settlePayment(txRef) {
  const payment = await prisma.payment.findUnique({ where: { txRef } });
  if (!payment) return null;
  if (payment.status === 'SUCCESS') return payment;
  const verified = await verifyTransaction(txRef);
  const paidEnough = verified && verified.status === 'success' && Number(verified.amount) >= payment.amount;
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: paidEnough ? 'SUCCESS' : 'FAILED', providerRef: verified?.reference || verified?.tx_ref || null },
  });
  if (paidEnough) {
    const trip = await prisma.trip.findUnique({ where: { id: payment.tripId } });
    if (trip) await createReceiptForTrip(trip, updated);
  }
  return updated;
}

// Chapa calls this server-to-server after a transaction completes. Per
// Chapa's guidance, the webhook body is a notification only — the actual
// status is always re-confirmed against the verify endpoint before any
// state changes, so a forged webhook call cannot mark a trip as paid.
router.post('/chapa/webhook', async (req, res) => {
  try {
    const txRef = req.body?.tx_ref || req.query.tx_ref;
    if (typeof txRef === 'string') await settlePayment(txRef);
  } catch (err) {
    console.error('Chapa webhook handling failed', err);
  }
  res.status(200).end();
});

router.get('/chapa/return', async (req, res, next) => {
  try {
    const txRef = String(req.query.tx_ref || '');
    if (!txRef) throw new HttpError(400, 'Missing tx_ref.');
    const payment = await settlePayment(txRef);
    res.json({ status: payment?.status || 'UNKNOWN' });
  } catch (err) { next(err); }
});

router.get('/chapa/:txRef/status', authenticate(), async (req, res, next) => {
  try {
    const payment = await settlePayment(req.params.txRef);
    if (!payment) throw new HttpError(404, 'Payment not found.');
    res.json({ status: payment.status });
  } catch (err) { next(err); }
});

module.exports = router;
