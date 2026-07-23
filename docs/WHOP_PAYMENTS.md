# Whop payments

Whop is the only online checkout provider enabled by Coast Bookings. `ManualPaymentProvider` and staff-recorded bank/M-Pesa entries exist only for audited offline reconciliation.

## Replit secrets

- `PAYMENT_MODE`: `sandbox` until go-live, then `live`.
- `WHOP_API_KEY`: server-only Whop API key.
- `WHOP_WEBHOOK_SECRET`: the exact Standard Webhooks signing secret, including its prefix.
- `WHOP_COMPANY_ID`: the Coast Bookings `biz_...` company ID.

The API key and webhook secret must never use a `NEXT_PUBLIC_` prefix.

## Acceptance sequence

1. A guest creates a booking and PostgreSQL creates a time-limited inventory hold.
2. The server creates a unique payment and Whop checkout configuration for the next schedule.
3. The browser embeds Whop checkout but has no authority to confirm payment.
4. Whop signs the callback; the server verifies its signature and retrieves the payment from Whop.
5. Company, currency, amount, metadata, session and hold are compared.
6. PostgreSQL confirms the booking and converts held inventory atomically.
7. Notifications run after commit through the outbox.

Webhook retries are safe. A crashed event may be reclaimed after five minutes; already processed IDs and provider transaction IDs cannot create a second payment or ledger journal.

## Go-live checklist

- Use a dedicated production Whop company and least-privilege API key.
- Verify sandbox success, failure, retry, duplicate, partial-payment and refund events.
- Confirm KES settlement and the exact production return/webhook domains.
- Reconcile Whop totals against `payments`, `refunds`, `ledger_journals` and `ledger_entries`.
- Rotate any secret that has ever appeared outside Replit Secrets.
- Switch `PAYMENT_MODE` to `live` only after staff sign-off.
