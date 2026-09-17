'use strict';
// Minimal Chapa (https://chapa.co) payment client. Requires a Chapa merchant
// account and CHAPA_SECRET_KEY. See backend/.env.example.
const { HttpError } = require('../errors');

const BASE_URL = 'https://api.chapa.co/v1';

function secretKey() {
  const key = process.env.CHAPA_SECRET_KEY;
  if (!key) throw new HttpError(503, 'Chapa is not configured. Set CHAPA_SECRET_KEY.');
  return key;
}

async function initializeTransaction({ amount, currency, email, firstName, lastName, txRef, callbackUrl, returnUrl, title, description }) {
  const response = await fetch(`${BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: String(amount),
      currency,
      email,
      first_name: firstName,
      last_name: lastName,
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: { title: title?.slice(0, 16), description: description?.slice(0, 60) },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status !== 'success') {
    throw new HttpError(502, data?.message || 'Chapa could not initialize the payment.');
  }
  return { checkoutUrl: data.data.checkout_url };
}

async function verifyTransaction(txRef) {
  const response = await fetch(`${BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, data?.message || 'Chapa verification failed.');
  return data.data; // { status, amount, currency, tx_ref, ... }
}

module.exports = { initializeTransaction, verifyTransaction };
