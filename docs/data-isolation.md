# Data isolation

Host-owned records carry `host_organization_id`; guest-owned bookings carry `guest_user_id`. Repository functions include these trusted values in the database query instead of fetching a record and hiding it afterward.

Financial margins, risk flags, staff notes, security events, tasks, and host risk profiles are stored in the PostgreSQL `internal` or `audit` schemas where applicable. Public and account DTOs are explicit allowlists and cannot serialize internal fields.

The applications are separated at four layers:

- path and optional host-surface policy in `proxy.ts`;
- server page/action/route authorization;
- organization-scoped repository queries;
- separate public, guest, host, and internal response models.

Public navigation and sitemap inputs contain no staff or administrator routes. Internal React modules are server components imported only by internal route entries.

Replit PostgreSQL is private to the Replit App. If operations and marketplace processes are separated later, create distinct database roles and grant the marketplace role no access to the `internal` and `audit` schemas.
