# Replit deployment

Coast Bookings uses Replit for the application runtime, PostgreSQL, App Storage, secrets, scheduled jobs and publishing. Supabase is not used by this deployment.

1. Import the GitHub repository into a Replit App.
2. Add Replit PostgreSQL. Replit injects `DATABASE_URL`; do not commit or manually expose it.
3. Create separate App Storage buckets for public property images, private documents and support attachments, then add their bucket IDs as Secrets.
4. Copy the required names from `.env.example` into Replit Secrets. Use real HTTPS values for all published URLs.
5. Configure Clerk, create the internal Coast Bookings organization, register `/api/webhooks/clerk`, and seed the initial administrator email.
6. Configure Whop sandbox and register `/api/webhooks/whop`. Keep `PAYMENT_MODE=sandbox` through the signed-callback and refund acceptance tests.
7. Run `npm ci`, `npm run db:migrate`, `npm run db:seed`, and `npm run check` in the Replit workspace.
8. Publish the Autoscale deployment. `.replit` applies pending migrations before starting Next.js on Replit's injected port.
9. Add a Replit Scheduled Deployment that runs `npm run jobs:run` every five minutes with the same `NEXT_PUBLIC_APP_URL` and `CRON_SHARED_SECRET` secrets.
10. Set `ALLOW_INDEXING=true` only after production content, legal pages, staff accounts and payment acceptance are approved.

Development and production databases, Clerk instances, Storage buckets and Whop environments must remain separate. Never copy test identities, payment callbacks or private documents into production.

## Release verification

Run:

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run check
npm run test:e2e
```

Then verify `/api/health`, one instant booking, one request-to-book, deposit plus balance, a duplicate Whop callback, a failed payment, an approved refund, host acceptance, staff property approval, a group quote conversion and access denial across every wrong-role/cross-tenant combination.
