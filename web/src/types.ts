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

export type SearchResponse = {
  searchId: string;
  matchType: "exact" | "near-miss";
  note: string;
  appliedPriceRange: {
    min?: number;
    max?: number;
    currency: string;
  };
  appliedRadiusKm: number;
  listings: ListingCard[];
  blockedSites: Array<{
    siteId: string;
    siteName: string;
    requiredMethod: string;
    reason: string;
  }>;
};
