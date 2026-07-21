import { guardPage } from "@/modules/authorization/page-guards";
import { requireHostOrganization } from "@/modules/authorization/service";
export const dynamic = "force-dynamic";
export default async function HostLayout({ children }: Readonly<{ children: React.ReactNode }>) { await guardPage(requireHostOrganization); return children; }
