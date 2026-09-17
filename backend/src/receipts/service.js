'use strict';
const crypto = require('node:crypto');
const { prisma } = require('../db');

function receiptNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `VOOM-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// Creates (or returns the existing) Payment + Receipt for a completed trip.
// `payment` is either an already-persisted Payment row (CHAPA) or a
// descriptor `{ provider, status, txRef?, providerRef? }` for cash trips
// where no Payment row exists yet.
async function createReceiptForTrip(trip, payment) {
  const existing = await prisma.receipt.findUnique({ where: { tripId: trip.id } });
  if (existing) return existing;

  const rider = await prisma.user.findUnique({ where: { id: trip.riderId } });
  const driver = trip.driverId ? await prisma.user.findUnique({ where: { id: trip.driverId } }) : null;

  let paymentRow = payment.id ? payment : null;
  if (!paymentRow) {
    paymentRow = await prisma.payment.create({
      data: {
        tripId: trip.id,
        provider: payment.provider,
        txRef: payment.txRef || `cash-${trip.id}`,
        providerRef: payment.providerRef || null,
        amount: trip.fareAmount,
        currency: trip.currency,
        status: payment.status,
      },
    });
  }

  return prisma.receipt.create({
    data: {
      number: receiptNumber(),
      tripId: trip.id,
      paymentId: paymentRow.id,
      amount: trip.fareAmount,
      currency: trip.currency,
      riderName: rider?.name || 'Rider',
      driverName: driver?.name || null,
    },
  });
}

module.exports = { createReceiptForTrip };
