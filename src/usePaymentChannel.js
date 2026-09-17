import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'voom.defaultPaymentChannel.v1';

// Persists the rider's preferred payment channel (e.g. Telebirr, CBE, MTN MoMo)
// across app restarts and market switches, falling back to the market's first
// channel when the saved one doesn't apply to the current market.
export function usePaymentChannel(market) {
  const [channelId, setChannelId] = useState(market.paymentChannels[0].id);

  useEffect(() => {
    let alive = true;
    (async () => {
      let next = market.paymentChannels[0].id;
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && market.paymentChannels.some((c) => c.id === saved)) next = saved;
      } catch { /* default to the market's first channel */ }
      if (alive) setChannelId(next);
    })();
    return () => { alive = false; };
  }, [market.id]);

  const select = useCallback((id) => {
    setChannelId(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  return [channelId, select];
}
