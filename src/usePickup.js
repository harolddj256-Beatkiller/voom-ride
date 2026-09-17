import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
const { MARKETS } = require('./markets.cjs');
const { isCoordinate, inServiceArea, pointLabel } = require('./geo.cjs');

export function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer=setTimeout(() => reject(new Error(message)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
export function usePickup(market, onOtherMarket) {
  const [pickup, setPickup] = useState({ ...market.pickup });
  const [status, setStatus] = useState('Default pickup — use GPS or move the pin.');
  const [busy, setBusy] = useState(false);
  const serial = useRef(0);
  // Invalidates an OS response that arrives after switching city, manually moving
  // a pin, cancelling, navigating away, or unmounting.
  useEffect(() => () => { serial.current += 1; }, []);
  function cancel() { serial.current += 1; setBusy(false); }
  function reset(nextMarket, point) {
    cancel(); setPickup(point || { ...nextMarket.pickup });
    setStatus(point ? 'Device location selected. Confirm the exact pin.' : 'Default pickup — use GPS or move the pin.');
  }
  function choose(point, label='Pinned pickup') {
    if (!isCoordinate(point)) return;
    cancel();
    setPickup({ latitude:point.latitude, longitude:point.longitude, label, source:'pin' });
    setStatus('Manual pickup — confirm a safe place to stop.');
  }
  async function locate() {
    const run=++serial.current; setBusy(true); setStatus('Finding your location…');
    try {
      const permission=await Location.requestForegroundPermissionsAsync();
      if (run!==serial.current) return;
      if (permission.status!=='granted') {
        setStatus('Location permission is off. You can still choose the pickup pin.');
        if (!permission.canAskAgain) Alert.alert('Location access is off',
          'Allow VOOM to use location in Settings, or choose a pickup manually.', [
            { text:'Use map pin', style:'cancel' },
            { text:'Settings', onPress:() => Linking.openSettings().catch(() => {}) },
          ]);
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Device location is switched off. Use the map pin or enable Location Services.');
      let pos; let cached=false;
      try {
        pos=await withTimeout(Location.getCurrentPositionAsync({ accuracy:Location.Accuracy.High }),
          12000, 'GPS took too long.');
      } catch (_) {
        pos=await withTimeout(Location.getLastKnownPositionAsync({ maxAge:60000, requiredAccuracy:100 }),
          2000, 'No recent location was available.'); cached=true;
      }
      if (run!==serial.current) return;
      if (!isCoordinate(pos?.coords)) throw new Error('GPS is unavailable. Try again outdoors or choose a map pin.');
      const p={ latitude:pos.coords.latitude, longitude:pos.coords.longitude,
        accuracy:pos.coords.accuracy, source:cached?'cached-gps':'gps',
        label:cached?'Recent device location':'Device location' };
      if (!inServiceArea(p,market)) {
        const other=Object.values(MARKETS).find(m => inServiceArea(p,m));
        setStatus(`Your device is outside the ${market.city} service area. No pickup was changed.`);
        if (other) Alert.alert('Your location is in another service city',
          `Switch to ${other.city} and use this pickup?`, [
            { text:'Keep this city', style:'cancel' },
            { text:`Use ${other.city}`, onPress:() => { if (run===serial.current) onOtherMarket(other.id,p); } },
          ]);
        return;
      }
      setPickup(p);
      setStatus(`${cached?'Recent GPS fix (under 1 minute old)':'Device location captured'}${Number.isFinite(p.accuracy)?` • ±${Math.round(p.accuracy)} m`:''}. Confirm the pin.`);
    } catch (error) {
      if (run===serial.current) setStatus(error.message || 'Could not get location. Use the map pin.');
    } finally { if (run===serial.current) setBusy(false); }
  }
  async function resolveAddress() {
    const run=++serial.current; setBusy(true);
    try {
      const permission=await Location.requestForegroundPermissionsAsync();
      if (permission.status!=='granted') throw new Error('Address lookup needs location permission on this device. Coordinates remain usable.');
      const rows=await withTimeout(Location.reverseGeocodeAsync({latitude:pickup.latitude,longitude:pickup.longitude}),8000,'Address lookup timed out. Coordinates remain usable.');
      if (run!==serial.current) return;
      const address=rows?.[0];
      const label=address && [address.name || address.street, address.district || address.city].filter(Boolean).join(', ');
      if (!label) throw new Error('No street address was found. Your exact pin is still selected.');
      setPickup(p => ({...p,label}));
      setStatus('Device address lookup — check it against the pin before confirming.');
    } catch (e) { if (run===serial.current) setStatus(e.message); }
    finally { if (run===serial.current) setBusy(false); }
  }
  return { pickup, status, busy, locate, choose, reset, cancel, resolveAddress };
}
