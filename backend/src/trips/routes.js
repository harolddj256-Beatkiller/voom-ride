'use strict';
const express = require('express');
const { prisma } = require('../db');
const { HttpError } = require('../errors');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { getMarket, getRideType } = require('../markets');
const { coordinates, distanceKm, validateTrip, estimateFare } = require('../geo');
const { createReceiptForTrip } = require('../receipts/service');

const router = express.Router();

function publicPerson(user) {
  if (!user) return null;
  return { name: user.name, vehicleModel: user.vehicleModel || null, vehiclePlate: user.vehiclePlate || null };
}
function tripView(trip) {
  return {
    id: trip.id,
    riderId: trip.riderId,
    driverId: trip.driverId,
    rider: trip.rider ? publicPerson(trip.rider) : undefined,
    driver: trip.driver ? publicPerson(trip.driver) : undefined,
    market: trip.market,
    rideType: trip.rideType,
    pickup: { latitude: trip.pickupLat, longitude: trip.pickupLng, label: trip.pickupLabel },
    destination: { latitude: trip.destLat, longitude: trip.destLng, label: trip.destLabel },
    distanceMeters: trip.distanceMeters,
    durationSeconds: trip.durationSeconds,
    currency: trip.currency,
    fareAmount: trip.fareAmount,
    paymentMethod: trip.paymentMethod,
    status: trip.status,
    requestedAt: trip.requestedAt,
    acceptedAt: trip.acceptedAt,
    startedAt: trip.startedAt,
    completedAt: trip.completedAt,
    cancelledAt: trip.cancelledAt,
  };
}

router.post('/', authenticate(), async (req, res, next) => {
  try {
    const body = req.body || {};
    const market = getMarket(body.market);
    const ride = getRideType(market, body.rideType);
    const pickup = coordinates(body.pickup);
    const destination = coordinates(body.destination);
    const invalid = validateTrip(market, pickup, destination);
    if (invalid) throw new HttpError(422, invalid);
    const straightLineMeters = distanceKm(pickup, destination) * 1000;
    let distanceMeters = Number(body.distanceMeters);
    if (!Number.isFinite(distanceMeters) || distanceMeters < straightLineMeters * 0.95) {
      distanceMeters = straightLineMeters; // Ignore an implausible client-reported distance.
    }
    const durationSeconds = Number.isFinite(Number(body.durationSeconds)) ? Math.round(Number(body.durationSeconds)) : null;
    const paymentMethod = body.paymentMethod === 'CASH' ? 'CASH' : 'CHAPA';
    if (!market.paymentMethods.includes(paymentMethod)) throw new HttpError(400, 'Unsupported payment method for this market.');
    const fareAmount = estimateFare(market, ride, distanceMeters);
    const trip = await prisma.trip.create({
      data: {
        riderId: req.user.id,
        market: market.id,
        rideType: ride.id,
        pickupLat: pickup.latitude,
        pickupLng: pickup.longitude,
        pickupLabel: String(body.pickup?.label || 'Pickup').slice(0, 160),
        destLat: destination.latitude,
        destLng: destination.longitude,
        destLabel: String(body.destination?.label || 'Destination').slice(0, 160),
        distanceMeters,
        durationSeconds,
        currency: market.currency,
        fareAmount,
        paymentMethod,
      },
    });
    res.status(201).json({ trip: tripView(trip) });
  } catch (err) { next(err); }
});

router.get('/', authenticate(), async (req, res, next) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { OR: [{ riderId: req.user.id }, { driverId: req.user.id }] },
      orderBy: { requestedAt: 'desc' },
      take: 50,
      include: { rider: true, driver: true },
    });
    res.json({ trips: trips.map(tripView) });
  } catch (err) { next(err); }
});

router.get('/available', authenticate(), requireRole('DRIVER'), async (req, res, next) => {
  try {
    const market = String(req.query.market || '');
    getMarket(market);
    const trips = await prisma.trip.findMany({
      where: { status: 'REQUESTED', driverId: null, market },
      orderBy: { requestedAt: 'asc' },
      take: 20,
      include: { rider: true },
    });
    res.json({ trips: trips.map(tripView) });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate(), async (req, res, next) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, include: { rider: true, driver: true } });
    if (!trip || (trip.riderId !== req.user.id && trip.driverId !== req.user.id)) {
      throw new HttpError(404, 'Trip not found.');
    }
    res.json({ trip: tripView(trip) });
  } catch (err) { next(err); }
});

router.post('/:id/accept', authenticate(), requireRole('DRIVER'), async (req, res, next) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) throw new HttpError(404, 'Trip not found.');
    if (trip.status !== 'REQUESTED' || trip.driverId) throw new HttpError(409, 'Trip is no longer available.');
    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { driverId: req.user.id, status: 'ACCEPTED', acceptedAt: new Date() },
      include: { rider: true, driver: true },
    });
    res.json({ trip: tripView(updated) });
  } catch (err) { next(err); }
});

router.post('/:id/start', authenticate(), requireRole('DRIVER'), async (req, res, next) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip || trip.driverId !== req.user.id) throw new HttpError(404, 'Trip not found.');
    if (trip.status !== 'ACCEPTED') throw new HttpError(409, 'Trip cannot be started from its current status.');
    const updated = await prisma.trip.update({ where: { id: trip.id }, data: { status: 'IN_PROGRESS', startedAt: new Date() }, include: { rider: true, driver: true } });
    res.json({ trip: tripView(updated) });
  } catch (err) { next(err); }
});

router.post('/:id/complete', authenticate(), requireRole('DRIVER'), async (req, res, next) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip || trip.driverId !== req.user.id) throw new HttpError(404, 'Trip not found.');
    if (trip.status !== 'IN_PROGRESS') throw new HttpError(409, 'Trip cannot be completed from its current status.');
    const updated = await prisma.trip.update({ where: { id: trip.id }, data: { status: 'COMPLETED', completedAt: new Date() }, include: { rider: true, driver: true } });
    if (updated.paymentMethod === 'CASH') {
      await createReceiptForTrip(updated, { provider: 'CASH', status: 'SUCCESS' });
    }
    res.json({ trip: tripView(updated) });
  } catch (err) { next(err); }
});

router.post('/:id/cancel', authenticate(), async (req, res, next) => {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip || (trip.riderId !== req.user.id && trip.driverId !== req.user.id)) throw new HttpError(404, 'Trip not found.');
    if (['COMPLETED', 'CANCELLED'].includes(trip.status)) throw new HttpError(409, 'Trip can no longer be cancelled.');
    const updated = await prisma.trip.update({ where: { id: trip.id }, data: { status: 'CANCELLED', cancelledAt: new Date() }, include: { rider: true, driver: true } });
    res.json({ trip: tripView(updated) });
  } catch (err) { next(err); }
});

module.exports = router;
