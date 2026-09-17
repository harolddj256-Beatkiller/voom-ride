'use strict';
// Pluggable SMS provider. Configure Twilio via env vars to send real OTP
// messages. Without credentials, in non-production environments the code is
// logged to the server console instead of being sent, so local development
// and testing work without a paid account.
const { HttpError } = require('../errors');

function twilioConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

async function sendViaTwilio(phone, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ To: phone, From: from, Body: body });
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new HttpError(502, `SMS provider rejected the message. ${detail}`.trim());
  }
}

async function sendSms(phone, body) {
  if (twilioConfigured()) {
    await sendViaTwilio(phone, body);
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new HttpError(503, 'SMS provider is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER.');
  }
  // Development fallback: no real SMS account configured.
  console.log(`[dev-sms] to ${phone}: ${body}`);
}

module.exports = { sendSms, twilioConfigured };
