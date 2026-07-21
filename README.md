# Coast Bookings

A TypeScript accommodation marketplace, host-management platform, booking engine and group-reservation CRM for Kenya's coast.

The repository ships a polished public marketplace, guest/host/staff/admin portal shells, strict domain services, a 50-table PostgreSQL schema, transactional inventory controls, immutable finance/audit records, Supabase RLS, sandbox payment adapters and automated tests.

## Run locally

Requirements: Node.js 22+, npm and a Supabase project for persistent flows.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The public pages and portal demos work without credentials. Database-backed operations require the variables documented in `.env.example`.

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

Migrations contain row-level security, immutable ledger/audit triggers, idempotency constraints and the `confirm_paid_booking` PostgreSQL function that locks and reconfirms inventory before changing a booking to `CONFIRMED`.

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
