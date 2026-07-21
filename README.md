# Coast Bookings

A TypeScript accommodation marketplace, host-management platform, booking engine and group-reservation CRM for Kenya's coast. Replit PostgreSQL is the default database, while Supabase PostgreSQL remains a supported alternative; Supabase Auth and Storage can also be used independently with either database choice.

The repository ships a polished public marketplace, guest/host/staff/admin portal shells, strict domain services, a 50-table PostgreSQL schema, transactional inventory controls, immutable finance/audit records, Supabase RLS, sandbox payment adapters and automated tests.

## Run locally

Requirements: Node.js 22+, npm and either Replit PostgreSQL or Supabase PostgreSQL for persistent flows.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The public pages and portal demos work without credentials. Database-backed operations require the variables documented in `.env.example`. In Replit, add its PostgreSQL integration and leave `DATABASE_PROVIDER=replit`; Replit supplies `DATABASE_URL` automatically.

## Validate

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Database

```bash
npm run db:migrate
npm run db:seed
```

Core migrations run on both Replit PostgreSQL and Supabase PostgreSQL. They contain immutable ledger/audit triggers, idempotency constraints and the `confirm_paid_booking` PostgreSQL function that locks and reconfirms inventory before changing a booking to `CONFIRMED`. Supabase-only RLS and Auth triggers are kept separately in `supabase/rls-policies.sql`.

## Replit deployment

Import this GitHub repository into Replit, choose Autoscale, add the secrets from `.env.example`, and run the included workflow. Full setup and provider callback instructions are in [docs/REPLIT_DEPLOYMENT.md](docs/REPLIT_DEPLOYMENT.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roles and permissions](docs/ROLES_AND_PERMISSIONS.md)
- [API and webhooks](docs/API_AND_WEBHOOKS.md)
- [Security and production readiness](docs/SECURITY.md)
- [Replit deployment](docs/REPLIT_DEPLOYMENT.md)

## Sandbox safety

Indexing is disabled unless `ALLOW_INDEXING=true`. Payment code defaults to mock/sandbox mode. A browser redirect never marks a booking paid; only a verified, idempotently recorded provider callback can enter the database confirmation function. Fee, tax, cancellation, refund and notification templates require operational approval before production launch.
