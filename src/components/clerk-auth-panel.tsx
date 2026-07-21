import { SignIn, SignUp } from "@clerk/nextjs";

const appearance = {
  variables: {
    colorPrimary: "#f47721",
    colorText: "#142235",
    colorBackground: "#ffffff",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none w-full",
    card: "shadow-none bg-transparent border-0 w-full",
    headerTitle: "font-serif text-[#08233e]",
    headerSubtitle: "text-[#647082]",
    formButtonPrimary: "bg-[#f47721] hover:bg-[#df6413] normal-case",
    footerActionLink: "text-[#c7550c] font-semibold",
  },
} as const;

export function ClerkAuthPanel({ mode }: Readonly<{ mode: "sign-in" | "sign-up" }>) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="auth-config-notice">
        <span className="section-kicker">Configuration required</span>
        <h1>Secure account access</h1>
        <p>Add the Clerk publishable and secret keys to Replit Secrets. The hosted sign-in flow will appear here automatically.</p>
      </div>
    );
  }
  return mode === "sign-in"
    ? <SignIn appearance={appearance} routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/auth/continue" />
    : <SignUp appearance={appearance} routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />;
}
