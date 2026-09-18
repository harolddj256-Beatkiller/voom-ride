# VOOM backend

Real accounts, trips, payments and receipts for the VOOM app. Node/Express API on
Prisma + Postgres, deployable to Vercel as serverless functions or run anywhere
Node runs.

## What this replaces

The old client-only prototype simulated everything locally (fake driver matching
timers, session-only trip history, no real payment). This backend makes rides,
drivers, payments and receipts real and persistent:

- **Accounts** — email/password and phone OTP sign-up/sign-in, JWT sessions.
- **Trips** — riders request a real trip; drivers see and accept nearby requests;
  status moves through `REQUESTED → ACCEPTED → IN_PROGRESS → COMPLETED`/`CANCELLED`.
  Fare is computed and stored server-side, not trusted from the client.
- **Payments** — [Chapa](https://chapa.co) hosted checkout for card/Telebirr/mobile
  money, or cash. A webhook (re-verified against Chapa's API, never trusted as-is)
  marks a payment paid.
- **Receipts** — created automatically once a trip is paid (cash on completion,
  Chapa on confirmed payment).

## Setup

1. **Database**: provision a Postgres database (Vercel Postgres, Neon, Supabase, or
   any Postgres host) and copy its connection string.
2. **Chapa**: create a merchant account at https://dashboard.chapa.co and copy your
   secret key.
3. **SMS (optional)**: create a Twilio account for real OTP delivery. Without it,
   OTP codes are only logged to the server console outside production — fine for
   development, not for real users.
4. Copy `.env.example` to `.env` and fill in the values.
5. Install and run:

   ```bash
   npm install
   npm run prisma:migrate:dev   # creates the schema in your database
   npm run dev                  # starts the API on :4000
   ```

## Deploying

This repo is set up for Vercel: `api/index.js` exports the Express app, and
`vercel.json` routes all paths to it. From the Vercel dashboard, create a project
with **Root Directory** set to `backend/`, then set the environment variables from
`.env.example` (`DATABASE_URL`, `JWT_SECRET`, `CHAPA_SECRET_KEY`, and optionally
`PUBLIC_BASE_URL`, `TWILIO_*`). After the first deploy, run
`npm run prisma:migrate` against the production `DATABASE_URL` (or run it
from CI) to create the schema.

Point the mobile app at the deployed URL by setting `EXPO_PUBLIC_VOOM_API_URL` in
the app's environment before running/building it.

## What's still missing

This covers accounts, trips, payments and receipts end to end, but a few things a
fully mature ride-hailing platform would have are intentionally out of scope here:
live driver GPS streaming, in-app chat/calling, push notifications, driver
KYC/document review, surge pricing, and an admin/support dashboard.
