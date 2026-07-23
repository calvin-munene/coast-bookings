# Security hardening

- Clerk sessions are checked in the proxy and again in server authorization guards.
- Staff need the configured private organization, a current membership, an allowed typed permission, and MFA.
- Privileged mutations require recent Clerk reverification.
- Zod validates onboarding, webhook projections, provider names, and all existing public API inputs.
- Webhooks require cryptographic verification and stable idempotency IDs.
- Ledger, payment-event, and audit records are immutable through database triggers.
- Inventory confirmation locks and rechecks stock in PostgreSQL before confirmation.
- Public, host, guest, and internal DTOs are separate allowlists.
- File uploads enforce scope, MIME allowlists, size limits, randomized keys, and SHA-256 checksums.
- Private files use authenticated, one-time, short-lived access tokens; raw App Storage keys are never public.
- Security headers disable framing, sniffing, unnecessary device APIs, and restrict script/connect origins.
- Secrets remain in Replit Secrets and never receive a `NEXT_PUBLIC_` prefix unless designed for browser use.

Before production, run dependency review, configure Sentry redaction, verify Clerk session lifetimes, rotate sandbox credentials, rehearse database restore, and commission a focused penetration test of identity, tenancy, payments, and private files.
