import { notFound } from "next/navigation";
import { HostWorkspace, HOST_SECTIONS } from "@/components/workspaces/host-workspace";
import { requireHostPermission } from "@/modules/authorization/service";
import type { HostPermission } from "@/modules/authorization/permissions";
import { hostWorkspaceSummary } from "@/modules/workspaces/repository";

const permissionBySection: Readonly<Record<string, HostPermission>> = { properties: "host:property:view", units: "host:property:view", calendar: "host:calendar:manage", availability: "host:calendar:manage", rates: "host:rates:manage", promotions: "host:rates:manage", reservations: "host:reservations:view", messages: "host:messages:manage", earnings: "host:earnings:view", payouts: "host:payouts:view", team: "host:staff:manage" };
export default async function HostSectionPage({ params }: Readonly<{ params: Promise<{ section: string }> }>) { const { section } = await params; if (!HOST_SECTIONS.some((item) => item.slug === section)) notFound(); const permission = permissionBySection[section] ?? "host:property:view"; const context = await requireHostPermission(permission); return <HostWorkspace section={section} summary={await hostWorkspaceSummary(context.membership.organizationId)} />; }
