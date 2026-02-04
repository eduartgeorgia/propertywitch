/**
 * Kyero Adapter - STUB for cloud deployment
 * Browser automation not available in cloud.
 */

import type { Listing } from "../domain/listing";
import type { SearchContext, SiteAdapter } from "./base";

export const adapter: SiteAdapter = {
  siteId: "kyero",
  siteName: "Kyero",
  searchListings: async (context: SearchContext): Promise<Listing[]> => {
    console.log("[Kyero] Browser automation not available in cloud deployment");
    return [];
  },
};
