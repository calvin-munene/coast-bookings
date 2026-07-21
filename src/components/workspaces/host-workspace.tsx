import { WorkspaceScaffold, type WorkspaceSection } from "./workspace-scaffold";
import type { WorkspaceSummary } from "@/modules/workspaces/repository";

export const HOST_SECTIONS: readonly WorkspaceSection[] = [
  ["dashboard", "Overview"], ["properties", "Properties"], ["units", "Rooms and units"], ["calendar", "Calendar"], ["availability", "Availability"], ["rates", "Rates"], ["promotions", "Promotions"], ["reservations", "Reservations"], ["messages", "Guest communications"], ["earnings", "Earnings"], ["payouts", "Payouts"], ["reviews", "Reviews"], ["team", "Host team"], ["verification", "Verification"], ["support", "Support"], ["security", "Security"],
].map(([slug, label]) => ({ slug, label }));

export function HostWorkspace({ section, summary }: Readonly<{ section: string; summary: WorkspaceSummary }>) {
  return <WorkspaceScaffold title="Property operations" eyebrow="Host portal" rootPath="/host" activeSection={section} sections={HOST_SECTIONS} summary={summary} />;
}
