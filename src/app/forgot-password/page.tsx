import Link from "next/link";
export default function ForgotPasswordPage() {
  return <section className="auth-shell"><div className="form-card"><span className="section-kicker">Account recovery</span><h1>Reset your password</h1><p>Use the secure recovery option on the Coast Bookings sign-in screen. Clerk verifies your email or phone before allowing a reset.</p><Link className="button" href="/sign-in">Continue to sign in</Link></div></section>;
}
