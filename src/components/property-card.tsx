import Link from "next/link";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import type { MarketplacePropertyCard } from "@/modules/marketplace/types";
import { formatKes } from "@/lib/format";
import { SavePropertyButton } from "@/components/save-property-button";

export function PropertyCard({ property }: Readonly<{ property: MarketplacePropertyCard }>) {
  const price = property.displayTotalMinor ?? property.lowestNightlyRateMinor;
  return (
    <article className="property-card">
      <Link className="property-photo" href={`/stays/${property.slug}`} style={{ backgroundImage: `url(${property.imageUrl ?? "/coastbookings-logo.svg"})` }}>
        {property.instantBook && <span className="photo-chip">Instant book</span>}
        {property.coastFavourite && <span className="quality-chip">Coast Favourite</span>}
      </Link>
      <SavePropertyButton propertyId={property.id} propertyName={property.name} />
      <div className="property-copy">
        <div className="eyebrow-row"><span>{property.category}</span><span className="rating"><Star size={14} fill="currentColor" /> {property.rating > 0 ? property.rating.toFixed(1) : "New"} ({property.reviewCount})</span></div>
        <Link href={`/stays/${property.slug}`}><h3>{property.name}</h3></Link>
        <p className="location"><MapPin size={15} /> {property.location}</p>
        <div className="amenity-line">{property.amenities.slice(0, 3).join(" · ")}</div>
        <div className="property-bottom">
          <span className="verified"><BadgeCheck size={16} /> Coast verified</span>
          <span><strong>{formatKes(price)}</strong><small>{property.displayTotalMinor === null ? ` / ${property.priceUnit}` : " total for selected stay"}</small></span>
        </div>
        {property.limitedAvailability && <p className="availability-warning">Only {property.availableUnits} left for these dates</p>}
      </div>
    </article>
  );
}
