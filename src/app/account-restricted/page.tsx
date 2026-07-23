import Link from "next/link";
export default function AccountRestrictedPage() {
  return <section className="auth-shell"><div className="form-card"><span className="section-kicker">Account access</span><h1>Access is restricted</h1><p>This account cannot enter a Coast Bookings workspace. Contact support if you believe this is an error.</p><Link className="button" href="/help">Contact support</Link></div></section>;
}
