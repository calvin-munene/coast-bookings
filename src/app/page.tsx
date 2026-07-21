import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Headphones, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { PropertyCard } from "@/components/property-card";
import { destinations, properties } from "@/data/demo";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-photo" />
        <div className="hero-shade" />
        <div className="shell hero-content">
          <div className="hero-kicker"><Sparkles size={16} /> Carefully verified coastal stays</div>
          <h1>Stay close to<br /><em>what matters.</em></h1>
          <p>From weekend escapes to school tours, find trusted accommodation with a local team beside you at every step.</p>
          <SearchBar />
          <div className="hero-trust"><span><BadgeCheck size={17} /> Verified properties</span><span><ShieldCheck size={17} /> Secure booking</span><span><Headphones size={17} /> Local human support</span></div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading"><div><span className="section-kicker">Made for the coast</span><h2>Find your kind of stay</h2></div><Link href="/search">View all stays <ArrowRight size={17} /></Link></div>
        <div className="property-grid">{properties.slice(0, 3).map((property) => <PropertyCard key={property.slug} property={property} />)}</div>
      </section>

      <section className="section destinations-section">
        <div className="shell">
          <div className="section-heading"><div><span className="section-kicker">Go somewhere memorable</span><h2>Explore the Kenyan coast</h2></div></div>
          <div className="destination-grid">
            {destinations.map((destination) => (
              <Link href={`/search?destination=${destination.name}`} className="destination-card" key={destination.name} style={{ backgroundImage: `url(${destination.image})` }}>
                <span><strong>{destination.name}</strong><small>{destination.stays} verified stays</small></span><ArrowRight />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell group-feature">
        <div className="group-photo" />
        <div className="group-copy">
          <span className="section-kicker light">Group accommodation, handled</span>
          <h2>Bring the whole group.<br />We’ll organise the rest.</h2>
          <p>Schools, churches, sports teams and companies get hand-picked options, clear comparisons and one dedicated Coast Bookings coordinator.</p>
          <div className="group-points"><span><UsersRound /> Rooming and meal plans</span><span><Building2 /> Multiple property quotes</span><span><ShieldCheck /> Managed payments and documents</span></div>
          <Link className="button button-light" href="/request-quote">Request a group quote <ArrowRight size={18} /></Link>
        </div>
      </section>

      <section className="section shell trust-section">
        <div><span className="section-kicker">Book with confidence</span><h2>Real places. Clear prices.<br />People you can reach.</h2></div>
        <div className="trust-cards">
          <article><BadgeCheck /><h3>Coast verified</h3><p>Listings are reviewed before they appear in the marketplace.</p></article>
          <article><ShieldCheck /><h3>Protected payments</h3><p>M-Pesa and card payments are verified server-side and fully receipted.</p></article>
          <article><Headphones /><h3>Local support</h3><p>Our coast-based team can help before, during and after your stay.</p></article>
        </div>
      </section>

      <section className="host-cta"><div className="shell"><div><span>Own or manage accommodation?</span><h2>Turn empty rooms into memorable stays.</h2></div><Link className="button button-light" href="/become-a-host">Become a Coast host <ArrowRight size={18} /></Link></div></section>
    </>
  );
}
