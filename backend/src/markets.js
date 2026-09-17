'use strict';
// Server-authoritative market, pricing and service-area configuration.
// Mirrors ../../src/markets.cjs but without demo/preview labelling — this is
// the source of truth the backend uses to price and validate real trips.
const MARKETS = {
  et: {
    id: 'et',
    country: 'Ethiopia',
    city: 'Addis Ababa',
    currency: 'ETB',
    center: { latitude: 9.0192, longitude: 38.7525 },
    serviceRadiusKm: 55,
    paymentMethods: ['CHAPA', 'CASH'],
    rideTypes: [
      { id: 'mini', name: 'Voom Mini', seats: 4, baseFare: 90, perKm: 38, minFare: 180 },
      { id: 'comfort', name: 'Voom Comfort', seats: 4, baseFare: 120, perKm: 50, minFare: 260 },
      { id: 'xl', name: 'Voom XL', seats: 6, baseFare: 170, perKm: 68, minFare: 350 },
    ],
  },
  ug: {
    id: 'ug',
    country: 'Uganda',
    city: 'Kampala',
    currency: 'UGX',
    center: { latitude: 0.3476, longitude: 32.5825 },
    serviceRadiusKm: 55,
    paymentMethods: ['CHAPA', 'CASH'],
    rideTypes: [
      { id: 'boda', name: 'Voom Boda', seats: 1, baseFare: 1500, perKm: 900, minFare: 3000 },
      { id: 'mini', name: 'Voom Mini', seats: 4, baseFare: 3000, perKm: 2200, minFare: 7000 },
      { id: 'comfort', name: 'Voom Comfort', seats: 4, baseFare: 4500, perKm: 3000, minFare: 10000 },
      { id: 'xl', name: 'Voom XL', seats: 6, baseFare: 6000, perKm: 4200, minFare: 16000 },
    ],
  },
};
function getMarket(id) {
  const market = MARKETS[id];
  if (!market) throw new Error('Unsupported market.');
  return market;
}
function getRideType(market, rideTypeId) {
  const ride = market.rideTypes.find(r => r.id === rideTypeId);
  if (!ride) throw new Error('Unsupported ride type for this market.');
  return ride;
}
module.exports = { MARKETS, getMarket, getRideType };
