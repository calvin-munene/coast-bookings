# Coast Bookings security and platform refactor plan

1. **Baseline audit and preservation map**
   - Record current routes, models, capabilities, exposure and reusable modules.
   - Preserve the functioning public marketplace and domain calculations.

2. **Replit-only infrastructure**
   - Make Replit PostgreSQL through `DATABASE_URL` the single structured-data store.
   - Replace the legacy storage integration with Replit App Storage.
   - Remove legacy packages, scripts, environment variables and provider branches.
   - Keep separate Replit development and production databases/secrets.

3. **Application identity schema**
   - Add application users with unique indexed `clerk_user_id`.
   - Add guest, host and staff profiles; host organizations and memberships.
   - Normalize roles, permissions, role-permission links and scoped assignments.
   - Add account/membership state, expiry and internal-organization controls.

4. **Clerk integration**
   - Install the current Clerk Next.js SDK and add `ClerkProvider`.
   - Replace legacy auth with Clerk sign-in/sign-up routes and a Coast Bookings auth layout.
   - Add `proxy.ts` request protection with an explicit public allowlist.
   - Add verified, idempotent Clerk user/organization/membership webhooks.

5. **Central authorization service**
   - Resolve Clerk identity, application status and organization context server-side.
   - Add typed deny-by-default guest, host, internal and resource guards.
   - Add typed permissions and safe authorization errors.
   - Require recent Clerk reverification for sensitive actions.

6. **Role-isolated application surfaces**
   - Replace the public portal catch-all with protected guest and host route groups.
   - Build a server-only internal operations route group for staff/admin.
   - Add secure post-login role resolution and workspace switching.
   - Enforce domain/path isolation for marketplace, account and operations hosts.

7. **Tenant-scoped repositories and DTOs**
   - Add `host_organization_id` and `guest_user_id` ownership columns/indexes.
   - Require scope in every host/guest repository method.
   - Create explicit public, guest, host and internal DTO mappers.
   - Prevent internal columns from being selected in public/host queries.

8. **Company operations platform**
   - Implement protected CRM, group enquiry, sourcing, quotation, booking, finance, support, dispute, task, document, reporting and audit surfaces.
   - Gate approvals/settings with explicit permissions and reverification.

9. **Storage, webhook and security hardening**
   - Add private Replit App Storage services with file validation and authorization.
   - Add signed/controlled download routes rather than public private-file URLs.
   - Add rate limiting, structured security logs, safe errors and idempotency.
   - Retain immutable financial/audit records and database booking invariants.

10. **Verification and production handoff**
    - Add unit, integration and Playwright authorization/tenancy tests.
    - Verify protected routes, role redirects, MFA/reverification and webhooks.
    - Inspect client output for secrets and internal field names.
    - Document Clerk Dashboard, Replit Database/App Storage and deployment setup.
    - Produce a final implementation report with limitations and manual steps.
