'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const g=require('../src/geo.cjs');const {MARKETS}=require('../src/markets.cjs');
const m=MARKETS.et,a=m.pickup,b=m.destinations[0];
test('coordinate validation rejects non-finite, strings and out-of-range input',()=>{
  for(const p of [null,{}, {latitude:'9',longitude:38},{latitude:Infinity,longitude:0},{latitude:91,longitude:0},{latitude:0,longitude:-181}]) assert.equal(g.isCoordinate(p),false);
  assert.equal(g.isCoordinate({latitude:0,longitude:0}),true);
});
test('distance is symmetric, zero on the same pin and finite at antipodes',()=>{
  assert.equal(g.distanceKm(a,a),0);assert.equal(g.distanceKm(a,b),g.distanceKm(b,a));
  assert.ok(Math.abs(g.distanceKm({latitude:0,longitude:0},{latitude:0,longitude:180})-20015.09)<1);
});
test('the two service cities cannot be mixed into one ride',()=>{
  assert.equal(g.inServiceArea(MARKETS.ug.pickup,m),false);
  assert.match(g.validateTrip(m,a,MARKETS.ug.pickup),/service area/);
});
test('near-identical origin and destination are blocked',()=>{
  assert.match(g.validateTrip(m,a,a),/100 metres/);assert.equal(g.validateTrip(m,a,b),null);
});
test('manual pin outside the area is rejected',()=>{
  assert.equal(g.inServiceArea({latitude:a.latitude+2,longitude:a.longitude},m),false);
});
test('no-key fallback has no fake road geometry or ETA',()=>{
  const route=g.previewRoute(a,b);assert.equal(route.source,'preview');assert.deepEqual(route.coordinates,[]);
  assert.equal(route.durationSeconds,null);assert.ok(route.distanceMeters>0);
});
test('rider and driver use the identical fare function and minimum/rounding',()=>{
  for(const market of Object.values(MARKETS))for(const ride of market.rideTypes){
    const r=g.previewRoute(market.pickup,market.destinations[0]);
    const fare=g.estimateFare(market,ride,r);assert.ok(fare>=ride.minFare);
    assert.equal(fare%(market.currency==='ETB'?5:500),0);
    assert.equal(fare,g.estimateFare(market,ride,r));
  }
});
test('a longer supplied road distance changes price instead of using the aerial shortcut',()=>{
  const r=g.previewRoute(a,b);assert.ok(g.estimateFare(m,m.rideTypes[0],{...r,distanceMeters:30000})>g.estimateFare(m,m.rideTypes[0],r));
});
test('invalid pricing input is rejected',()=>{
  for(const r of [null,{}, {distanceMeters:NaN},{distanceMeters:-1}])assert.throws(()=>g.estimateFare(m,m.rideTypes[0],r));
});
test('Google Maps external URL contains the exact edited endpoints, no API key',()=>{
  const p={latitude:9.12345,longitude:38.45678},url=new URL(g.googleDirectionsURL(p,b));
  assert.equal(url.hostname,'www.google.com');assert.equal(url.searchParams.get('origin'),'9.12345,38.45678');
  assert.equal(url.searchParams.get('destination'),`${b.latitude},${b.longitude}`);assert.equal(url.searchParams.has('key'),false);
});
test('route keys distinguish new pickup, city, and travel mode',()=>{
  const k=g.routeKey('et',a,b);assert.notEqual(k,g.routeKey('ug',a,b));
  assert.notEqual(k,g.routeKey('et',{...a,latitude:a.latitude+0.001},b));
  assert.notEqual(k,g.routeKey('et',a,b,'TWO_WHEELER'));
});
test('standard encoded polyline decodes precisely',()=>{
  assert.deepEqual(g.decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'),[
    {latitude:38.5,longitude:-120.2},{latitude:40.7,longitude:-120.95},{latitude:43.252,longitude:-126.453}]);
});
test('truncated and invalid polyline are rejected',()=>{
  for(const p of ['_',String.fromCharCode(2),null,'x'.repeat(200001)])assert.throws(()=>g.decodePolyline(p));
});
test('route normalization rejects a polyline for an unrelated city',()=>{
  assert.throws(()=>g.normalizeRoute({source:'google',distanceMeters:5000,durationSeconds:600,encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'},a,b));
});
test('market seed destinations are explicitly identified as suggestions, not verified addresses',()=>{
  for(const market of Object.values(MARKETS)){assert.equal(market.pickup.source,'default');for(const d of market.destinations)assert.equal(d.source,'suggested');}
});
