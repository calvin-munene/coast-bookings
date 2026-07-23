---
name: Supabase-to-Replit migration
description: How auth, DB, and RLS were migrated from Supabase to Replit-native stack.
---

# Supabase → Replit migration

## Auth
Supabase auth (@supabase/ssr) replaced with iron-session (cookie-based, httpOnly).
- Session managed in `src/lib/session.ts` using SESSION_SECRET env var.
- Login/register/logout via API routes: `src/app/api/auth/login|register|logout/route.ts`.
- Passwords hashed with bcryptjs (12 rounds), stored in `profiles.password_hash`.
- `src/proxy.ts` simplified to a passthrough (no more Supabase session refresh).

**Why:** User wanted everything managed on Replit, no external auth service.

## Database connection
`src/db/client.ts` and `scripts/migrate.ts` both check if DATABASE_URL starts with `postgresql://` before using it. If not (e.g. a Supabase HTTPS URL), they fall back to PG* env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE) which Replit manages.

**Why:** The user had a Replit Secret named DATABASE_URL set to the Supabase REST API URL (https://...), which conflicted with Replit's runtime-managed DATABASE_URL. The fallback lets the app work correctly without requiring the user to delete the secret.

**How to apply:** Any script that reads DATABASE_URL should validate it starts with `postgresql://` before using it as a Postgres connection string.

## RLS
`drizzle/0001_invariants_rls.sql` rewritten: removed all Supabase auth.uid() RLS policies, auth.users FK on profiles, handle_new_auth_user trigger, has_role()/is_staff() helper functions. Kept: prevent_mutation() trigger (financial record immutability), confirm_paid_booking() function (transactional inventory lock).

**Why:** RLS policies used Supabase-specific auth.uid() which doesn't work with standard PostgreSQL. Authorization is now handled in the application layer via the permissions service.

## Schema change
Added `password_hash text` column to profiles table (in migration 0001, via `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash text`). Also added to `src/db/schema.ts`.

## ESM fix for seed/migrate scripts
Added `{ "type": "module" }` package.json files in `scripts/` and `src/db/` directories to force tsx to treat those .ts files as ESM (required for top-level await).
