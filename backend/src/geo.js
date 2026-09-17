'use strict';
function isCoordinate(p) {
  return !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
}
function coordinates(p) {
  if (!isCoordinate(p)) throw new Error('Invalid map coordinates.');
  return { latitude: p.latitude, longitude: p.longitude };
}
function distanceKm(a, b) {
  coordinates(a); coordinates(b);
  const rad = n => n * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
function inServiceArea(point, market) {
  return isCoordinate(point) && distanceKm(point, market.center) <= market.serviceRadiusKm;
}
function validateTrip(market, pickup, destination) {
  if (!isCoordinate(pickup) || !isCoordinate(destination)) return 'Choose a valid pickup and destination.';
  if (!inServiceArea(pickup, market) || !inServiceArea(destination, market))
    return `Keep both pins within the ${market.city} service area, or change city.`;
  if (distanceKm(pickup, destination) < 0.1) return 'Pickup and destination must be at least 100 metres apart.';
  return null;
}
function estimateFare(market, ride, distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) throw new Error('A valid distance is required.');
  const km = Math.max(1, distanceMeters / 1000);
  const step = market.currency === 'UGX' ? 500 : 5;
  return Math.ceil(Math.max(ride.minFare, ride.baseFare + km * ride.perKm) / step) * step;
}
module.exports = { isCoordinate, coordinates, distanceKm, inServiceArea, validateTrip, estimateFare };
