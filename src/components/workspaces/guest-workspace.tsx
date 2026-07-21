import { WorkspaceScaffold, type WorkspaceSection } from "./workspace-scaffold";
import type { WorkspaceSummary } from "@/modules/workspaces/repository";

export const GUEST_SECTIONS: readonly WorkspaceSection[] = [
  ["dashboard", "Overview"], ["upcoming-stays", "Upcoming stays"], ["pending-requests", "Pending requests"], ["past-stays", "Past stays"], ["favourites", "Saved properties"], ["messages", "Messages"], ["payments", "Payments"], ["receipts", "Receipts"], ["refunds", "Refunds"], ["group-quotes", "Group quote requests"], ["reviews", "Reviews"], ["profile", "Profile"], ["security", "Security"],
].map(([slug, label]) => ({ slug, label }));

export function GuestWorkspace({ section, summary }: Readonly<{ section: string; summary: WorkspaceSummary }>) {
  return <WorkspaceScaffold title="Travel account" eyebrow="Guest portal" rootPath="/guest" activeSection={section} sections={GUEST_SECTIONS} summary={summary} />;
}
