import { notFound } from "next/navigation";
import { GuestWorkspace, GUEST_SECTIONS } from "@/components/workspaces/guest-workspace";
import { requireGuest } from "@/modules/authorization/service";
import { guestWorkspaceSummary } from "@/modules/workspaces/repository";
export default async function GuestSectionPage({ params }: Readonly<{ params: Promise<{ section: string }> }>) { const { section } = await params; if (!GUEST_SECTIONS.some((item) => item.slug === section)) notFound(); const context = await requireGuest(); return <GuestWorkspace section={section} summary={await guestWorkspaceSummary(context.user.id)} />; }
