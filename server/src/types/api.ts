import type { ListingCard } from "../domain/listing";

export type UserLocation = {
  label: string;
  lat: number;
  lng: number;
  currency: string;
};

export type SearchRequest = {
  query: string;
  userLocation: UserLocation;
};

export type PriceRange = {
  min?: number;
  max?: number;
  currency: string;
};

export type SearchResponse = {
  searchId: string;
  matchType: "exact" | "near-miss";
  note: string;
  appliedPriceRange: PriceRange;
  appliedRadiusKm: number;
  listings: ListingCard[];
  blockedSites: Array<{
    siteId: string;
    siteName: string;
    requiredMethod: string;
    reason: string;
  }>;
};

export type ApproveRequest = {
  searchId: string;
  listingIds: string[];
  reportLabel?: string;
};

export type ApproveResponse = {
  filename: string;
  url: string;
};
