/**
 * Kyero Adapter - STUB
 * 
 * This adapter is disabled for cloud deployment as it requires Playwright.
 * The OLX adapter (using their public API) is the primary source.
 */

import type { Listing } from "../domain/listing";
import type { SearchContext, SiteAdapter } from "./base";

export const adapter: SiteAdapter = {
  siteId: "kyero",
  siteName: "Kyero",
  searchListings: async (_context: SearchContext): Promise<Listing[]> => {
    console.log("[Kyero] Adapter disabled - using OLX public API instead");
    return [];
  },
};

