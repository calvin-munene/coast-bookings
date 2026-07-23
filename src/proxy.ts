import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isPathAllowedOnSurface, isPublicPath, surfaceForHost } from "@/modules/auth/route-policy";

function surfaceGuard(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const surface = surfaceForHost(request.headers.get("host") ?? "");
  if (isPathAllowedOnSurface(pathname, surface)) return null;
  return new NextResponse("Not found", { status: 404 });
}

const protectedProxy = clerkMiddleware(async (auth, request) => {
  const blocked = surfaceGuard(request);
  if (blocked) return blocked;
  if (!isPublicPath(request.nextUrl.pathname)) await auth.protect();
});

function unconfiguredProxy(request: NextRequest): NextResponse {
  const blocked = surfaceGuard(request);
  if (blocked) return blocked;
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("redirect_url", request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return unconfiguredProxy(request);
  return protectedProxy(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"],
};
