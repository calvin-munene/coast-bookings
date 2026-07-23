import { WorkspaceScaffold, type WorkspaceSection } from "./workspace-scaffold";
import type { WorkspaceSummary } from "@/modules/workspaces/repository";
import type { WorkspaceSectionData } from "@/modules/workspaces/section-repository";
import { WorkspaceRecords } from "./workspace-records";

export const GUEST_SECTIONS: readonly WorkspaceSection[] = [
  ["dashboard", "Overview"], ["upcoming-stays", "Upcoming stays"], ["pending-requests", "Pending requests"], ["past-stays", "Past stays"], ["favourites", "Saved properties"], ["wishlists", "Wishlists"], ["saved-searches", "Saved searches"], ["messages", "Messages"], ["payments", "Payments"], ["receipts", "Receipts"], ["refunds", "Refunds"], ["group-quotes", "Group quote requests"], ["reviews", "Reviews"], ["profile", "Profile"], ["security", "Security"],
].map(([slug, label]) => ({ slug, label }));

export function GuestWorkspace({ section, summary, data, actions }: Readonly<{ section: string; summary: WorkspaceSummary; data?: WorkspaceSectionData; actions?: React.ReactNode }>) {
  return <WorkspaceScaffold title="Travel account" eyebrow="Guest portal" rootPath="/guest" activeSection={section} sections={GUEST_SECTIONS} summary={summary}><WorkspaceRecords data={data}>{actions}</WorkspaceRecords></WorkspaceScaffold>;
}
