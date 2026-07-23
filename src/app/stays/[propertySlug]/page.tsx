import type { Metadata } from "next";
import { BadgeCheck, MapPin, ShieldCheck, Star, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { formatKes } from "@/lib/format";
import { getMarketplaceProperty } from "@/modules/marketplace/repository";

type PageProps = { params: Promise<{ propertySlug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const property = await getMarketplaceProperty((await params).propertySlug);
  return { title: property?.name ?? "Stay", description: property?.description };
}

export default async function StayPage({ params }: PageProps) {
  const property = await getMarketplaceProperty((await params).propertySlug);
  if (!property) notFound();
  const firstUnit = property.units[0];
  return <div className="shell">
    <div className="stay-heading"><div><h1>{property.name}</h1><p><MapPin size={15} /> {property.location} <span>·</span> <Star size={14} fill="currentColor" /> {property.rating > 0 ? property.rating.toFixed(1) : "New"} ({property.reviewCount} reviews)</p></div><div className="listing-badges"><span className="verified"><BadgeCheck /> Coast Bookings verified</span>{property.coastFavourite && <span className="quality-badge">Coast Favourite</span>}</div></div>
    <div className="gallery">{(property.images.length > 0 ? property.images : [{ id: "fallback", url: property.imageUrl ?? "/coastbookings-logo.svg", altText: property.name }]).slice(0, 3).map((image) => <div key={image.id} role="img" aria-label={image.altText} style={{ backgroundImage: `url(${image.url})` }} />)}</div>
    <div className="details-layout">
      <div>
        <span className="section-kicker">{property.category}</span><h2 className="stay-title">A verified stay in {property.destination}</h2>
        <p className="stay-description">{property.description}</p>
        <div className="property-highlights"><span><ShieldCheck /> {property.safetyFeatures.length} safety features</span><span><UsersRound /> {property.groupSuitability.length > 0 ? "Group suitable" : "Independent stays"}</span><span><BadgeCheck /> Price and policy snapshot</span></div>
        <h2>What this place offers</h2><div className="amenity-grid">{property.amenities.map((amenity) => <span key={amenity}>✓ {amenity}</span>)}</div>
        <h2>Choose your room</h2>{property.units.map((unit) => <article className="unit-card" key={unit.id}><div><h3>{unit.name}</h3><p>{unit.beds.join(" · ") || unit.unitType} · Sleeps {unit.capacity} · {unit.bedrooms} bedroom{unit.bedrooms === 1 ? "" : "s"} · {unit.available} available</p><small>{unit.bookingMode === "INSTANT" ? "Instant confirmation" : "Host approval required"}</small></div><strong>{formatKes(unit.baseNightlyRateMinor)}<small>/night</small></strong></article>)}
        {property.reviews.length > 0 && <section className="review-section"><h2>Verified guest reviews</h2><div className="review-grid">{property.reviews.map((review) => <article key={review.id}><div><strong>{review.guestName}</strong><span><Star size={13} fill="currentColor" /> {review.rating.toFixed(1)}</span></div><p>{review.body}</p>{review.hostResponse && <blockquote><strong>Host response</strong>{review.hostResponse}</blockquote>}</article>)}</div></section>}
        <section className="policy-grid"><article><h3>House rules</h3><p>{property.houseRules ?? "Respect the property, neighbours and published occupancy limits."}</p></article><article><h3>Check-in</h3><p>From {property.checkInFrom}; check out by {property.checkOutBy}. Instructions are shared after confirmation.</p></article><article><h3>Getting there</h3><p>{property.transportInformation ?? "Detailed directions are provided with the booking voucher."}</p></article></section>
      </div>
      <aside className="booking-panel">
        <div className="price">From {formatKes(property.lowestNightlyRateMinor)} <small>/ night</small></div>
        {firstUnit ? <form action="/checkout" method="get"><input type="hidden" name="stay" value={property.slug} /><label className="field"><span>Room or unit</span><select name="unitId" defaultValue={firstUnit.id}>{property.units.map((unit) => <option value={unit.id} key={unit.id}>{unit.name} — {formatKes(unit.baseNightlyRateMinor)}</option>)}</select></label><div className="field-grid"><label className="field"><span>Check in</span><input type="date" name="checkIn" required /></label><label className="field"><span>Check out</span><input type="date" name="checkOut" required /></label><label className="field"><span>Adults</span><input type="number" name="adults" min="1" max="30" defaultValue="2" required /></label><label className="field"><span>Children</span><input type="number" name="children" min="0" max="30" defaultValue="0" /></label><label className="field wide"><span>Rooms</span><input type="number" name="rooms" min="1" max={firstUnit.quantity} defaultValue="1" required /></label></div><button className="button" type="submit">{firstUnit.bookingMode === "INSTANT" ? "Reserve and pay securely" : "Request to book"}</button></form> : <p>No active units are available.</p>}
        <p className="booking-assurance">Your total is calculated by the server. A 20-minute inventory hold begins only after you continue.</p>
      </aside>
    </div>
  </div>;
}
