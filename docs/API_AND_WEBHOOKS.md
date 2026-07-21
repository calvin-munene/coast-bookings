# API and webhooks

All request bodies and query strings are validated with Zod. Errors use `{ error, message, details? }`. Persistent mutation endpoints require authenticated sessions, server permission checks and an `Idempotency-Key` between 8 and 128 characters.

## Included endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Replit health/readiness probe |
| GET | `/api/search` | Validated property search contract |
| POST | `/api/pricing/quote` | Server-owned KES pricing calculation |
| POST | `/api/group-enquiries` | Minimal pre-booking group enquiry |
| POST | `/api/webhooks/daraja` | Daraja callback ingress |
| POST | `/api/webhooks/pesapal` | Pesapal IPN ingress |

Public demo routes return `meta.sandbox: true` where no database mutation occurs.

## Payment callback sequence

1. Read the raw request body once.
2. Enforce a maximum body size.
3. Verify the provider's signature/token against the raw bytes and production callback URL.
4. Extract a stable provider event ID and transaction reference.
5. Insert `webhook_events`/`payment_events` under unique `(provider, provider_event_id)` constraints. A conflict is an acknowledged duplicate.
6. Verify the transaction directly with the provider where supported.
7. Confirm exact currency and paid amount. Record over/underpayments for reconciliation rather than silently changing totals.
8. Mark the payment succeeded, create balanced ledger entries and call `confirm_paid_booking` in one database transaction.
9. Acknowledge promptly; deliver receipts and notifications from the outbox.

Never confirm from a checkout redirect, client-provided status, telephone SMS or screenshot. Manual payments require a staff record, evidence, a second verification step and an audit entry.

## Provider callback URLs

For the future custom domain:

```text
https://app.coastbookings.org/api/webhooks/daraja
https://app.coastbookings.org/api/webhooks/pesapal
```

Use the Replit deployment URL in sandbox first, then register new production callback/IPN endpoints when the custom domain and live merchant credentials are ready.
