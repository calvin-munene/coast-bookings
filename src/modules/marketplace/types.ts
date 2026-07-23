export type MarketplacePropertyCard = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string;
  location: string;
  destination: string;
  county: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  amenities: readonly string[];
  rating: number;
  reviewCount: number;
  lowestNightlyRateMinor: number;
  displayTotalMinor: number | null;
  currency: "KES";
  priceUnit: string;
  instantBook: boolean;
  verified: boolean;
  coastFavourite: boolean;
  availableUnits: number;
  limitedAvailability: boolean;
  distanceKm: number | null;
}>;

export type MarketplaceUnit = Readonly<{
  id: string;
  name: string;
  unitType: string;
  description: string;
  capacity: number;
  maxAdults: number;
  maxChildren: number;
  bedrooms: number;
  bathrooms: number;
  beds: readonly string[];
  quantity: number;
  available: number;
  baseNightlyRateMinor: number;
  cleaningFeeMinor: number;
  minimumStay: number;
  maximumStay: number;
  bookingMode: "INSTANT" | "REQUEST_TO_BOOK" | "GROUP_QUOTE";
}>;

export type MarketplaceReview = Readonly<{
  id: string;
  guestName: string;
  rating: number;
  body: string;
  hostResponse: string | null;
  publishedAt: string;
}>;

export type MarketplacePropertyDetails = MarketplacePropertyCard & Readonly<{
  address: string;
  checkInFrom: string;
  checkOutBy: string;
  checkInInstructions: string | null;
  houseRules: string | null;
  accessibilityFeatures: readonly string[];
  safetyFeatures: readonly string[];
  nearbyAttractions: readonly string[];
  transportInformation: string | null;
  groupSuitability: readonly string[];
  mealAvailability: readonly string[];
  images: readonly { id: string; url: string; altText: string }[];
  units: readonly MarketplaceUnit[];
  reviews: readonly MarketplaceReview[];
}>;

export type MarketplaceSearchResult = Readonly<{
  properties: readonly MarketplacePropertyCard[];
  count: number;
  page: number;
  pageSize: number;
}>;
