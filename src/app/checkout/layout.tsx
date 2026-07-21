import { guardPage } from "@/modules/authorization/page-guards";
import { requireGuest } from "@/modules/authorization/service";
export const dynamic = "force-dynamic";
export default async function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) { await guardPage(requireGuest); return children; }
