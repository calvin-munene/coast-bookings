import type { Metadata } from "next";
import Link from "next/link";
import { List, Map, SlidersHorizontal } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { SearchBar } from "@/components/search-bar";
import { searchMarketplace } from "@/modules/marketplace/repository";
import { searchSchema } from "@/modules/search/validators";
import type { MarketplacePropertyCard } from "@/modules/marketplace/types";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Find a stay" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function singleValue(params: SearchParams): Record<string, string> {
  return Object.fromEntries(Object.entries(params).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : Array.isArray(value) && value[0] ? [[key, value[0]]] : []));
}

function searchHref(params: Record<string, string>, changes: Record<string, string>): string {
  const query = new URLSearchParams({ ...params, ...changes });
  return `/search?${query.toString()}`;
}

function MapResults({ properties }: Readonly<{ properties: readonly MarketplacePropertyCard[] }>) {
  const token = getEnv().NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const points = properties.filter((property) => property.latitude !== null && property.longitude !== null).slice(0, 20);
  const overlays = points.map((property) => `pin-s+f47721(${property.longitude},${property.latitude})`).join(",");
  const mapUrl = token && points.length > 0
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays}/auto/760x900@2x?padding=70&access_token=${encodeURIComponent(token)}`
    : null;
  return <aside className="marketplace-map" aria-label="Map of available stays" style={mapUrl ? { backgroundImage: `url(${mapUrl})` } : undefined}>
    {!mapUrl && <div className="map-empty"><Map /><strong>Mapbox is ready for its Replit secret.</strong><span>Set the public Mapbox token to display live result locations.</span></div>}
    <div className="map-property-list">{points.slice(0, 4).map((property) => <Link key={property.id} href={`/stays/${property.slug}`}><strong>{property.name}</strong><span>{property.destination}</span></Link>)}</div>
  </aside>;
}

export default async function SearchPage({ searchParams }: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const raw = singleValue(await searchParams);
  const parsed = searchSchema.safeParse(raw);
  const input = parsed.success ? parsed.data : searchSchema.parse({});
  const result = await searchMarketplace(input);
  return <>
    <section className="page-hero"><div className="shell"><span className="section-kicker">Coastal marketplace</span><h1>Find a stay that fits.</h1><p>Browse verified properties and see clear, server-calculated pricing before you book.</p><SearchBar compact /></div></section>
    <section className="content-section shell">
      <form className="search-filter-panel" action="/search">
        {input.destination && <input type="hidden" name="destination" value={input.destination} />}
        {input.checkIn && <input type="hidden" name="checkIn" value={input.checkIn} />}
        {input.checkOut && <input type="hidden" name="checkOut" value={input.checkOut} />}
        <label><span>Property type</span><select name="propertyTypes" defaultValue={input.propertyTypes.join(",")}><option value="">All properties</option><option value="Guest house">Guest house</option><option value="Villa">Villa</option><option value="Boutique hotel">Boutique hotel</option><option value="Eco lodge">Eco lodge</option><option value="Apartment">Apartment</option></select></label>
        <label><span>Amenities</span><select name="amenities" defaultValue={input.amenities.join(",")}><option value="">Any amenities</option><option value="Wi-Fi">Wi-Fi</option><option value="Swimming pool">Swimming pool</option><option value="Beach access">Beach access</option><option value="Breakfast">Breakfast</option><option value="Parking">Parking</option></select></label>
        <label><span>Maximum nightly rate</span><select name="maxPriceMinor" defaultValue={input.maxPriceMinor ?? ""}><option value="">Any price</option><option value="750000">KES 7,500</option><option value="1250000">KES 12,500</option><option value="2500000">KES 25,000</option></select></label>
        <label><span>Minimum rating</span><select name="minRating" defaultValue={input.minRating ?? ""}><option value="">Any rating</option><option value="4">4.0+</option><option value="4.5">4.5+</option><option value="4.7">4.7+</option></select></label>
        <label><span>Sort by</span><select name="sort" defaultValue={input.sort}><option value="recommended">Recommended</option><option value="price_low">Lowest price</option><option value="price_high">Highest price</option><option value="rating">Guest rating</option><option value="distance">Distance</option></select></label>
        <label className="filter-check"><input type="checkbox" name="instantBook" value="true" defaultChecked={input.instantBook} /><span>Instant book only</span></label>
        <input type="hidden" name="adults" value={input.adults} /><input type="hidden" name="children" value={input.children} /><input type="hidden" name="rooms" value={input.rooms} />
        <button className="button button-small" type="submit"><SlidersHorizontal size={15} /> Apply filters</button>
      </form>
      {!parsed.success && <p className="form-error">Some search filters were invalid, so safe defaults were applied.</p>}
      <div className="toolbar"><p><strong>{result.count}</strong> verified stays match your search</p><div className="filter-row"><Link className={`filter-chip ${input.view === "list" ? "active" : ""}`} href={searchHref(raw, { view: "list" })}><List size={13} /> List</Link><Link className={`filter-chip ${input.view === "map" ? "active" : ""}`} href={searchHref(raw, { view: "map" })}><Map size={13} /> Map</Link></div></div>
      <div className={`search-layout ${input.view === "map" ? "map-first" : ""}`}><div>{result.properties.length > 0 ? <div className="property-grid">{result.properties.map((property) => <PropertyCard key={property.slug} property={property} />)}</div> : <div className="workspace-empty"><strong>No verified stays match these filters.</strong><p>Try widening the destination, dates, price or amenity filters.</p></div>}</div><MapResults properties={result.properties} /></div>
      {result.count > result.pageSize && <nav className="pagination" aria-label="Search result pages">{input.page > 1 && <Link href={searchHref(raw, { page: String(input.page - 1) })}>Previous</Link>}<span>Page {input.page} of {Math.ceil(result.count / result.pageSize)}</span>{input.page * result.pageSize < result.count && <Link href={searchHref(raw, { page: String(input.page + 1) })}>Next</Link>}</nav>}
    </section>
  </>;
}
