# v2.0 — Real backend

- Added a real backend (`backend/`): Express + Prisma/Postgres, deployable to Vercel.
- Added real accounts: email/password and phone OTP sign-up/sign-in with JWT sessions,
  for both rider and driver roles.
- Replaced the client-only simulated ride flow (fake matching timers, session-only
  history) with real backend-tracked trips: request, accept, start, complete and
  cancel are now persisted and visible to both the rider and driver accounts involved.
- Fares are computed and stored server-side when a ride is requested, instead of
  being a client-only sample value.
- Added Chapa payment integration (hosted checkout, webhook + server-side
  verification) and cash payment, with automatic receipt generation on payment.
- Added real Activity (trip history) and Wallet (payment methods + receipts) screens
  backed by the API, replacing the in-memory session-only versions.
- Removed all "demo"/"preview"/"simulated" labelling from the UI and renamed the
  underlying preview-area/demo-radius concepts to reflect a real service area.
- Removed the client-side simulated driver-matching timer and rating flow (no
  backend support for ratings yet).

# v1.3 — Expo Go Edition

- Upgraded from Expo SDK 52 to SDK 57 for the current Expo Go app.
- Upgraded React Native to 0.86, React to 19.2 and all Expo/native dependencies.
- Added `OPEN IN EXPO GO.command` for a direct QR-code launch flow.
- Passed Expo Doctor 21/21 checks and exported Android and iOS bundles.

# v1.2.1 — Review Launcher Fix

- Added the missing `expo-asset` runtime dependency that prevented Metro from starting.
- Added a one-click `REVIEW VOOM.command` that opens VOOM in a Mac browser.
- Added a browser-safe review map while preserving the native iOS/Android map.
- Added locked dependency metadata for repeatable installs.
- Verified 37/37 tests plus successful Android and web production bundles.

# v1.2 — Pickup & Maps Update

This is an incremental update of v1.1, not a new transport network.

- Connected on-demand device coordinates to actual pickup state.
- Added accurate permission/timeout/recent-fix labels and manual fallback.
- Added tappable/draggable destination and pickup selection.
- Added optional explicit native address lookup and Google Maps external directions.
- Fixed clearing search; added loading, no-result and provider-error states.
- Added preview-city validation and explicit consent before changing city for GPS.
- Removed fake road lines, driver ETAs, live supply/demand and invented trip history.
- Added cancel-safe matching, frozen booking details and session-only receipts.
- Prepared optional Google API adapter, route validation, platform key configuration
  and later setup instructions. Live Google credentials are NOT included.
- Added 37 automated logic/API tests and a phone acceptance checklist.
- Retained Expo SDK 52 to avoid an untested major framework migration; documented
  that a current App Store Expo Go client may not run an SDK 52 project.
- Retained one-click development launch with safer dependency checks and retries.
