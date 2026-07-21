# Operations portal

The `/staff` workspace contains company overview, CRM and enquiries, group enquiries, sourcing, quotations, online/manual bookings, host onboarding, property verification, availability supervision, payments, refunds, payouts, commission, supplier balances, support, disputes, incidents, tasks, documents, communications, reports, and audit history.

Each section maps to a typed internal permission before its server component renders. The `/admin` workspace is additionally restricted to `org:super_admin` and covers staff, roles, permissions, host organizations, account restrictions, settings, integrations, security events, audit, flags, content, retention, and system health.

The workspace shell is responsive and uses server-rendered empty states until scoped operational records exist. It does not load public mock finance or customer records.

The current delivery establishes the protected application framework, tenant-safe models, route coverage, and permission enforcement. Transaction-specific operator forms and reports should be added module-by-module with Zod actions, explicit repository scopes, audit records, and reverification for sensitive mutations.
