# Replit Autoscale deployment

## 1. Import

1. In Replit, create a Repl by importing the private GitHub repository `calvin-munene/coast-bookings`.
2. Confirm Node.js 22 is selected and allow Replit to use the committed `.replit` workflow.
3. Run the project once. Public pages work in demo mode before Supabase is connected.

## 2. Configure a sandbox

Create a new Supabase sandbox project. Do not reuse future production credentials. Copy every required value from `.env.example` into Replit Secrets; never commit `.env.local`.

Use Supabase's transaction pooler URL for `DATABASE_URL`. Run:

```bash
npm run db:migrate
npm run db:seed
```

Run `supabase/storage-policies.sql` to create the four storage buckets listed in `docs/SECURITY.md`, configure authentication redirect URLs for the Replit domain, and add sandbox Daraja/Pesapal callback URLs.

## 3. Deploy

Choose **Autoscale** with:

- Build: `npm ci && npm run build`
- Run: `npm run db:migrate && npm run start -- -p $PORT`
- Health check: `/api/health`

Keep `ALLOW_INDEXING=false`. Test guest, host, staff and admin flows with synthetic accounts and provider sandbox transactions.

## 4. Custom domain and production

After acceptance testing, create a separate production Supabase project and new provider secrets. Add `app.coastbookings.org` to the Replit deployment, update `NEXT_PUBLIC_APP_URL`, Supabase auth redirects, Daraja callback and Pesapal IPN registrations, and DNS. The existing `coastbookings.org` marketing site can keep its quote-first experience and link online-booking traffic to the app subdomain.

Do not copy sandbox users, payment callbacks or private documents into production. Migrate approved catalogue data through a reviewed export/import process.
