export type PriceIntent =
  | { type: "under"; max: number; currency?: string }
  | { type: "over"; min: number; currency?: string }
  | { type: "between"; min: number; max: number; currency?: string }
  | { type: "exact"; target: number; currency?: string }
  | { type: "around"; target: number; currency?: string }
  | { type: "none" };

export type ParsedQuery = {
  raw: string;
  locationText?: string;
  propertyType?: string;
  priceIntent: PriceIntent;
  listingIntent?: 'sale' | 'rent'; // User wants properties for sale or rent
};
