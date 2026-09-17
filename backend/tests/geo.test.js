'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isCoordinate, distanceKm, inServiceArea, validateTrip, estimateFare } = require('../src/geo');
const { MARKETS, getMarket, getRideType } = require('../src/markets');

test('coordinate validation rejects out-of-range and non-finite input', () => {
  for (const p of [null, {}, { latitude: '9', longitude: 38 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }]) {
    assert.equal(isCoordinate(p), false);
  }
  assert.equal(isCoordinate({ latitude: 0, longitude: 0 }), true);
});

test('distance is symmetric and zero on the same point', () => {
  const a = MARKETS.et.center, b = MARKETS.ug.center;
  assert.equal(distanceKm(a, a), 0);
  assert.equal(distanceKm(a, b), distanceKm(b, a));
});

test('trips cannot mix pickup and destination across markets', () => {
  const et = getMarket('et');
  assert.match(validateTrip(et, et.center, MARKETS.ug.center), /service area/);
});

test('pickup and destination must be at least 100 metres apart', () => {
  const et = getMarket('et');
  assert.match(validateTrip(et, et.center, et.center), /100 metres/);
});

test('unsupported market and ride type are rejected', () => {
  assert.throws(() => getMarket('zz'));
  assert.throws(() => getRideType(getMarket('et'), 'not-a-ride'));
});

test('fare respects the minimum fare and currency rounding step', () => {
  for (const market of Object.values(MARKETS)) {
    for (const ride of market.rideTypes) {
      const fare = estimateFare(market, ride, 1000);
      assert.ok(fare >= ride.minFare);
      assert.equal(fare % (market.currency === 'UGX' ? 500 : 5), 0);
    }
  }
});

test('a longer distance increases the fare', () => {
  const et = getMarket('et');
  const ride = et.rideTypes[0];
  assert.ok(estimateFare(et, ride, 30000) > estimateFare(et, ride, 1000));
});

test('invalid distance is rejected', () => {
  const et = getMarket('et');
  for (const d of [NaN, -1, undefined]) assert.throws(() => estimateFare(et, et.rideTypes[0], d));
});

test('service area check matches each market center', () => {
  assert.equal(inServiceArea(MARKETS.et.center, MARKETS.et), true);
  assert.equal(inServiceArea(MARKETS.ug.center, MARKETS.et), false);
});
