import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { formatKes, properties } from "@/data/demo";

type PageProps = { params: Promise<{ propertySlug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { propertySlug } = await params;
  const property = properties.find((item) => item.slug === propertySlug);
  return { title: property?.name ?? "Stay" };
}

export function generateStaticParams() { return properties.map((property) => ({ propertySlug: property.slug })); }

export default async function StayPage({ params }: PageProps) {
  const { propertySlug } = await params;
  const property = properties.find((item) => item.slug === propertySlug);
  if (!property) notFound();
  const base = property.priceMinor;
  return <div className="shell">
    <div className="stay-heading"><div><h1>{property.name}</h1><p><MapPin size={15} style={{ display: "inline" }} /> {property.location} · <Star size={14} fill="currentColor" style={{ display: "inline", color: "#aa5c15" }} /> {property.rating} ({property.reviews} reviews)</p></div><span className="verified"><BadgeCheck /> Coast Bookings verified</span></div>
    <div className="gallery"><div style={{ backgroundImage: `url(${property.image})` }} /><div style={{ backgroundImage: `linear-gradient(rgba(8,35,62,.08),rgba(8,35,62,.08)),url(${property.image})` }} /></div>
    <div className="details-layout">
      <div>
        <span className="section-kicker">{property.category}</span><h2 style={{ color: "var(--navy)", font: "500 30px Georgia,serif" }}>A trusted stay in {property.location.split(",")[0]}</h2>
        <p className="stay-description">{property.description} Every booking includes direct support from Coast Bookings and a permanent record of the price and cancellation terms you accepted.</p>
        <h2>What this place offers</h2><div className="amenity-grid">{property.amenities.map((amenity) => <span key={amenity}>✓ {amenity}</span>)}</div>
        <h2>Choose your room</h2>{property.units.map((unit) => <article className="unit-card" key={unit.name}><div><h3>{unit.name}</h3><p>{unit.beds} · Sleeps {unit.capacity} · {unit.available} currently available</p></div><strong>{formatKes(unit.priceMinor)}</strong></article>)}
      </div>
      <aside className="booking-panel">
        <div className="price">{formatKes(base)} <small>/ night</small></div>
        <div className="field-grid"><label className="field"><span>Check in</span><input type="date" /></label><label className="field"><span>Check out</span><input type="date" /></label><label className="field wide"><span>Guests and rooms</span><select defaultValue="2"><option value="2">2 guests · 1 room</option><option value="3">3 guests · 1 room</option><option value="4">4 guests · 2 rooms</option></select></label></div>
        <div className="fee-line"><span>2 nights</span><span>{formatKes(base * 2)}</span></div><div className="fee-line"><span>Service fee</span><span>{formatKes(Math.round(base * .2))}</span></div><div className="fee-line fee-total"><span>Total</span><span>{formatKes(Math.round(base * 2.2))}</span></div>
        <Link className="button" href={`/checkout?stay=${property.slug}`}>{property.instantBook ? "Reserve instantly" : "Request to book"}</Link>
        <p style={{ color: "var(--muted)", textAlign: "center", fontSize: 11 }}>{property.instantBook ? "A 15-minute inventory hold starts at checkout." : "The host has 12 hours to respond. You are not charged yet."}</p>
      </aside>
    </div>
  </div>;
}
