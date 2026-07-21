export type Property = {
  slug: string;
  name: string;
  location: string;
  category: string;
  rating: number;
  reviews: number;
  priceMinor: number;
  priceUnit: string;
  instantBook: boolean;
  verified: boolean;
  image: string;
  description: string;
  amenities: string[];
  units: Array<{ name: string; beds: string; capacity: number; available: number; priceMinor: number }>;
};

export const properties: Property[] = [
  {
    slug: "ocean-breeze-guest-house",
    name: "Ocean Breeze Guest House",
    location: "Nyali, Mombasa",
    category: "Guest house",
    rating: 4.8,
    reviews: 128,
    priceMinor: 680000,
    priceUnit: "room / night",
    instantBook: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=85",
    description: "A calm coastal stay near Nyali Beach with a shaded courtyard, pool and generous Swahili breakfast.",
    amenities: ["Pool", "Breakfast", "Wi-Fi", "Air conditioning", "Parking"],
    units: [
      { name: "Standard Double Room", beds: "1 queen bed", capacity: 2, available: 6, priceMinor: 680000 },
      { name: "Family Room", beds: "1 queen + 2 singles", capacity: 4, available: 3, priceMinor: 1120000 },
    ],
  },
  {
    slug: "diani-palms-villas",
    name: "Diani Palms Villas",
    location: "Diani Beach, Kwale",
    category: "Villa",
    rating: 4.9,
    reviews: 84,
    priceMinor: 1850000,
    priceUnit: "villa / night",
    instantBook: false,
    verified: true,
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85",
    description: "Private villas under palm trees, designed for families and small groups looking for space near the beach.",
    amenities: ["Beach access", "Kitchen", "Pool", "Family friendly", "Airport transfer"],
    units: [{ name: "Two-bedroom Villa", beds: "2 king beds", capacity: 5, available: 2, priceMinor: 1850000 }],
  },
  {
    slug: "watamu-coral-house",
    name: "Watamu Coral House",
    location: "Watamu, Kilifi",
    category: "Boutique hotel",
    rating: 4.7,
    reviews: 61,
    priceMinor: 920000,
    priceUnit: "room / night",
    instantBook: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1400&q=85",
    description: "Light-filled rooms, a coral garden and friendly local hosting a short walk from Watamu Marine Park.",
    amenities: ["Breakfast", "Wi-Fi", "Beach access", "Restaurant", "Air conditioning"],
    units: [
      { name: "Garden King", beds: "1 king bed", capacity: 2, available: 4, priceMinor: 920000 },
      { name: "Coral Twin", beds: "2 single beds", capacity: 2, available: 5, priceMinor: 860000 },
    ],
  },
  {
    slug: "kilifi-creek-camp",
    name: "Kilifi Creek Camp",
    location: "Kilifi Creek, Kilifi",
    category: "Eco lodge",
    rating: 4.6,
    reviews: 43,
    priceMinor: 540000,
    priceUnit: "cottage / night",
    instantBook: false,
    verified: true,
    image: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1400&q=85",
    description: "Creek-side cottages for quiet weekends, retreats and water-sports groups.",
    amenities: ["Kayaks", "Conference facilities", "Meals", "Parking", "Group friendly"],
    units: [{ name: "Creek Cottage", beds: "1 double bed", capacity: 2, available: 8, priceMinor: 540000 }],
  },
];

export const destinations = [
  { name: "Diani", stays: 84, image: properties[1].image },
  { name: "Mombasa", stays: 112, image: properties[0].image },
  { name: "Watamu", stays: 67, image: properties[2].image },
  { name: "Kilifi", stays: 46, image: properties[3].image },
];

export const dashboardStats = {
  guest: [
    ["Upcoming trips", "2"], ["Outstanding balance", "KES 18,400"], ["Saved stays", "7"], ["Unread messages", "3"],
  ],
  host: [
    ["Occupancy", "72%"], ["Upcoming arrivals", "14"], ["Expected earnings", "KES 428,600"], ["Pending requests", "5"],
  ],
  staff: [
    ["New enquiries", "18"], ["Quotes due today", "6"], ["Pending host replies", "9"], ["Arrivals this week", "74"],
  ],
  admin: [
    ["Gross booking value", "KES 8.4M"], ["Listings in review", "23"], ["Pending payouts", "KES 1.2M"], ["Open disputes", "4"],
  ],
};

export const reservations = [
  { reference: "CB-260721-1042", guest: "Amina Hassan", stay: "Ocean Breeze", dates: "26–29 Jul", total: "KES 24,600", status: "CONFIRMED" },
  { reference: "CB-260721-1038", guest: "Peter Mwangi", stay: "Diani Palms", dates: "1–4 Aug", total: "KES 55,500", status: "PENDING HOST" },
  { reference: "CB-260720-1026", guest: "Faith Njeri", stay: "Watamu Coral", dates: "8–11 Aug", total: "KES 29,800", status: "AWAITING PAYMENT" },
  { reference: "CB-260719-0994", guest: "James Otieno", stay: "Kilifi Creek", dates: "22–24 Jul", total: "KES 12,400", status: "CHECKED IN" },
];

export function formatKes(minor: number): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(minor / 100);
}
