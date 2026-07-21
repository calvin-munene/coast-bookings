import { notFound } from "next/navigation";
import { AdminWorkspace, ADMIN_SECTIONS } from "@/components/internal/admin-workspace";
export default async function AdminSectionPage({ params }: Readonly<{ params: Promise<{ section: string }> }>) { const { section } = await params; if (!ADMIN_SECTIONS.some((item) => item.slug === section)) notFound(); return <AdminWorkspace section={section} />; }
