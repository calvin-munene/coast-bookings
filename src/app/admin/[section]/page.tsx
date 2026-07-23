import { notFound } from "next/navigation";
import { AdminWorkspace, ADMIN_SECTIONS } from "@/components/internal/admin-workspace";
import { adminWorkspaceSummary } from "@/modules/workspaces/repository";
import { adminSectionData } from "@/modules/workspaces/section-repository";
import { AdminSectionActions } from "@/components/internal/admin-actions";
export default async function AdminSectionPage({ params }: Readonly<{ params: Promise<{ section: string }> }>) { const { section } = await params; if (!ADMIN_SECTIONS.some((item) => item.slug === section)) notFound(); const [summary, data] = await Promise.all([adminWorkspaceSummary(), adminSectionData(section)]); return <AdminWorkspace section={section} summary={summary} data={data} actions={<AdminSectionActions section={section} />} />; }
