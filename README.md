# Coast Bookings

Coast Bookings is a strict-TypeScript accommodation marketplace, host-management platform, booking engine, and group-reservation CRM for Kenya's coast.

The production architecture is deliberately clear:

- Replit runs the Next.js application.
- Replit PostgreSQL is the only application database.
- Replit App Storage stores public images and private documents.
- Replit Secrets holds every server credential.
- Clerk provides identity, sessions, MFA, organizations, invitations, and verified webhooks.
- Whop provides embedded online checkout; verified callbacks, never browser redirects, confirm payment.
- Communication providers and Sentry are connected through server-only or privacy-safe adapters.

## Run

Use Node.js 22 or newer and npm:

```bash
cp .env.example .env.local
npm install
npm run dev
```

The health and authentication shells work before the database is configured. Live marketplace inventory and every protected workspace use Replit PostgreSQL; protected routes deny access and redirect to `/sign-in` rather than exposing demo dashboards.

## Database

Add the PostgreSQL tool to the Replit App. Replit injects `DATABASE_URL` automatically.

```bash
npm run db:migrate
npm run db:seed
```

Migrations include transactional inventory confirmation, immutable ledger/audit controls, Clerk identity tables, organization tenancy, internal database schemas, and storage metadata. Money is stored as integer minor units.

## Validate

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Documentation

- [Authentication](docs/authentication.md)
- [Authorization](docs/authorization.md)
- [Clerk configuration](docs/clerk-configuration.md)
- [Roles and permissions](docs/roles-and-permissions.md)
- [Data isolation](docs/data-isolation.md)
- [Security hardening](docs/security-hardening.md)
- [Replit deployment](docs/deployment.md)
- [Testing](docs/testing.md)
- [Operations portal](docs/operations-portal.md)
- [API and webhooks](docs/API_AND_WEBHOOKS.md)
- [Whop payments](docs/WHOP_PAYMENTS.md)
- [Implementation report](docs/implementation-report.md)

## Payment safety

Payment mode defaults to Whop sandbox. Browser redirects never mark a booking paid. Only a verified, idempotently recorded Whop callback can enter the database confirmation function that locks inventory and completes the booking transaction.
