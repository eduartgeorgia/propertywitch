export type Listing = {
  id: string;
  sourceSite: string;
  sourceUrl: string;
  title: string;
  priceEur: number;
  currency: string;
  beds?: number;
  baths?: number;
  areaSqm?: number;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  propertyType?: string;
  listingType?: 'sale' | 'rent'; // For sale or for rent
  description?: string;
  photos: string[];
  lastSeenAt: string;
};

export type ListingCard = {
  id: string;
  title: string;
  priceEur: number;
  displayPrice: string;
  locationLabel: string;
  beds?: number;
  baths?: number;
  areaSqm?: number;
  image?: string;
  sourceSite: string;
  sourceUrl: string;
  distanceKm?: number;
  matchScore?: number;
  aiReasoning?: string;
  listingType?: 'sale' | 'rent'; // For sale or for rent
  propertyType?: string; // apartment, house, land, etc.
};
