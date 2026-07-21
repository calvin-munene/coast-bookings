import Link from "next/link";
import { BadgeCheck, Heart, MapPin, Star } from "lucide-react";
import type { Property } from "@/data/demo";
import { formatKes } from "@/data/demo";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="property-card">
      <Link className="property-photo" href={`/stays/${property.slug}`} style={{ backgroundImage: `url(${property.image})` }}>
        {property.instantBook && <span className="photo-chip">Instant book</span>}
        <button className="heart-button" aria-label={`Save ${property.name}`}><Heart size={18} /></button>
      </Link>
      <div className="property-copy">
        <div className="eyebrow-row"><span>{property.category}</span><span className="rating"><Star size={14} fill="currentColor" /> {property.rating} ({property.reviews})</span></div>
        <Link href={`/stays/${property.slug}`}><h3>{property.name}</h3></Link>
        <p className="location"><MapPin size={15} /> {property.location}</p>
        <div className="amenity-line">{property.amenities.slice(0, 3).join(" · ")}</div>
        <div className="property-bottom">
          <span className="verified"><BadgeCheck size={16} /> Coast verified</span>
          <span><strong>{formatKes(property.priceMinor)}</strong><small> / {property.priceUnit}</small></span>
        </div>
      </div>
    </article>
  );
}
