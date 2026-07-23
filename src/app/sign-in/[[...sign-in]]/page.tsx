import type { Metadata } from "next";
import { ClerkAuthPanel } from "@/components/clerk-auth-panel";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default function SignInPage() { return <ClerkAuthPanel mode="sign-in" />; }
