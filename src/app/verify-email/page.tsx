import Link from "next/link";
export default function VerifyEmailPage() {
  return <section className="auth-shell"><div className="form-card"><span className="section-kicker">Email verification</span><h1>Check your inbox</h1><p>Complete the secure verification step in the message sent by Clerk, then return to Coast Bookings.</p><Link className="button" href="/auth/continue">I have verified my email</Link></div></section>;
}
