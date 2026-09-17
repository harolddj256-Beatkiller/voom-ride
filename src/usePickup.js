import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { useI18n } from './i18n';
const { MARKETS } = require('./markets.cjs');
const { isCoordinate, inServiceArea, pointLabel } = require('./geo.cjs');

export function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer=setTimeout(() => reject(new Error(message)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
export function usePickup(market, onOtherMarket) {
  const { t } = useI18n();
  const [pickup, setPickup] = useState({ ...market.pickup });
  const [status, setStatus] = useState(t('pickup.defaultStatus'));
  const [busy, setBusy] = useState(false);
  const serial = useRef(0);
  // Invalidates an OS response that arrives after switching city, manually moving
  // a pin, cancelling, navigating away, or unmounting.
  useEffect(() => () => { serial.current += 1; }, []);
  function cancel() { serial.current += 1; setBusy(false); }
  function reset(nextMarket, point) {
    cancel(); setPickup(point || { ...nextMarket.pickup });
    setStatus(point ? t('pickup.deviceLocationSelected') : t('pickup.defaultStatus'));
  }
  function choose(point, label=t('pickup.pinnedPickupLabel')) {
    if (!isCoordinate(point)) return;
    cancel();
    setPickup({ latitude:point.latitude, longitude:point.longitude, label, source:'pin' });
    setStatus(t('pickup.manualStatus'));
  }
  async function locate() {
    const run=++serial.current; setBusy(true); setStatus(t('pickup.findingLocation'));
    try {
      const permission=await Location.requestForegroundPermissionsAsync();
      if (run!==serial.current) return;
      if (permission.status!=='granted') {
        setStatus(t('pickup.permissionOff'));
        if (!permission.canAskAgain) Alert.alert(t('pickup.locationAccessOffTitle'),
          t('pickup.locationAccessOffBody'), [
            { text:t('pickup.useMapPin'), style:'cancel' },
            { text:t('pickup.settings'), onPress:() => Linking.openSettings().catch(() => {}) },
          ]);
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) throw new Error(t('pickup.locationServicesOff'));
      let pos; let cached=false;
      try {
        pos=await withTimeout(Location.getCurrentPositionAsync({ accuracy:Location.Accuracy.High }),
          12000, t('pickup.gpsTimeout'));
      } catch (_) {
        pos=await withTimeout(Location.getLastKnownPositionAsync({ maxAge:60000, requiredAccuracy:100 }),
          2000, t('pickup.noRecentLocation')); cached=true;
      }
      if (run!==serial.current) return;
      if (!isCoordinate(pos?.coords)) throw new Error(t('pickup.gpsUnavailable'));
      const p={ latitude:pos.coords.latitude, longitude:pos.coords.longitude,
        accuracy:pos.coords.accuracy, source:cached?'cached-gps':'gps',
        label:cached?t('pickup.recentDeviceLocation'):t('pickup.deviceLocation') };
      if (!inServiceArea(p,market)) {
        const other=Object.values(MARKETS).find(m => inServiceArea(p,m));
        setStatus(t('pickup.outsideServiceArea',{city:market.city}));
        if (other) Alert.alert(t('pickup.anotherCityTitle'),
          t('pickup.anotherCityBody',{city:other.city}), [
            { text:t('pickup.keepThisCity'), style:'cancel' },
            { text:t('pickup.useCity',{city:other.city}), onPress:() => { if (run===serial.current) onOtherMarket(other.id,p); } },
          ]);
        return;
      }
      setPickup(p);
      const accuracy = Number.isFinite(p.accuracy) ? t('pickup.accuracySuffix',{m:Math.round(p.accuracy)}) : '';
      setStatus(t('pickup.locationCaptured',{source:cached?t('pickup.recentGpsFix'):t('pickup.deviceLocationCaptured'),accuracy}));
    } catch (error) {
      if (run===serial.current) setStatus(error.message || t('pickup.couldNotGetLocation'));
    } finally { if (run===serial.current) setBusy(false); }
  }
  async function resolveAddress() {
    const run=++serial.current; setBusy(true);
    try {
      const permission=await Location.requestForegroundPermissionsAsync();
      if (permission.status!=='granted') throw new Error(t('pickup.addressPermissionNeeded'));
      const rows=await withTimeout(Location.reverseGeocodeAsync({latitude:pickup.latitude,longitude:pickup.longitude}),8000,t('pickup.addressLookupTimeout'));
      if (run!==serial.current) return;
      const address=rows?.[0];
      const label=address && [address.name || address.street, address.district || address.city].filter(Boolean).join(', ');
      if (!label) throw new Error(t('pickup.noStreetAddress'));
      setPickup(p => ({...p,label}));
      setStatus(t('pickup.deviceAddressLookup'));
    } catch (e) { if (run===serial.current) setStatus(e.message); }
    finally { if (run===serial.current) setBusy(false); }
  }
  return { pickup, status, busy, locate, choose, reset, cancel, resolveAddress };
}
