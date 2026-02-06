// Image features that can be detected by vision AI
export type ImageFeature = 
  | "swimming_pool"
  | "sea_view"
  | "ocean_view"
  | "mountain_view"
  | "city_view"
  | "forest"
  | "trees"
  | "garden"
  | "bare_land"
  | "ruins"
  | "old_building"
  | "modern_architecture"
  | "traditional_architecture"
  | "rustic_style"
  | "luxury_finish"
  | "needs_renovation"
  | "parking"
  | "garage"
  | "terrace"
  | "balcony"
  | "rooftop"
  | "waterfront"
  | "river_view"
  | "vineyard"
  | "olive_grove"
  | "agricultural_land"
  | "construction_ready"
  | "flat_terrain"
  | "sloped_terrain"
  | "rocky_terrain"
  | "road_access"
  | "remote_location"
  | "urban_area"
  | "suburban_area"
  | "rural_area"
  | "solar_panels"
  | "fence"
  | "gated";

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
  // Vision AI detected features from photos
  imageFeatures?: ImageFeature[];
  imageFeaturesAnalyzedAt?: string;
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
  // Vision AI analysis markers
  visionAnalyzed?: boolean; // True if photo was analyzed by AI vision
  visualFeatures?: string[]; // Features detected (from text or vision)
  imageFeatures?: ImageFeature[];
  imageFeaturesSummary?: string;
};
