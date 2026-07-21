# Roles and permissions

Permissions are applied in the UI, in server routes/actions, and in PostgreSQL RLS. Hiding a button is never treated as authorisation.

| Role | Typical capabilities | Explicit restrictions |
| --- | --- | --- |
| Guest | Own profile, bookings, payments, messages, favourites and reviews | Cannot see another guest's data or host finance |
| Host | Own properties, units, calendars, reservations, messages, earnings and payout statements | Cannot verify own property or approve a payout |
| Co-host | Selected calendars, reservations, messages and check-in/out | No payout account, ownership document or bank-detail access |
| Super administrator | All documented permissions | Sensitive work is still audit logged |
| Operations manager | Listings, inventory, reservations, support and audit | No automatic payout-account authority |
| Reservations officer | Reservations, group enquiries, messages and support | No payout approval or role administration |
| Host verification officer | Private verification documents and listing approval | No payouts or guest-payment mutation |
| Finance officer | Payments, refunds, reconciliation, payout approval and financial audit | No routine property editing |
| Customer support officer | Booking context, messages and tickets | No payout-account changes or payout approval |
| Content moderator | Property content and review moderation | No private finance data |
| Read-only auditor | Marketplace, booking, finance, payout and audit views | No mutation permissions |

Property-scoped grants are stored separately from global roles. Staff permissions are tested server-side before use. Private storage links are short-lived and generated only after the same permission check.
