import { WorkspaceScaffold, type WorkspaceSection } from "@/components/workspaces/workspace-scaffold";
import type { WorkspaceSummary } from "@/modules/workspaces/repository";

export const OPERATIONS_SECTIONS: readonly WorkspaceSection[] = [
  ["dashboard", "Company overview"], ["crm", "CRM and enquiries"], ["group-enquiries", "Group accommodation enquiries"], ["property-sourcing", "Property sourcing"], ["quotations", "Quotation builder"], ["bookings", "Online bookings"], ["manual-bookings", "Manual bookings"], ["host-onboarding", "Host onboarding"], ["property-verification", "Property verification"], ["availability", "Availability supervision"], ["payments", "Payments"], ["refunds", "Refunds"], ["payouts", "Host payouts"], ["commission", "Commission"], ["supplier-balances", "Supplier balances"], ["support", "Support tickets"], ["disputes", "Disputes"], ["incidents", "Incident reports"], ["tasks", "Tasks"], ["documents", "Documents"], ["communications", "Communications"], ["reports", "Reports"], ["audit", "Audit history"],
].map(([slug, label]) => ({ slug, label }));

export function OperationsWorkspace({ section, summary }: Readonly<{ section: string; summary: WorkspaceSummary }>) {
  return <WorkspaceScaffold title="Coast Bookings Operations" eyebrow="Internal operations" rootPath="/staff" activeSection={section} sections={OPERATIONS_SECTIONS} summary={summary} />;
}
