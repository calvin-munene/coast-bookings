import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Link className="brand footer-brand" href="/"><Image src="/coastbookings-logo.svg" alt="" width={42} height={42} /><span>Coast <strong>Bookings</strong></span></Link>
          <p>Verified coastal stays, straightforward bookings and hands-on group accommodation support across Kenya.</p>
        </div>
        <div><h3>Explore</h3><Link href="/search">Find a stay</Link><Link href="/destinations/diani">Destinations</Link><Link href="/group-accommodation">Group accommodation</Link></div>
        <div><h3>Partners</h3><Link href="/become-a-host">Become a host</Link><Link href="/host/dashboard">Host portal</Link><Link href="/staff/dashboard">Staff portal</Link></div>
        <div><h3>Support</h3><Link href="/help">Help centre</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 Coast Bookings. Built for the Kenyan coast.</span><span>Prices shown in KES</span></div>
    </footer>
  );
}
