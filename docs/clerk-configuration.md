# Clerk configuration

1. Create separate Clerk development and production instances.
2. Enable email verification and the required social providers.
3. Enable Organizations and configure the role keys in `roles-and-permissions.md`.
4. Disable unrestricted organization creation in Clerk. Host organizations are created by the server onboarding action.
5. Create one private Coast Bookings internal organization and save its ID as `CLERK_INTERNAL_ORGANIZATION_ID` in Replit Secrets.
6. Invite staff only through an approved administrative process. Never share a public join link for the internal organization.
7. Require MFA for internal users in Clerk and keep the application-side MFA check enabled.
8. Add the Replit application domains to Clerk's allowed origins and redirect URLs.
9. Create a webhook endpoint at `https://YOUR-REPLIT-DOMAIN/api/webhooks/clerk` for user, organization, and organization-membership created/updated/deleted events.
10. Store the webhook signing secret as `CLERK_WEBHOOK_SIGNING_SECRET`.

Required Replit Secrets are `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, and `CLERK_INTERNAL_ORGANIZATION_ID`.

The publishable key is intentionally browser-visible. The secret key and webhook secret must never use a `NEXT_PUBLIC_` prefix.
