import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ApplicationChrome } from "@/components/application-chrome";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Coast Bookings — Kenyan coastal stays", template: "%s | Coast Bookings" },
  description: "Book verified stays and managed group accommodation along Kenya's coast.",
  robots: process.env.ALLOW_INDEXING === "true" ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { title: "Coast Bookings", description: "Stay close to what matters.", images: ["/og-coast-bookings.png"] },
};

export const viewport: Viewport = { themeColor: "#08233e", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const page = <html lang="en"><body><ApplicationChrome>{children}</ApplicationChrome></body></html>;
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return page;
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/auth/continue"
      signUpFallbackRedirectUrl="/onboarding"
    >
      {page}
    </ClerkProvider>
  );
}
