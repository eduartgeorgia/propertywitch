import type { Listing } from "../domain/listing";
import type { SearchContext, SiteAdapter } from "./base";

export const adapter: SiteAdapter = {
  siteId: "${site}",
  siteName: "${site}",
  searchListings: async (_context: SearchContext): Promise<Listing[]> => {
    return [];
  },
};
