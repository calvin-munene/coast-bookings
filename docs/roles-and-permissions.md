# Roles and permissions

## Internal organization roles

`org:super_admin`, `org:operations_manager`, `org:reservations`, `org:finance`, `org:host_verifier`, `org:customer_support`, `org:marketing`, `org:auditor`.

## Host organization roles

`org:owner`, `org:property_manager`, `org:reservations`, `org:front_desk`, `org:accountant`, `org:viewer`.

The `org:reservations` key exists in both organization types. Permission resolution always includes the trusted organization type, so an internal reservations role can never inherit host grants and vice versa.

Internal permissions cover dashboard, enquiries, quotations, bookings, payments, refunds, payouts, host verification, property approval, support, reports, users, roles, audit, and settings. Host permissions cover properties, calendar, rates, reservations, messages, earnings, payouts, payout accounts, and staff.

The canonical typed catalog and role grants are in `src/modules/authorization/permissions.ts`. The same catalog is seeded into normalized `roles`, `permissions`, and `role_permissions` tables. Expiring or revoked assignments do not authorize requests.

Clerk membership proves that a session belongs to an organization. The application database remains authoritative for account status, organization approval, tenant scope, and Coast Bookings permissions.
