import type { Metadata } from "next";
import { List, Map } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { SearchBar } from "@/components/search-bar";
import { properties } from "@/data/demo";

export const metadata: Metadata = { title: "Find a stay" };

export default function SearchPage() {
  const filters = ["All stays", "Instant book", "Pool", "Beach access", "Breakfast", "Family friendly", "Under KES 10,000"];
  return <>
    <section className="page-hero"><div className="shell"><span className="section-kicker">Coastal marketplace</span><h1>Find a stay that fits.</h1><p>Browse verified properties and see clear, server-calculated pricing before you book.</p><SearchBar compact /></div></section>
    <section className="content-section shell">
      <div className="toolbar"><div className="filter-row">{filters.map((filter, index) => <button className={`filter-chip ${index === 0 ? "active" : ""}`} key={filter}>{filter}</button>)}</div><div className="filter-row"><button className="filter-chip active"><List size={13} /> List</button><button className="filter-chip"><Map size={13} /> Map</button></div></div>
      <div className="search-layout"><div><p style={{ color: "var(--muted)", fontSize: 13 }}>{properties.length} recommended stays around the Kenyan coast</p><div className="property-grid">{properties.map((property) => <PropertyCard key={property.slug} property={property} />)}</div></div><aside className="map-placeholder" aria-label="Map results placeholder" /></div>
    </section>
  </>;
}
