import { notFound } from "next/navigation";
import { HostWorkspace, HOST_SECTIONS } from "@/components/workspaces/host-workspace";
import { guardPage } from "@/modules/authorization/page-guards";
import { requireHostPermission } from "@/modules/authorization/service";
import type { HostPermission } from "@/modules/authorization/permissions";
import { hostWorkspaceSummary } from "@/modules/workspaces/repository";

const permissionBySection = {
  dashboard: "host:property:view",
  properties: "host:property:view",
  units: "host:property:view",
  calendar: "host:calendar:manage",
  availability: "host:calendar:manage",
  rates: "host:rates:manage",
  promotions: "host:rates:manage",
  reservations: "host:reservations:view",
  messages: "host:messages:manage",
  earnings: "host:earnings:view",
  payouts: "host:payouts:view",
  reviews: "host:property:view",
  team: "host:staff:manage",
  verification: "host:property:manage",
  support: "host:property:view",
  security: "host:property:view",
} as const satisfies Readonly<Record<(typeof HOST_SECTIONS)[number]["slug"], HostPermission>>;

export default async function HostSectionPage({ params }: Readonly<{ params: Promise<{ section: string }> }>) {
  const { section } = await params;
  if (!HOST_SECTIONS.some((item) => item.slug === section)) notFound();
  const context = await guardPage(() => requireHostPermission(permissionBySection[section as keyof typeof permissionBySection]));
  return <HostWorkspace section={section} summary={await hostWorkspaceSummary(context.membership.organizationId)} />;
}
