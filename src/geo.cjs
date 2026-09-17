'use strict';
// Shared deterministic functions. No network, credentials or device dependencies.
function isCoordinate(p) {
  return !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
}
function coordinates(p) {
  if (!isCoordinate(p)) throw new Error('Invalid map coordinates');
  return { latitude: p.latitude, longitude: p.longitude };
}
function distanceKm(a, b) {
  coordinates(a); coordinates(b);
  const rad = n => n * Math.PI / 180;
  const h = Math.sin(rad(b.latitude-a.latitude)/2)**2 +
    Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
function inServiceArea(point, market) {
  return isCoordinate(point) && distanceKm(point, market.map) <= market.serviceRadiusKm;
}
function validateTrip(market, pickup, destination) {
  if (!isCoordinate(pickup) || !isCoordinate(destination)) return 'Choose a valid pickup and destination.';
  if (!inServiceArea(pickup, market) || !inServiceArea(destination, market))
    return `Keep both pins within the ${market.city} service area, or change city.`;
  if (distanceKm(pickup, destination) < 0.1) return 'Pickup and destination must be at least 100 metres apart.';
  return null;
}
function pointLabel(p) { return `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`; }
function routeKey(marketId, pickup, destination, mode = 'DRIVE') {
  return [marketId, mode, pickup.latitude.toFixed(6), pickup.longitude.toFixed(6),
    destination.latitude.toFixed(6), destination.longitude.toFixed(6)].join('|');
}
function previewRoute(pickup, destination, reason = 'Google routing is not connected.') {
  return { source:'preview', distanceMeters: distanceKm(pickup,destination)*1000,
    durationSeconds: null, coordinates:[], reason };
}
function estimateFare(market, ride, route) {
  if (!route || !Number.isFinite(route.distanceMeters) || route.distanceMeters < 0)
    throw new Error('A valid route or distance estimate is required');
  // On-device estimate for display only; the backend recomputes and stores
  // the authoritative fare when the ride is actually requested.
  const km = Math.max(1, route.distanceMeters / 1000);
  const step = market.currency === 'UGX' ? 500 : 5;
  return Math.ceil(Math.max(ride.minFare, ride.baseFare + km * ride.perKm) / step) * step;
}
function googleDirectionsURL(pickup, destination) {
  coordinates(pickup); coordinates(destination);
  return 'https://www.google.com/maps/dir/?api=1&origin=' +
    encodeURIComponent(`${pickup.latitude},${pickup.longitude}`) + '&destination=' +
    encodeURIComponent(`${destination.latitude},${destination.longitude}`) + '&travelmode=driving';
}
function decodePolyline(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 200000) throw new Error('Invalid route geometry');
  const out = []; let index = 0, lat = 0, lng = 0;
  const part = () => {
    let result = 0, shift = 0, b;
    do {
      if (index >= encoded.length || shift > 30) throw new Error('Invalid route geometry');
      b = encoded.charCodeAt(index++) - 63;
      if (b < 0 || b > 63) throw new Error('Invalid route geometry');
      result |= (b & 31) << shift; shift += 5;
    } while (b >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += part(); lng += part();
    const p = { latitude: lat/1e5, longitude: lng/1e5 };
    coordinates(p); out.push(p);
    if (out.length > 30000) throw new Error('Route is too large');
  }
  return out;
}
function normalizeRoute(data, pickup, destination) {
  if (!data || data.source !== 'google' || !Number.isFinite(data.distanceMeters) ||
      data.distanceMeters <= 0 || !Number.isFinite(data.durationSeconds) || data.durationSeconds <= 0 ||
      typeof data.encodedPolyline !== 'string') throw new Error('Incomplete road route');
  const points = decodePolyline(data.encodedPolyline);
  if (points.length < 2 || distanceKm(points[0],pickup) > 3 ||
      distanceKm(points[points.length-1],destination) > 3 ||
      data.distanceMeters < distanceKm(pickup,destination)*1000*0.8)
    throw new Error('Route did not match the selected pins');
  return { source:'google', distanceMeters:data.distanceMeters, durationSeconds:data.durationSeconds,
    coordinates:points, reason:'Google road route' };
}
module.exports = { isCoordinate, coordinates, distanceKm, inServiceArea, validateTrip, pointLabel,
  routeKey, previewRoute, estimateFare, googleDirectionsURL, decodePolyline, normalizeRoute };
