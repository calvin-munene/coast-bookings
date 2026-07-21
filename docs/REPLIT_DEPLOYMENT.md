# Replit Autoscale deployment

## 1. Import

1. In Replit, create a Repl by importing the private GitHub repository `calvin-munene/coast-bookings`.
2. Confirm Node.js 22 is selected and allow Replit to use the committed `.replit` workflow.
3. Run the project once. Public pages work in demo mode before persistence is connected.

## 2. Recommended database: Replit PostgreSQL

Add Replit's PostgreSQL database integration to the Repl. Replit injects `DATABASE_URL`; do not copy the URL into source control.

Set these Replit Secrets:

```text
DATABASE_PROVIDER=replit
DATABASE_SSL=auto
```

Then run:

```bash
npm run db:migrate
npm run db:seed
```

Core migrations are provider-neutral and include all booking, inventory, payment and audit invariants. Replit PostgreSQL is accessed only from server code; browser clients never receive its connection string.

## 3. Optional Supabase Auth and Storage

Supabase Auth and Storage can be used while the main records remain in Replit PostgreSQL. Add:

```text
AUTH_PROVIDER=supabase
STORAGE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Run `supabase/storage-policies.sql` in Supabase for the public/private buckets. Do **not** run `supabase/rls-policies.sql` in this hybrid mode because the marketplace tables live in Replit, not Supabase. After login, the app verifies the Supabase session and synchronises the user profile into Replit PostgreSQL through a server-only endpoint.

## 4. Alternative database: Supabase PostgreSQL

To keep the marketplace database in Supabase instead, set:

```text
DATABASE_PROVIDER=supabase
SUPABASE_DATABASE_URL=postgresql://...transaction-pooler...
DATABASE_SSL=require
```

Run `npm run db:migrate`, `npm run db:seed`, then run both `supabase/rls-policies.sql` and `supabase/storage-policies.sql` in the same Supabase project. Do not also point `DATABASE_URL` at Replit and expect data to be copied automatically; changing providers selects one system of record.

## 5. Deploy

Choose **Autoscale** with:

- Build: `npm ci && npm run build`
- Run: `npm run db:migrate && npm run start -- -p $PORT`
- Health check: `/api/health`

The health response reports the selected database and authentication providers without exposing credentials. Keep `ALLOW_INDEXING=false` during sandbox testing.

## 6. Custom domain and production

After acceptance testing, create new production credentials for the chosen database and integrations. Add `app.coastbookings.org`, update `NEXT_PUBLIC_APP_URL`, Supabase Auth redirects, Daraja callback and Pesapal IPN registrations, and DNS. The existing `coastbookings.org` marketing site can remain quote-first and link booking traffic to the app subdomain.

Do not copy sandbox users, callbacks or private documents into production without a reviewed migration and retention plan.
