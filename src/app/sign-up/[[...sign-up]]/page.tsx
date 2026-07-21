import type { Metadata } from "next";
import { ClerkAuthPanel } from "@/components/clerk-auth-panel";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export default function SignUpPage() { return <ClerkAuthPanel mode="sign-up" />; }
