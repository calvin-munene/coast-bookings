# Security and production readiness

## Implemented controls

- Strict TypeScript and Zod at HTTP/provider boundaries.
- Supabase Auth cookie refresh with server-only permission validation.
- RLS on guest-, host- and staff-facing tables.
- Separate public and private storage design with signed private access.
- UUID keys, foreign keys, positive amount/date checks and optimistic version fields.
- Unique payment, webhook and idempotency references.
- Atomic inventory confirmation and database capacity constraints.
- Immutable audit, payment-event and double-entry ledger records.
- Security headers and a restrictive content security policy.
- Indexing disabled by default for the public sandbox.
- No provider or service-role secret exposed through `NEXT_PUBLIC_*` variables.

## Supabase Storage buckets

Create these buckets in the sandbox and again in the separate production project:

| Bucket | Public | Access |
| --- | --- | --- |
| `public-property-images` | Yes | Published listing images only |
| `private-host-documents` | No | Owning host plus authorised verification staff |
| `private-booking-documents` | No | Booking participants and authorised staff |
| `private-support-attachments` | No | Ticket participants and assigned/authorised staff |

Private objects should use non-guessable paths and signed URLs with short expiry. Never store bank account details or KRA PINs unencrypted in object metadata or logs.

## Before production

- Create a separate Supabase production project and new credentials.
- Set staff MFA and a controlled initial super administrator.
- Replace mock provider flows with merchant-approved live credentials and tested callback verification.
- Complete penetration, dependency, RLS and disaster-recovery tests.
- Approve fee, commission, tax, cancellation and refund templates.
- Finalise Kenyan privacy notices, ODPC/controller obligations, retention/deletion schedules and vendor processing records with qualified counsel.
- Configure Sentry redaction, secret rotation, backups, point-in-time recovery and alerting.
- Verify Resend domain authentication and approved WhatsApp/SMS templates.
- Set `ALLOW_INDEXING=true` only after production content, policies and support contacts are approved.

This repository is production-oriented software, not legal or PCI certification by itself. Pesapal hosts card entry; Coast Bookings should never store raw card numbers or CVVs.
