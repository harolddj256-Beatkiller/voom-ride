import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

const TERMINAL = ['COMPLETED', 'CANCELLED'];

export function useTripPolling(tripId, initialTrip) {
  const [trip, setTrip] = useState(initialTrip || null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!tripId) return null;
    try {
      const { trip: fresh } = await api.getTrip(tripId);
      setTrip(fresh);
      setError(null);
      return fresh;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return undefined;
    let alive = true;
    async function tick() {
      const fresh = await refresh();
      if (!alive) return;
      if (fresh && !TERMINAL.includes(fresh.status)) {
        timerRef.current = setTimeout(tick, 3000);
      }
    }
    tick();
    return () => { alive = false; clearTimeout(timerRef.current); };
  }, [tripId, refresh]);

  return { trip, error, refresh };
}
