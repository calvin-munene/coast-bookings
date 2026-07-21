import { guardPage } from "@/modules/authorization/page-guards";
import { requireInternalStaff } from "@/modules/authorization/service";
export const dynamic = "force-dynamic";
export default async function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) { await guardPage(requireInternalStaff); return children; }
