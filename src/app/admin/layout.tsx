import { guardPage } from "@/modules/authorization/page-guards";
import { requireSuperAdmin } from "@/modules/authorization/service";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) { await guardPage(requireSuperAdmin); return children; }
