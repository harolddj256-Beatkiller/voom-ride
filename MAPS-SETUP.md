# Optional Google integration

VOOM works with manual map pins without any Google configuration — this guide is
only for adding Google Places search and road-accurate routing. There are no keys
in this repository. Do not paste server keys into App.js, an EXPO_PUBLIC variable, a
screenshot, or a chat. The service included here is only a local development adapter,
separate from the ride/accounts/payments backend documented in `backend/README.md`.

## 1. Separate provider setup from app activation

Create a Google Cloud project, enable billing where required, then enable:

- Places API (New) for autocomplete and place details.
- Routes API for road distance, duration and polyline geometry.
- Maps SDK for Android and/or Maps SDK for iOS for standalone native basemaps.

Create separate keys for the server and each native platform. Restrict the server
key to its enabled APIs and appropriate server IPs. Restrict Android's SDK key to
the app package and signing certificate, and iOS's SDK key to the bundle ID.
Set conservative quotas and billing alerts. Billing alerts alone do not cap spend.

For this older Expo SDK 52 project, app.config.js uses the native
`android.config.googleMaps.apiKey` and `ios.config.googleMapsApiKey` fields.
When migrating Expo / react-native-maps, re-check that version's config-plugin API;
newer releases use a different plugin configuration. Do not blindly reuse old
native config during an SDK upgrade.

## 2. Local adapter (Mac)

Copy `server/.env.example` to `server/.env`. Fill `GOOGLE_MAPS_SERVER_KEY` locally.
Generate a disposable development token with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Put that value in `VOOM_DEV_TOKEN`. Run:

```bash
node server/index.cjs
```

The default binding is **127.0.0.1:8787**. Do not forward this port to the internet.
For a physical test phone on the same trusted Wi-Fi network, explicitly set
`VOOM_MAPS_HOST=0.0.0.0`, allow only the necessary private-network firewall access,
and use the Mac's actual LAN address in the mobile configuration. A phone's
`localhost` is the phone, NOT your Mac. Only do this on a network you control.

The adapter intentionally refuses to start with `NODE_ENV=production`. Its shared
development token is not user authentication and is visible to anyone holding a
configured mobile bundle. Never deploy it publicly as a paid-API proxy.

## 3. Mobile development configuration

Copy root `.env.example` to `.env` and configure the appropriate local adapter URL:

```dotenv
EXPO_PUBLIC_MAPS_PROXY_URL=http://YOUR_MAC_LAN_IP:8787
EXPO_PUBLIC_MAPS_DEV_TOKEN=YOUR_DISPOSABLE_LOCAL_TOKEN
EXPO_PUBLIC_USE_GOOGLE_MAPS=false
```

The token must match `server/.env`. It is intentionally a disposable **development**
secret, not the Google key. HTTP is allowed by this client only in `__DEV__` mode;
platform transport-security settings may also require a development build or HTTPS.
Do not disable transport security globally to make a public app work.

Android already uses a Google basemap. iOS initially uses Apple Maps, so the Google
Places/Routes data path is gated OFF. To test Google data on iOS, configure the
restricted Maps SDK for iOS key, set `EXPO_PUBLIC_USE_GOOGLE_MAPS=true`, then create
and test a Google-enabled native build. Do not flip the flag on a binary that lacks
Google Maps native support. Separate Android/iOS SDK keys are also needed for
standalone release binaries. Restart Expo after editing environment variables.

## 4. Test before calling it connected

Search an address, choose a result, confirm both map pins, and open ride options.
A successful route response displays road kilometres, estimated duration, and a
road-following polyline. A timeout, absent route, quota error or unsupported mode
instead displays a labelled preview with no road ETA. Use Retry road route to retry.

Boda requests use TWO_WHEELER, never silently substitute a car route. Coverage and
availability depend on the selected city and provider; this has not been verified
with a live account. Current requests are traffic-unaware, so durations must NOT
be described as live traffic or driver-arrival ETAs.

The fare shown here is still an on-device estimate. The backend (see
`backend/README.md`) recomputes and stores the authoritative fare — using its own
server-side distance floor — when a rider actually requests a ride, so a manipulated
client value can't change what's charged. Surge pricing, commissions and taxes are
not implemented yet.

## Production requirements (not included)

Replace the shared token with authenticated user sessions, authorization, per-user
and global spending limits, a proper geofenced service policy, HTTPS, secret
management, monitoring, server-authoritative quotes and privacy/retention rules.
Review Google's current data-display, attribution and caching policies and implement
public app terms/privacy pages. Do not put Google Places/Routes results on an Apple
or unrelated basemap. This is not a production security or compliance certification.

## Primary references consulted

- Expo location: https://docs.expo.dev/versions/latest/sdk/location/
- Expo maps / native setup: https://docs.expo.dev/versions/latest/sdk/map-view/
- Expo version compatibility: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started
- Places autocomplete: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
- Place details: https://developers.google.com/maps/documentation/places/web-service/place-details
- Search sessions: https://developers.google.com/maps/documentation/places/web-service/using-session-tokens
- Routes: https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes

- Places attribution: https://developers.google.com/maps/documentation/places/web-service/policies
