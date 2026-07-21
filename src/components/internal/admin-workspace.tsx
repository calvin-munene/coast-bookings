import { WorkspaceScaffold, type WorkspaceSection } from "@/components/workspaces/workspace-scaffold";

export const ADMIN_SECTIONS: readonly WorkspaceSection[] = [
  ["dashboard", "Administration overview"], ["users", "Staff users"], ["roles", "Roles"], ["permissions", "Permissions"], ["host-organizations", "Host organizations"], ["restrictions", "Account restrictions"], ["commission-settings", "Commission settings"], ["payment-settings", "Payment settings"], ["notification-integrations", "Notification integrations"], ["email-settings", "Email settings"], ["whatsapp-settings", "WhatsApp settings"], ["security-events", "Security events"], ["audit", "Audit logs"], ["feature-flags", "Feature flags"], ["content", "Content management"], ["data-retention", "Data retention"], ["system-health", "System health"],
].map(([slug, label]) => ({ slug, label }));

export function AdminWorkspace({ section }: Readonly<{ section: string }>) {
  return <WorkspaceScaffold title="Platform administration" eyebrow="Restricted administration" rootPath="/admin" activeSection={section} sections={ADMIN_SECTIONS} summary={[{ label: "Restricted accounts", value: "0" }, { label: "Security events", value: "0" }, { label: "Pending role changes", value: "0" }, { label: "System status", value: "Healthy" }]} />;
}
