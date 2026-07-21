# Coast Bookings

A TypeScript accommodation marketplace, host-management platform, booking engine and group-reservation CRM for Kenya's coast. Built with Next.js 16, Supabase, Drizzle ORM, Tailwind CSS and Zod.

## How to run

```bash
npm run dev
```

The workflow `Start application` runs `npm run dev -- --hostname 0.0.0.0 --port 3000` and is the default way to run the app on Replit.

Public pages and portal demos work in demo mode without Supabase. Database-backed flows (auth, bookings, payments) require Supabase credentials in Replit Secrets.

## Environment

All environment variables live in `.env.local`. Placeholder values are committed for non-secret config; replace the `placeholder` values with real credentials when you connect Supabase. See `.env.example` for the full list and `docs/REPLIT_DEPLOYMENT.md` for step-by-step instructions.

**Required secrets for full functionality:**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `DATABASE_URL` — Supabase pooler connection string
- `DIRECT_DATABASE_URL` — Supabase direct connection string
- `APP_ENCRYPTION_KEY` — 32+ character random key for data encryption

**Optional (not needed for demo mode):**
- Daraja / Pesapal payment keys (mock mode active by default)
- Resend / WhatsApp / Africa's Talking notification keys
- Google Maps API key
- Sentry DSN

## Database

After connecting Supabase, run migrations and seed data:

```bash
npm run db:migrate
npm run db:seed
```

## Other commands

```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm test             # Vitest unit tests
npm run build        # Production build
npm run test:e2e     # Playwright end-to-end tests
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roles and permissions](docs/ROLES_AND_PERMISSIONS.md)
- [API and webhooks](docs/API_AND_WEBHOOKS.md)
- [Security and production readiness](docs/SECURITY.md)
- [Replit deployment](docs/REPLIT_DEPLOYMENT.md)

## User preferences

<!-- Agent: record user preferences here -->
