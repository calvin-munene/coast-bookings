import { WorkspaceScaffold, type WorkspaceSection } from "./workspace-scaffold";
import type { WorkspaceSummary } from "@/modules/workspaces/repository";
import type { WorkspaceSectionData } from "@/modules/workspaces/section-repository";
import { WorkspaceRecords } from "./workspace-records";

export const HOST_SECTIONS: readonly WorkspaceSection[] = [
  ["dashboard", "Overview"], ["properties", "Properties"], ["units", "Rooms and units"], ["calendar", "Calendar"], ["availability", "Availability"], ["rates", "Rates"], ["promotions", "Promotions"], ["reservations", "Reservations"], ["messages", "Guest communications"], ["earnings", "Earnings"], ["payouts", "Payouts"], ["reviews", "Reviews"], ["team", "Host team"], ["verification", "Verification"], ["support", "Support"], ["security", "Security"],
].map(([slug, label]) => ({ slug, label }));

export function HostWorkspace({ section, summary, data, actions }: Readonly<{ section: string; summary: WorkspaceSummary; data?: WorkspaceSectionData; actions?: React.ReactNode }>) {
  return <WorkspaceScaffold title="Property operations" eyebrow="Host portal" rootPath="/host" activeSection={section} sections={HOST_SECTIONS} summary={summary}><WorkspaceRecords data={data}>{actions}</WorkspaceRecords></WorkspaceScaffold>;
}
