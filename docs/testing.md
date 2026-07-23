# Testing

The automated suite includes pricing, money, inventory, booking-state, refund, payout, iCal, payment-webhook, notification content, group enquiries, database configuration, DTO, route-policy, and authorization tests.

The authorization suite directly covers all 18 required cases: unauthenticated routes, cross-role denial, cross-tenant property/booking denial, guest ownership, least privilege, DTO leakage, parameter tampering, suspended accounts, expired memberships, webhook identity, reverification, registration escalation, and internal navigation exclusion.

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright runs the public marketplace, premium auth routes, group enquiry form, PWA manifest, unsigned Whop webhook rejection, and unauthenticated redirects for checkout and every protected workspace in desktop and mobile Chromium projects.

Set `E2E_PROPERTY_SLUG` to a published property slug when the test process has access to a seeded Replit staging database. Without it, only that seeded-property assertion is skipped; the remaining browser tests still run. Authenticated data-changing E2E tests require a dedicated Clerk test instance and seeded guest, host, staff, finance, and super-admin users. Never run them against production identities.

Manual release checks must include active organization switching, MFA enforcement, expired membership denial, host and guest URL tampering, duplicate Clerk and payment webhooks, private file expiry, and browser-bundle searches for server secrets/internal field names.
