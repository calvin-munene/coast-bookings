# Authentication

Clerk is the sole identity and session provider. The root layout mounts `ClerkProvider`; Next.js `proxy.ts` applies a small public allowlist and requires authentication everywhere else.

Public authentication routes are `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]`. Account recovery and verification continue through Clerk. There is no role selector on sign-in. Public onboarding permits only a travel account or a host business; staff and administrator access cannot be requested there.

After authentication, `/auth/continue` resolves the application user and active organization on the server:

- no organization membership: guest workspace;
- active host organization: host workspace;
- configured private Coast Bookings organization: operations workspace;
- incomplete profile: onboarding;
- restricted or suspended account: restricted page.

Clerk user, organization, and membership changes are synchronized through the cryptographically verified `/api/webhooks/clerk` endpoint. `webhook-id` is stored under a unique database constraint before processing, so repeated delivery is safe.

Internal staff must belong to the exact organization in `CLERK_INTERNAL_ORGANIZATION_ID` and have MFA enabled. High-risk actions also invoke Clerk session reverification.
