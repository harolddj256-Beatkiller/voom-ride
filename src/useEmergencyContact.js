import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'voom.emergencyContactWhatsapp.v1';

// Persists the rider's chosen WhatsApp safety contact so trip details can be
// shared to the same number in one tap instead of retyping it every ride.
export function useEmergencyContact() {
  const [number, setNumberState] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (alive) { if (saved) setNumberState(saved); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const setNumber = useCallback((next) => {
    setNumberState(next);
    if (next) AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    else AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return [number, setNumber, loaded];
}
