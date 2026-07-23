# API and webhooks

Every request crosses a Zod validation boundary. Protected handlers resolve the Clerk session, the synchronized Replit PostgreSQL user, role permissions, organization membership, and resource ownership before accessing data. Error responses use stable codes and do not disclose another tenant's records.

## Public routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Non-secret runtime readiness |
| GET | `/api/search` | Search verified, published inventory |
| POST | `/api/pricing/quote` | Pure server-side pricing calculation |
| POST | `/api/bookings/quote` | Live unit, inventory, restriction, promotion and total quote |
| POST | `/api/group-enquiries` | Rate-limited detailed group enquiry |
| GET | `/api/files/public/[fileId]` | Approved public property image |

## Authenticated routes

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/bookings` | Create an idempotent inventory hold and booking |
| POST | `/api/payments/checkout` | Create or reuse a Whop checkout session |
| GET | `/api/payments/[paymentId]` | Read the current server-verified payment state |
| POST/DELETE | `/api/favourites` | Save or remove a published property |
| GET | `/api/files/access/[token]` | Consume a short-lived private-file token |

Server actions provide the role-specific host, guest, staff and administrator mutations. They apply the same authorization, validation, transaction and audit rules as route handlers.

## Clerk webhook

`POST /api/webhooks/clerk` verifies Clerk's signed raw request. User, organization and membership events synchronize local identity projections. Internal roles are accepted only for the configured Coast Bookings internal organization. `(provider, event ID)` is unique, so retries cannot duplicate a projection.

## Whop webhook

Configure Whop to send payment events to:

```text
POST https://YOUR-REPLIT-DOMAIN/api/webhooks/whop
```

The handler requires and verifies the Standard Webhooks ID, timestamp and signature headers with `WHOP_WEBHOOK_SECRET`. It then verifies the payment with the Whop API, company, KES amount, metadata, checkout session and inventory hold. Event IDs, payload hashes, provider transaction IDs and ledger journals are unique.

Only the verified callback can invoke `confirm_paid_booking`. That PostgreSQL function locks the booking and inventory rows, rechecks the hold, converts held stock to sold stock, writes status history and queues confirmation inside one transaction. A checkout completion callback, browser redirect or status-page refresh never marks a booking paid.

Deposits confirm inventory and leave the booking `PARTIALLY_PAID`; later Whop sessions collect the next schedule. Refunds are staff-approved, processed asynchronously with a stable idempotency key, entered in the double-entry ledger and placed against host payout eligibility.

## Scheduled jobs

`POST /api/jobs/run` requires `Authorization: Bearer <CRON_SHARED_SECRET>`. It expires holds and quotations, publishes eligible double-blind reviews, creates eligible payouts, queues payment reminders, detects stalled checkouts and drains the retrying outbox. Never expose this route without the shared secret.

## Private files

Private host, booking, support and dispute files remain in private Replit App Storage buckets. Access uses audience-bound, one-time tokens with expiry and `private, no-store` responses. Upload services enforce MIME allowlists, limits, randomized keys, ownership scope and checksums.
