import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from './api';

const STORAGE_KEY = 'voom.session.v1';
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setAuthToken(saved.token);
          setToken(saved.token);
          setUser(saved.user);
        }
      } catch { /* corrupt/missing storage is fine, just start signed out */ }
      setRestoring(false);
    })();
  }, []);

  const persist = useCallback(async (nextToken, nextUser) => {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const register = useCallback(async (body) => {
    const data = await api.register(body);
    await persist(data.token, data.user);
    return data.user;
  }, [persist]);

  const login = useCallback(async (body) => {
    const data = await api.login(body);
    await persist(data.token, data.user);
    return data.user;
  }, [persist]);

  const sendOtp = useCallback((phone) => api.sendOtp(phone), []);

  const verifyOtp = useCallback(async (body) => {
    const data = await api.verifyOtp(body);
    await persist(data.token, data.user);
    return data.user;
  }, [persist]);

  const logout = useCallback(() => persist(null, null), [persist]);

  return (
    <SessionContext.Provider value={{ user, token, restoring, register, login, sendOtp, verifyOtp, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
