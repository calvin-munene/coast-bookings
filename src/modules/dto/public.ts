export type PublicPropertyDTO = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string;
  destination: string;
  county: string;
  category: string;
  imageUrl: string | null;
  verified: boolean;
  lowestNightlyRateMinor: number | null;
  currency: "KES";
}>;

export type PublicPropertySource = PublicPropertyDTO & Readonly<{
  hostOrganizationId?: string;
  internalNotes?: string | null;
  internalMarginMinor?: number;
  riskFlags?: readonly string[];
}>;

export function toPublicPropertyDTO(source: PublicPropertySource): PublicPropertyDTO {
  return {
    id: source.id,
    slug: source.slug,
    name: source.name,
    description: source.description,
    destination: source.destination,
    county: source.county,
    category: source.category,
    imageUrl: source.imageUrl,
    verified: source.verified,
    lowestNightlyRateMinor: source.lowestNightlyRateMinor,
    currency: "KES",
  };
}
