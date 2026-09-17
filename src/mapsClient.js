import { Platform } from 'react-native';

// Only public configuration belongs here. Never add GOOGLE_MAPS_SERVER_KEY.
export const USE_GOOGLE_MAPS = process.env.EXPO_PUBLIC_USE_GOOGLE_MAPS === 'true';
const base = (process.env.EXPO_PUBLIC_MAPS_PROXY_URL || '').trim().replace(/\/+$/, '');
const devToken = process.env.EXPO_PUBLIC_MAPS_DEV_TOKEN || '';
// Do not draw Google Places / Routes data on an Apple basemap.
export const GOOGLE_DATA_ALLOWED = Platform.OS === 'android' || USE_GOOGLE_MAPS;
export const MAPS_CONNECTED = !!base && !!devToken && GOOGLE_DATA_ALLOWED;
export const MAPS_SETUP_NOTE = base && !GOOGLE_DATA_ALLOWED
  ? 'Google services require a Google Maps-enabled iOS build. Using device search for now.'
  : 'Google Places and in-app road routing are not connected yet.';

export function newSessionToken() {
  // Billing correlation only, NOT authentication or cryptography.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random()*16); return (c==='x'?r:(r&3)|8).toString(16);
  });
}
export async function mapsRequest(path, body, signal) {
  if (!MAPS_CONNECTED) throw new Error(MAPS_SETUP_NOTE);
  if (!/^https:\/\//i.test(base) && !(__DEV__ && /^http:\/\//i.test(base)))
    throw new Error('Use HTTPS for the maps service outside local development.');
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort',abort);
  const timer = setTimeout(() => { timedOut=true; controller.abort(); }, 12000);
  try {
    const response = await fetch(`${base}${path}`, {
      method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${devToken}` },
      body:JSON.stringify(body), signal:controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Maps service error (${response.status})`);
    return data;
  } catch (error) {
    if (timedOut) throw new Error('Maps service timed out. Retry when your connection is stable.');
    throw error;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort',abort);
  }
}
