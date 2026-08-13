# StanBrough Sparkle

React + Vite starter for an auto detailing business website.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Start the backend stub:

```bash
npm run server
```

Start both together:

```bash
npm run dev:all
```

## Email setup

Copy `.env.example` to `.env`, then set `RESEND_API_KEY`, `SENDER_EMAIL`, and
`BUSINESS_EMAIL`. The sender must belong to a domain verified in Resend. Never
commit the `.env` file or an API key.

## Booking database

Bookings and blocked times are stored in SQLite at `server/bookings.sqlite`.
Existing JSON records are imported automatically once. Set `DATABASE_PATH` to
a persistent disk location in production. A unique database constraint ensures
that only one customer can reserve each date and time.

## Production deployment

Build and run the combined frontend/API server with:

```bash
npm ci --include=dev
npm run build
npm start
```

Use Node 22.5 or newer and configure these environment variables in the hosting
provider (never in Git):

- `NODE_ENV=production`
- `ADMIN_PASSWORD` — a long, unique password
- `RESEND_API_KEY`
- `SENDER_EMAIL` — must use a domain verified by Resend
- `BUSINESS_EMAIL`
- `ALLOWED_ORIGINS` — comma-separated HTTPS site origins
- `BUSINESS_TIME_ZONE` — defaults to `America/Chicago`
- `DATABASE_PATH` — location on a persistent, backed-up disk

The app must be served over HTTPS. Back up the SQLite database and its WAL file
using provider disk snapshots or a SQLite-aware backup job. Do not deploy this
SQLite configuration to an ephemeral or multi-instance serverless platform;
use PostgreSQL there instead.

Before launch, verify the Resend domain's SPF, DKIM, and DMARC records and test
mail delivery to Gmail, Outlook, and Apple Mail.

## Project structure

- `src/` - React app source
- `public/` - static assets
- `server/` - backend stub for service requests
