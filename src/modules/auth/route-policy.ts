const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/become-a-host",
  "/group-accommodation",
  "/request-quote",
  "/privacy",
  "/terms",
  "/forgot-password",
  "/verify-email",
  "/account-restricted",
  "/api/health",
  "/api/search",
  "/api/pricing/quote",
  "/api/group-enquiries",
  "/api/webhooks/clerk",
  "/api/webhooks/daraja",
  "/api/webhooks/pesapal",
]);

const PUBLIC_PREFIXES = [
  "/search",
  "/stays/",
  "/destinations/",
  "/sign-in",
  "/sign-up",
  "/help",
  "/api/files/public/",
] as const;

const INTERNAL_PREFIXES = ["/staff", "/admin"] as const;
const ACCOUNT_PREFIXES = ["/guest", "/host", "/checkout", "/onboarding", "/auth/continue"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function isInternalPath(pathname: string): boolean {
  return INTERNAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAccountPath(pathname: string): boolean {
  return ACCOUNT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export type ApplicationSurface = "public" | "account" | "operations" | "combined";

export function surfaceForHost(host: string): ApplicationSurface {
  const normalized = host.split(":")[0]?.toLowerCase() ?? "";
  const operationsHost = process.env.NEXT_PUBLIC_OPERATIONS_URL ? new URL(process.env.NEXT_PUBLIC_OPERATIONS_URL).hostname : null;
  const accountHost = process.env.NEXT_PUBLIC_ACCOUNT_URL ? new URL(process.env.NEXT_PUBLIC_ACCOUNT_URL).hostname : null;
  const publicHost = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;
  if (operationsHost && normalized === operationsHost) return "operations";
  if (accountHost && accountHost !== publicHost && normalized === accountHost) return "account";
  if (publicHost && normalized === publicHost && publicHost !== accountHost && publicHost !== operationsHost) return "public";
  return "combined";
}

export function isPathAllowedOnSurface(pathname: string, surface: ApplicationSurface): boolean {
  if (surface === "combined") return true;
  if (surface === "operations") return isInternalPath(pathname) || pathname.startsWith("/sign-in") || pathname === "/auth/continue" || pathname === "/account-restricted" || pathname === "/api/health";
  if (surface === "account") return !isInternalPath(pathname);
  return !isInternalPath(pathname) && !isAccountPath(pathname);
}

export const PUBLIC_NAVIGATION_PATHS = ["/", "/search", "/group-accommodation", "/become-a-host", "/help"] as const;
