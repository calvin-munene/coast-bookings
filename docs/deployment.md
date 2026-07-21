# Replit deployment

Coast Bookings uses Replit for application runtime, PostgreSQL, App Storage, secrets, workflows, and publishing.

1. Import the GitHub repository into a Replit App.
2. Add PostgreSQL; Replit injects `DATABASE_URL`.
3. Create App Storage buckets for public property images, private documents, and support attachments. Save their bucket IDs in the matching Replit Secrets.
4. Add all required Clerk and application secrets from `.env.example`.
5. Run `npm ci`, `npm run db:migrate`, and `npm run db:seed`.
6. Run `npm run check` and the Playwright suite against a test Clerk instance.
7. Publish using the included `.replit` Autoscale command. It migrates before starting Next.js on the injected port.
8. Set `NEXT_PUBLIC_APP_URL` to the published HTTPS URL. Optional account and operations URLs may point to separate custom domains; route-surface policy will reject paths on the wrong domain.
9. Update Clerk allowed origins, redirects, and webhook URL. Update payment callback URLs separately.
10. Verify `/api/health`, then execute the smoke checklist in `testing.md`.

Replit development and production databases are separate. Apply migrations and seed reference roles to each environment deliberately. Never copy test identities, payment callbacks, or document buckets into production.
