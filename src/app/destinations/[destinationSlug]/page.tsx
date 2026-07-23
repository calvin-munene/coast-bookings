import { PropertyCard } from "@/components/property-card";
import { searchMarketplace } from "@/modules/marketplace/repository";

export const dynamic = "force-dynamic";

export default async function DestinationPage({ params }: Readonly<{ params: Promise<{ destinationSlug: string }> }>) {
  const { destinationSlug } = await params;
  const name = destinationSlug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  const result = await searchMarketplace({ destination: name, adults: 2, children: 0, rooms: 1, propertyTypes: [], amenities: [], sort: "recommended", view: "list", page: 1 });
  return <><section className="page-hero"><div className="shell"><span className="section-kicker">Destination guide</span><h1>Stay in {name}.</h1><p>Verified guest houses, hotels, villas and group-friendly properties with clear KES pricing.</p></div></section><section className="section shell">{result.properties.length > 0 ? <div className="property-grid">{result.properties.map((property) => <PropertyCard key={property.slug} property={property} />)}</div> : <div className="marketplace-notice"><strong>No published stays yet.</strong><p>Our verification team is preparing trusted accommodation in this destination.</p></div>}</section></>;
}
