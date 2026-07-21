# Architecture

Coast Bookings is a modular Next.js App Router monolith written in strict TypeScript. Replit runs the application and supplies PostgreSQL, App Storage, secrets, development workflows, and production publishing. Clerk supplies identity and organization sessions.

```text
Browser
  -> public marketplace or protected workspace
  -> Next.js proxy (public allowlist; authentication everywhere else)
  -> server route, action, or component
  -> centralized authorization guard
  -> Zod trust-boundary validation
  -> domain service
  -> tenant-scoped Drizzle repository
  -> Replit PostgreSQL transaction
  -> outbox/background integration adapter
```

Application modules live under `src/modules`. Business decisions remain outside React. The current route tree separates public, guest, host, staff, and administrator surfaces while a host-aware route policy supports separate public/account/operations domains when configured.

PostgreSQL uses public tables for marketplace records, `internal` tables for finance/risk/staff-only models, and `audit` tables for security events. UUID keys, UTC timestamps, minor-unit money, foreign keys, checks, immutable finance history, and optimistic versions are used throughout.

Clerk membership is necessary but not sufficient authorization. The application also validates synchronized user status, organization approval, membership expiry, MFA, typed role grants, and resource ownership. Replit PostgreSQL remains the system of record for marketplace state and tenant scope.

The monolith can later split operations and marketplace deployments without changing the domain boundaries. Until scale demands it, one application keeps booking transactions and operational maintenance simpler.
