# Coast Bookings current-system audit

Audit date: 21 July 2026

## Executive assessment

The repository is a polished marketplace prototype with useful domain primitives and a broad PostgreSQL schema, but it is not yet a secure multi-role production platform. Public accommodation discovery can be preserved. Identity, tenant isolation, protected portals, internal operations, resource-level authorization, Clerk synchronization and private-file controls require replacement or completion.

## Technology inventory

| Area | Current implementation | Assessment |
| --- | --- | --- |
| Next.js | 16.2.10, App Router and `proxy.ts` | Current structure supports route groups, server components and request protection |
| React | 19.2.4 | Suitable |
| TypeScript | Strict mode | Suitable |
| Styling | Tailwind CSS 4 plus repository CSS | Marketplace styling can be preserved |
| Authentication | Legacy browser/server clients | Incomplete; protected resources do not require a session |
| Database | PostgreSQL through Drizzle ORM and `postgres` | Suitable; Replit PostgreSQL will be the only database |
| Storage | Legacy cloud storage documented but no complete application service | Replace with Replit App Storage |
| Validation | Zod on selected public endpoints | Expand to every mutation and webhook boundary |
| Testing | Vitest and Playwright | Useful foundation; authorization coverage is missing |

## Current routes

### Public marketplace

- `/`
- `/search`
- `/stays/[propertySlug]`
- `/destinations/[destinationSlug]`
- `/group-accommodation`
- `/request-quote`
- `/become-a-host`
- `/help`
- `/privacy`
- `/terms`
- `/checkout`

### Authentication

- `/login`
- `/register`

These routes use legacy custom forms and expose an account-type selector at public registration.

### Portal routes

- `/[portal]/[section]`, where `portal` may be `guest`, `host`, `staff` or `admin`

This single dynamic route renders all four dashboard families using static demo records. It performs no authentication, tenant or resource authorization.

### APIs

- `/api/health`
- `/api/search`
- `/api/pricing/quote`
- `/api/group-enquiries`
- `/api/auth/profile-sync`
- `/api/webhooks/[provider]`

The payment webhook endpoint validates basic shape and hashes the body, but does not yet complete signed-provider verification and durable idempotent processing.

## Current user and authorization model

The schema contains `profiles`, `roles` and `user_roles`, plus a TypeScript permission map. It does not contain a unique Clerk user identifier, application organizations, organization memberships, normalized role-permission assignments or separate guest/staff profiles. The existing permission helper accepts an authorization context supplied by its caller; it does not resolve trusted Clerk session and database state itself.

The public registration form permits a user to select an account type. Although it does not create staff roles, authorization state must never be derived from browser-selected role input.

## Current property and tenancy model

Properties reference `host_profiles` directly. Co-host scope is represented by `property_staff`. There is no durable `host_organization_id` on every host-owned resource and no active-organization resolver. A URL or request-supplied property identifier is not consistently constrained by a trusted active organization.

Useful models that should be retained include properties, units, inventory pools, inventory days, availability holds, daily/rate-plan pricing, property documents and listing approval states.

## Current booking functionality

The repository includes:

- a controlled booking state machine;
- pricing snapshots using integer KES minor units;
- inventory availability checks;
- a PostgreSQL booking-confirmation function with row locks;
- payment, refund, ledger and payout tables;
- group enquiry and quote tables.

The browser experience still uses static demo properties and reservations. End-to-end persistent booking orchestration, resource-scoped reads, staff overrides, manual bookings and group quote conversion remain incomplete.

## Current payment functionality

Daraja, Pesapal and manual provider interfaces exist. Pesapal contains a verification call; Daraja verification/refund handling remains a placeholder. The schema has unique payment/webhook references and immutable event/ledger controls. The current generic webhook route does not yet perform the complete verified transaction, exact-amount reconciliation and booking-confirmation sequence.

## Current dashboards

Guest, host, staff and admin views share one public dynamic page and static records. The visual shell and stat/table components can be reused, but every dashboard route, query, DTO and action must be replaced with role-specific protected implementations.

## Missing company capabilities

- Clerk identity and organization synchronization
- Invitation-only staff lifecycle
- Active host-organization tenancy
- Central server-only authorization service
- Guest/host/internal response DTO separation
- Internal CRM, sourcing, quotation and manual-booking workflows
- Staff tasks, incident and dispute workflows
- Permission-gated finance approvals and settings
- Recent-session reverification for sensitive operations
- Replit App Storage upload/download services
- Clerk and payment webhook persistence
- Per-resource audit and security-event logging
- Tenant-isolation and route-isolation tests

## Security weaknesses

1. Protected dashboards are publicly addressable.
2. Proxy logic refreshes legacy identity cookies but does not deny protected routes.
3. Server components and route handlers lack consistent resource-level authorization.
4. Host records are not universally scoped by a trusted active organization.
5. Guest resources are not universally scoped by the authenticated application user.
6. Staff and administrative UI share the public portal component and response model.
7. No mandatory internal MFA or sensitive-action reverification enforcement exists.
8. No invitation-only internal-account enforcement exists in application services.
9. Private-file access is documented but not implemented through a scoped Replit storage service.
10. Rate limiting and security-event logging are not applied consistently.
11. The public registration screen asks for an account role.
12. Public APIs use demo records and do not yet prove internal-field exclusion through DTO tests.

## Data currently exposed to the browser

- Static property, price, availability and review examples intended for the public marketplace.
- Static reservation names, booking references, totals and statuses on every portal route, including `/staff/*` and `/admin/*`.
- All dashboard navigation definitions and demo operational metrics.

No live database secrets are bundled, and current pages do not query sensitive live tables. However, internal route and response boundaries are absent, so the existing pattern is unsafe for real company data.

## Components and modules to preserve

- Marketplace homepage, search, property and destination presentation
- Coast Bookings logo, navy/orange visual identity and generated social asset
- Property card, search bar, header, footer and status components
- Money, pricing, inventory, refund and payout calculations
- Booking state machine and PostgreSQL confirmation invariant
- Drizzle migration workflow, payment abstractions and immutable ledger design
- Replit Autoscale configuration and `DATABASE_URL` connection approach

## Components and modules to replace

- Legacy identity packages, clients, profile-sync route and environment variables
- `/login` and `/register`
- The public `/[portal]/[section]` catch-all dashboard
- Caller-supplied permission contexts
- Legacy database/storage scripts and documentation
- Generic unverified webhook processing
- Static internal reservation/finance views

## Architecture decision

The repository will remain a modular monolith rather than become a package-manager monorepo during this security refactor. Converting build tooling, deployment and imports while simultaneously replacing identity and tenancy would add unnecessary instability.

Separation will be enforced through Next.js route groups and server-only modules:

```text
src/app/(public)
src/app/(auth)
src/app/(guest)
src/app/(host)
src/app/(internal)
src/modules/auth
src/modules/authorization
src/modules/internal
src/modules/storage
src/modules/* domain services
```

The deployment will support `coastbookings.org`, `account.coastbookings.org` and `ops.coastbookings.org` from one Replit application, with host/path enforcement in `proxy.ts`. Internal components, queries and DTOs remain under internal-only server boundaries and are not imported by marketplace routes.
