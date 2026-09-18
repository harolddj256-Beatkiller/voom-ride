# Beklo v2.1 (formerly VOOM)

Beklo is a ride-hailing app for Ethiopia (Addis Ababa) and Uganda (Kampala), built
with Expo/React Native and a real backend (see `backend/`).

## What's real

- **Accounts** — sign up/sign in with email+password or phone OTP, as a rider or
  a driver.
- **Rides** — riders request a ride; driver accounts see and accept nearby
  requests and take them through pickup, in-progress and completion. Trip state
  lives on the backend, not just on one device.
- **Fares** — computed and stored server-side when a ride is requested, not
  trusted from the client.
- **Payments** — pay by cash, or online via [Chapa](https://chapa.co) (Telebirr,
  card, bank, mobile money) through a hosted checkout.
- **Receipts** — generated automatically once a trip is paid, viewable in the app.

## Running it

1. Deploy the backend (`backend/`, see `backend/README.md`) and note its URL.
2. Copy `.env.example` to `.env` here and set `EXPO_PUBLIC_VOOM_API_URL` to that
   URL.
3. `npm install`, then `npx expo start --go --tunnel` and scan the QR code in
   Expo Go. Or use the `.command` launchers — see `START-HERE.txt`.

Google Places search and road-accurate routing are optional; without them the app
falls back to a suggested-place list and straight-line distance estimates. See
`MAPS-SETUP.md`.

## What's not built yet

Live driver GPS streaming, in-app chat/calling, push notifications, driver
KYC/document review, surge pricing, fraud/abuse controls, emergency escalation,
and an admin/support dashboard are not implemented.
