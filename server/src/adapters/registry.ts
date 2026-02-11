import type { SiteAdapter } from "./base";
import { adapter as olx } from "./olx";
import { adapter as googleSearch } from "./googleSearch";

// Property search adapters
// OLX Portugal - using their public JSON API (no scraping needed)
// Google Custom Search - searches Idealista, Imovirtual, etc.
export const ADAPTERS: SiteAdapter[] = [
  olx,
  googleSearch,
];
