import { notFound } from "next/navigation";
import { GuestWorkspace, GUEST_SECTIONS } from "@/components/workspaces/guest-workspace";
import { guardPage } from "@/modules/authorization/page-guards";
import { requireGuest } from "@/modules/authorization/service";
import { guestWorkspaceSummary } from "@/modules/workspaces/repository";
import { guestSectionData } from "@/modules/workspaces/section-repository";
import { GuestSectionActions } from "@/components/workspaces/guest-actions";
export default async function GuestSectionPage({ params }: Readonly<{ params: Promise<{ section: string }> }>) { const { section } = await params; if (!GUEST_SECTIONS.some((item) => item.slug === section)) notFound(); const context = await guardPage(requireGuest); const [summary, data] = await Promise.all([guestWorkspaceSummary(context.user.id), guestSectionData(context.user.id, section)]); return <GuestWorkspace section={section} summary={summary} data={data} actions={<GuestSectionActions section={section} userId={context.user.id} />} />; }
