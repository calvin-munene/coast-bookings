# Authorization

Authorization is server-only and deny-by-default. `src/modules/authorization/service.ts` is the entry point for pages, actions, and route handlers.

It exposes the required guards for authenticated users, active accounts, guests, host organizations, host permissions, internal staff, internal permissions, super administrators, and booking/property/ticket/payment resources.

The guard sequence is:

1. Read the trusted Clerk session.
2. Resolve the Clerk user to the application `users` record.
3. Reject restricted, suspended, deleted, or unsynchronized accounts.
4. Resolve the active Clerk organization to a current database membership.
5. Validate organization type, status, expiry, MFA, role, and typed permission.
6. Query resources with the trusted user or organization scope in the SQL predicate.
7. Return a safe not-found response for cross-tenant resources.

Browser-provided user IDs, organization IDs, and roles are never authority. They may identify a requested record, but the server adds its own ownership predicate.

Sensitive actions—role management, payout approval, refund approval, and system settings—must call both `requireInternalPermission()` and `requireRecentReverification()`.
