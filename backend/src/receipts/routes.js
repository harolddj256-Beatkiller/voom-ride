'use strict';
const express = require('express');
const { prisma } = require('../db');
const { HttpError } = require('../errors');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

function receiptView(receipt) {
  return {
    id: receipt.id,
    number: receipt.number,
    tripId: receipt.tripId,
    amount: receipt.amount,
    currency: receipt.currency,
    issuedAt: receipt.issuedAt,
    riderName: receipt.riderName,
    driverName: receipt.driverName,
  };
}

router.get('/', authenticate(), async (req, res, next) => {
  try {
    const receipts = await prisma.receipt.findMany({
      where: { trip: { OR: [{ riderId: req.user.id }, { driverId: req.user.id }] } },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    });
    res.json({ receipts: receipts.map(receiptView) });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate(), async (req, res, next) => {
  try {
    const receipt = await prisma.receipt.findUnique({ where: { id: req.params.id }, include: { trip: true } });
    if (!receipt || (receipt.trip.riderId !== req.user.id && receipt.trip.driverId !== req.user.id)) {
      throw new HttpError(404, 'Receipt not found.');
    }
    res.json({ receipt: receiptView(receipt), trip: { pickup: receipt.trip.pickupLabel, destination: receipt.trip.destLabel, rideType: receipt.trip.rideType } });
  } catch (err) { next(err); }
});

module.exports = router;
