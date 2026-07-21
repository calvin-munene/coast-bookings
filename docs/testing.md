# Testing

The automated suite includes pricing, money, inventory, booking-state, refund, payout, iCal, payment-webhook, database configuration, DTO, route-policy, and authorization tests.

The authorization suite directly covers all 18 required cases: unauthenticated routes, cross-role denial, cross-tenant property/booking denial, guest ownership, least privilege, DTO leakage, parameter tampering, suspended accounts, expired memberships, webhook identity, reverification, registration escalation, and internal navigation exclusion.

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright checks the public marketplace, premium auth routes, and unauthenticated redirects for checkout and every protected workspace. Authenticated E2E tests require a dedicated Clerk test instance and seeded guest, host, staff, and super-admin users; never run them against production identities.

Manual release checks must include active organization switching, MFA enforcement, expired membership denial, host and guest URL tampering, duplicate Clerk and payment webhooks, private file expiry, and browser-bundle searches for server secrets/internal field names.
