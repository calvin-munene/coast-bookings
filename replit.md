# Coast Bookings on Replit

Coast Bookings is a strict-TypeScript accommodation marketplace, host-management platform, booking engine, and group-reservation CRM. The deployed application uses Replit for the Next.js runtime, PostgreSQL, App Storage, secrets, scheduled jobs, and publishing.

## Run the application

Use the **Start application** workflow or run:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Public shell pages can render without service credentials. Real inventory and every protected role workspace require the Replit PostgreSQL database and Clerk configuration; the application does not substitute demo records for missing production data.

## Configure Replit

1. Add the Replit PostgreSQL and App Storage tools.
2. Add the required values listed in `.env.example` to Replit Secrets. Replit injects `DATABASE_URL` after PostgreSQL is attached.
3. Configure Clerk for identity, organizations, staff MFA, and `/api/webhooks/clerk`.
4. Configure Whop sandbox checkout and the signed `/api/webhooks/whop` callback.
5. Run the database and release commands:

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run check
```

6. Publish the Autoscale deployment. The deployment command applies pending migrations before starting Next.js on Replit's injected port.
7. Configure a Scheduled Deployment to run `npm run jobs:run` every five minutes.

Use sandbox credentials and a separate staging database until signed payment callbacks, refunds, role access, and reconciliation have passed acceptance testing. A browser redirect never marks a booking paid.

See [the main README](README.md), [Replit deployment guide](docs/deployment.md), and [Whop payment guide](docs/WHOP_PAYMENTS.md) for the complete setup.
