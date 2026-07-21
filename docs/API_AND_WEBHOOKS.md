# API and webhooks

All JSON inputs cross a Zod boundary. Protected handlers call a centralized server authorization guard before querying data. API responses use explicit DTOs for public, guest, host, and internal audiences.

## Public endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Configuration-safe health status |
| GET | `/api/search` | Published property search |
| POST | `/api/pricing/quote` | Server-side price quote |
| POST | `/api/group-enquiries` | Validated group enquiry intake |

## Clerk webhook

`POST /api/webhooks/clerk` uses Clerk's official verification helper. The raw body is size-limited and hashed. `webhook-id` is required and uniquely stored with provider `CLERK` before any projection changes.

Handled event families are user, organization, and organization-membership created/updated/deleted. User events synchronize email-verification and MFA state. Membership events are accepted only for recognized roles; internal roles also require the exact configured internal organization. Duplicate events return success without repeating writes.

## Payment webhooks

`POST /api/webhooks/daraja` and `/api/webhooks/pesapal` accept only stable provider event IDs. Production adapters must verify provider signatures before inserting immutable `payment_events`. A browser redirect never changes payment or booking status.

After signature and amount verification, the database `confirm_paid_booking` function locks the booking, payment, inventory hold, and daily stock; rechecks availability; converts held inventory; confirms the booking; and writes an outbox notification in one transaction.

## Private files

`GET /api/files/access/[token]` requires an active Clerk session and a one-time, short-lived, audience-bound token. It streams bytes from Replit App Storage with `private, no-store` caching. Upload services validate MIME, size, ownership scope, randomized keys, and checksums.

Error responses avoid exposing whether another tenant's resource exists. Provider bodies, credentials, private document paths, and internal fields are never logged or returned to public clients.
