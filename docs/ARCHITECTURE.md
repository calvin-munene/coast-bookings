# Architecture

Coast Bookings is a modular monolith built with Next.js App Router, strict TypeScript, PostgreSQL, Drizzle ORM and Zod. Replit PostgreSQL is the default database; Supabase PostgreSQL is an optional drop-in provider. React components render interfaces; domain modules own pricing, inventory, booking, permission and payment decisions.

## Runtime boundaries

```text
Browser / mobile client
  -> Next.js pages and route handlers
    -> Zod validation and server permission checks
      -> domain services
        -> Drizzle repositories / provider adapters / outbox
          -> Replit PostgreSQL (default) or Supabase PostgreSQL
          -> optional Supabase Auth and private/public Storage
```

Public marketplace, guest, host, staff and administrator routes are deployed together. The database is the concurrency boundary. Notifications and integration work are inserted into `outbox_events` in the same transaction as business state and consumed asynchronously.

## Provider model

Database, authentication and file storage are independent choices:

| Deployment | Database | Authentication | Files |
| --- | --- | --- | --- |
| Recommended Replit | Replit PostgreSQL via injected `DATABASE_URL` | Supabase Auth | Supabase Storage |
| Supabase alternative | Supabase PostgreSQL transaction pooler | Supabase Auth | Supabase Storage |
| UI/demo | None | Disabled | Disabled |

`DATABASE_PROVIDER=replit` is the default. Set it to `supabase` and provide `SUPABASE_DATABASE_URL` to move the same Drizzle schema and domain services to Supabase PostgreSQL. When Supabase Auth is paired with Replit PostgreSQL, `/api/auth/profile-sync` verifies the Supabase session server-side and mirrors only the required identity fields into Replit PostgreSQL.

## Booking invariant

1. Search displays calculated availability.
2. Checkout creates an expiring inventory hold; instant holds last 15 minutes.
3. Request-to-book holds allow 12 hours for the host and 2 hours for guest payment after acceptance.
4. Provider callbacks are signature-checked and inserted under a unique provider event ID.
5. `confirm_paid_booking` locks the booking, payment, hold and each inventory day.
6. PostgreSQL rechecks capacity and converts `held` to `sold` atomically.
7. The booking becomes confirmed and a notification outbox event is recorded.

Shared inventory pools allow room types that consume the same underlying stock. The check constraint `held + sold <= capacity` is the last database-level defence against overselling.

## Financial model

All money is integer minor units and the first release uses KES only. `pricing_snapshots` and `booking_price_items` freeze guest totals, tax, commission and host earnings. The ledger is double-entry and immutable; corrections use reversing journals. Payouts remain manual, require approval and become eligible 24 hours after check-in unless held by a dispute.

## Extensions

- Payment providers implement the shared provider interface. Daraja, Pesapal and manual adapters are present.
- Notification adapters target Resend, Meta WhatsApp and Africa's Talking through the outbox.
- `ical_connections` supports import/export now and leaves a boundary for channel-manager adapters.
- Route handlers return mobile-friendly JSON so first-party apps can reuse business services later.
