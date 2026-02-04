import type { SiteAdapter } from "./base";
import { adapter as olx } from "./olx";

// OLX Portugal - using their public JSON API (no scraping needed)
export const ADAPTERS: SiteAdapter[] = [
  olx,
];
