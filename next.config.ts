import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https://images.unsplash.com https://img.clerk.com https://api.mapbox.com https://*.tiles.mapbox.com",
      "font-src 'self' data:",
      `script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com${isProduction ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://*.sentry.io https://whop.com https://*.whop.com https://t.whop.tw",
      "frame-src 'self' https://whop.com https://*.whop.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; ");
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ] }];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
  bundleSizeOptimizations: { excludeDebugStatements: true },
  routeManifestInjection: { exclude: [/^\/admin(?:\/|$)/, /^\/staff(?:\/|$)/] },
});
