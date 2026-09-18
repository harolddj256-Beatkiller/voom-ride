'use strict';
// Client for the real VOOM backend (see /backend). Set
// EXPO_PUBLIC_VOOM_API_URL (e.g. in a .env file read by Expo) before
// shipping — without it, no backend calls can succeed and the app shows a
// clear setup error instead of silently pretending to work.
// Harold's live backend is built in, so nobody has to type it. A .env value still wins.
export const DEFAULT_API_URL = 'https://voom-backend-kappa.vercel.app';
export const API_BASE_URL = (process.env.EXPO_PUBLIC_VOOM_API_URL || DEFAULT_API_URL).trim().replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let authToken = null;
export function setAuthToken(token) { authToken = token; }

async function request(path, { method = 'GET', body, signal } = {}) {
  if (!API_BASE_URL) {
    throw new ApiError(0, 'Beklo backend URL is not configured. Set EXPO_PUBLIC_VOOM_API_URL.');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    throw new ApiError(0, 'Could not reach the Beklo server. Check your connection and try again.');
  }
  let data = null;
  try { data = await response.json(); } catch { /* empty body */ }
  if (!response.ok) throw new ApiError(response.status, data?.error || 'Something went wrong. Please try again.');
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  sendOtp: (phone) => request('/auth/otp/send', { method: 'POST', body: { phone } }),
  verifyOtp: (body) => request('/auth/otp/verify', { method: 'POST', body }),
  me: () => request('/auth/me'),

  createTrip: (body) => request('/trips', { method: 'POST', body }),
  listTrips: () => request('/trips'),
  availableTrips: (market) => request(`/trips/available?market=${encodeURIComponent(market)}`),
  getTrip: (id) => request(`/trips/${id}`),
  acceptTrip: (id) => request(`/trips/${id}/accept`, { method: 'POST' }),
  startTrip: (id) => request(`/trips/${id}/start`, { method: 'POST' }),
  completeTrip: (id) => request(`/trips/${id}/complete`, { method: 'POST' }),
  cancelTrip: (id) => request(`/trips/${id}/cancel`, { method: 'POST' }),

  initializeChapaPayment: (tripId) => request('/payments/chapa/initialize', { method: 'POST', body: { tripId } }),
  chapaPaymentStatus: (txRef) => request(`/payments/chapa/${encodeURIComponent(txRef)}/status`),

  listReceipts: () => request('/receipts'),
  getReceipt: (id) => request(`/receipts/${id}`),
};
