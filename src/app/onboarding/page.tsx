import type { Metadata } from "next";
import { completeOnboarding } from "./actions";

export const metadata: Metadata = { title: "Set up your account", robots: { index: false, follow: false } };

export default function OnboardingPage() {
  return (
    <section className="auth-shell">
      <form action={completeOnboarding} className="form-card">
        <span className="section-kicker">Secure onboarding</span>
        <h1>How will you use Coast Bookings?</h1>
        <p>Travel accounts and host businesses may register publicly. Staff access is invitation-only and cannot be selected here.</p>
        <div className="field-grid">
          <label className="field wide">Account type<select name="accountType" required defaultValue="guest"><option value="guest">I am booking accommodation</option><option value="host">I manage accommodation</option></select></label>
          <label className="field">Host legal name<input name="legalName" minLength={2} maxLength={120} /></label>
          <label className="field">Business name<input name="businessName" minLength={2} maxLength={120} /></label>
        </div>
        <button className="button" type="submit">Create secure workspace</button>
      </form>
    </section>
  );
}
