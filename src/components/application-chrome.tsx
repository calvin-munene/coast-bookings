"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const CHROMELESS_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password", "/verify-email", "/onboarding", "/auth", "/account-restricted", "/guest", "/host", "/staff", "/admin", "/checkout"];

export function ApplicationChrome({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const chromeless = CHROMELESS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (chromeless) return <main>{children}</main>;
  return <><SiteHeader /><main>{children}</main><SiteFooter /></>;
}
