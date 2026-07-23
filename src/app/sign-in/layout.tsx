import Image from "next/image";
import Link from "next/link";

export default function SignInLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AuthFrame>{children}</AuthFrame>;
}

export function AuthFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="premium-auth-shell">
      <div className="auth-story">
        <Link className="brand auth-brand" href="/">
          <Image src="/coastbookings-logo.svg" alt="" width={48} height={48} priority />
          <span>Coast <strong>Bookings</strong></span>
        </Link>
        <div>
          <span className="section-kicker light">Trusted coastal travel</span>
          <h2>One secure account for every Coast Bookings journey.</h2>
          <p>Plan verified stays, manage properties, and coordinate group accommodation from a role-isolated workspace.</p>
        </div>
        <small>Clerk identity · Replit infrastructure · server-enforced permissions</small>
      </div>
      <div className="auth-panel"><div className="auth-panel-card">{children}</div></div>
    </section>
  );
}
