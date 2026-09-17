import { useEffect, useState } from 'react';
import { MAPS_CONNECTED, MAPS_SETUP_NOTE, mapsRequest } from './mapsClient';
const { routeKey, validateTrip, previewRoute, normalizeRoute } = require('./geo.cjs');

export function useTripRoute(market, pickup, destination, ride, enabled) {
  const mode = ride?.id === 'boda' ? 'TWO_WHEELER' : 'DRIVE';
  const key = routeKey(market.id, pickup, destination, mode);
  const [result, setResult] = useState(null);
  const [revision, setRevision] = useState(0);
  const retry = () => setRevision(n => n+1);
  const error = validateTrip(market,pickup,destination);
  useEffect(() => {
    if (!enabled || error || !MAPS_CONNECTED) return;
    let alive=true; const controller=new AbortController();
    setResult({ key, loading:true });
    // Runs only after pickup confirmation, never for every map gesture.
    mapsRequest('/v1/route', { market:market.id, pickup, destination, travelMode:mode }, controller.signal)
      .then(data => { if (alive) setResult({ key, data:normalizeRoute(data,pickup,destination), loading:false }); })
      .catch(e => { if (alive) setResult({ key, data:previewRoute(pickup,destination,e.message), loading:false }); });
    return () => { alive=false; controller.abort(); };
  }, [enabled, key, revision, error]);
  const current = result?.key === key ? result : null;
  const fallback = previewRoute(pickup,destination, MAPS_CONNECTED ? 'Road route unavailable. Retry or continue with a straight-line estimate.' : MAPS_SETUP_NOTE);
  return { ...(current?.data || fallback), loading:!!(enabled && !error && MAPS_CONNECTED && (!current || current.loading)), validationError:error, retry };
}
