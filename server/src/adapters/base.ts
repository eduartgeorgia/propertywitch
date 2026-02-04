import type { Listing } from "../domain/listing";
import type { PriceRange, UserLocation } from "../types/api";

export type SearchContext = {
  query: string;
  priceRange: PriceRange;
  userLocation: UserLocation;
  propertyType?: string;
};

export type SiteAdapter = {
  siteId: string;
  siteName: string;
  searchListings: (context: SearchContext) => Promise<Listing[]>;
};
