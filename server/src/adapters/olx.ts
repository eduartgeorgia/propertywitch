import type { Listing } from "../domain/listing";
import type { SearchContext, SiteAdapter } from "./base";

// OLX.pt Public API Categories for Real Estate (Imóveis)
// Category hierarchy: cat_l0 (16) > cat_l1 > cat_l2
const OLX_CATEGORIES = {
  // Main Real Estate category - use this as default to get all property types
  IMOVEIS: 16,
  // Sub-categories (discovered from API metadata)
  TERRENOS_QUINTAS: 410, // Terrenos e Quintas
  TERRENOS_VENDA: 4795, // Terrenos - Venda (works!)
};

// OLX.pt Region IDs (districts)
const OLX_REGIONS: Record<string, number> = {
  aveiro: 1,
  beja: 2,
  braga: 3,
  braganca: 4,
  "castelo branco": 5,
  coimbra: 6,
  evora: 7,
  faro: 8,
  guarda: 9,
  leiria: 10,
  lisboa: 11,
  portalegre: 12,
  porto: 13,
  santarem: 14,
  setubal: 15,
  "viana do castelo": 16,
  "vila real": 17,
  viseu: 18,
  acores: 19,
  madeira: 20,
};

interface OLXApiResponse {
  data: OLXListing[];
  metadata: {
    total_elements: number;
    visible_total_count: number;
  };
  links: {
    self: { href: string };
    next?: { href: string };
  };
}

interface OLXListing {
  id: number;
  url: string;
  title: string;
  description?: string;
  created_time: string;
  last_refresh_time: string;
  params: Array<{
    key: string;
    name: string;
    type: string;
    value: {
      key?: string;
      label?: string;
      value?: number;
      currency?: string;
    };
  }>;
  location: {
    city?: {
      id: number;
      name: string;
      normalized_name: string;
    };
    region?: {
      id: number;
      name: string;
      normalized_name: string;
    };
  };
  map?: {
    lat: number;
    lon: number;
  };
  photos: Array<{
    id: number;
    filename: string;
    link: string;
  }>;
  category: {
    id: number;
    type: string;
  };
  user?: {
    id: number;
    name: string;
  };
}

function mapPropertyType(context: SearchContext): number {
  const type = context.propertyType?.toLowerCase() || "";
  const query = context.query.toLowerCase();

  // Check for specific property types - land/terreno
  if (type.includes("land") || type.includes("plot") || query.includes("terreno") || query.includes("land")) {
    return OLX_CATEGORIES.TERRENOS_VENDA;
  }

  // Default to all real estate (category 16 = Imóveis)
  // This includes apartments, houses, rooms, etc.
  return OLX_CATEGORIES.IMOVEIS;
}

function findRegionId(location?: { label?: string; city?: string; region?: string }): number | undefined {
  if (!location) return undefined;

  const searchTerms = [
    location.label?.toLowerCase(),
    location.city?.toLowerCase(),
    location.region?.toLowerCase(),
  ].filter(Boolean);

  for (const term of searchTerms) {
    if (!term) continue;
    for (const [regionName, regionId] of Object.entries(OLX_REGIONS)) {
      if (term.includes(regionName) || regionName.includes(term)) {
        return regionId;
      }
    }
  }

  return undefined;
}

function extractPrice(params: OLXListing["params"]): number {
  const priceParam = params.find((p) => p.key === "price");
  if (priceParam?.value?.value) {
    return priceParam.value.value;
  }
  return 0;
}

function extractArea(params: OLXListing["params"]): number | undefined {
  // Try different area parameter keys
  const areaKeys = ["m", "area", "area_de_terreno_m2", "area_util"];
  for (const key of areaKeys) {
    const areaParam = params.find((p) => p.key === key);
    if (areaParam?.value?.key) {
      const parsed = parseFloat(areaParam.value.key.replace(/[^\d.]/g, ""));
      if (!isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

function extractBedrooms(params: OLXListing["params"]): number | undefined {
  const bedsParam = params.find((p) => p.key === "rooms" || p.key === "quartos" || p.key === "t");
  if (bedsParam?.value?.key) {
    const match = bedsParam.value.key.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
}

function extractBathrooms(params: OLXListing["params"]): number | undefined {
  const bathsParam = params.find((p) => p.key === "bathrooms" || p.key === "casas_banho");
  if (bathsParam?.value?.key) {
    const match = bathsParam.value.key.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
}

function buildPhotoUrl(photo: OLXListing["photos"][0], width = 800, height = 600): string {
  // OLX uses templated URLs with {width} and {height} placeholders
  return photo.link.replace("{width}", String(width)).replace("{height}", String(height));
}

function mapOLXListingToListing(olxListing: OLXListing): Listing {
  const price = extractPrice(olxListing.params);
  const area = extractArea(olxListing.params);
  const beds = extractBedrooms(olxListing.params);
  const baths = extractBathrooms(olxListing.params);

  const cityName = olxListing.location?.city?.name || "";
  const regionName = olxListing.location?.region?.name || "";
  const address = [cityName, regionName].filter(Boolean).join(", ");

  return {
    id: `olx-${olxListing.id}`,
    sourceSite: "OLX",
    sourceUrl: olxListing.url,
    title: olxListing.title,
    priceEur: price,
    currency: "EUR",
    beds,
    baths,
    areaSqm: area,
    address,
    city: cityName || regionName,
    lat: olxListing.map?.lat,
    lng: olxListing.map?.lon,
    propertyType: olxListing.category?.type,
    description: olxListing.description?.replace(/<[^>]*>/g, " ").slice(0, 500),
    photos: olxListing.photos.map((p) => buildPhotoUrl(p)),
    lastSeenAt: olxListing.last_refresh_time || olxListing.created_time,
  };
}

async function fetchOLXListings(
  categoryId: number,
  options: {
    regionId?: number;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<OLXApiResponse> {
  const params = new URLSearchParams();
  params.set("category_id", String(categoryId));
  params.set("limit", String(options.limit || 40));

  if (options.offset) {
    params.set("offset", String(options.offset));
  }
  if (options.regionId) {
    params.set("region_id", String(options.regionId));
  }
  if (options.minPrice) {
    params.set("filter_float_price:from", String(options.minPrice));
  }
  if (options.maxPrice) {
    params.set("filter_float_price:to", String(options.maxPrice));
  }

  const url = `https://www.olx.pt/api/v1/offers?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; AIPA/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`OLX API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OLXApiResponse>;
}

// Fetch multiple pages of listings
async function fetchOLXListingsMultiPage(
  categoryId: number,
  options: {
    regionId?: number;
    minPrice?: number;
    maxPrice?: number;
    maxListings?: number;
    maxPages?: number;
  } = {}
): Promise<OLXListing[]> {
  const maxListings = options.maxListings || 200;
  const maxPages = options.maxPages || 5;
  const perPage = 40;
  
  const allListings: OLXListing[] = [];
  let offset = 0;
  let page = 0;
  
  while (allListings.length < maxListings && page < maxPages) {
    try {
      console.log(`[OLX] Fetching page ${page + 1} (offset: ${offset})...`);
      
      const response = await fetchOLXListings(categoryId, {
        regionId: options.regionId,
        minPrice: options.minPrice,
        maxPrice: options.maxPrice,
        limit: perPage,
        offset,
      });
      
      if (!response.data || response.data.length === 0) {
        console.log(`[OLX] No more listings found at offset ${offset}`);
        break;
      }
      
      allListings.push(...response.data);
      console.log(`[OLX] Got ${response.data.length} listings, total: ${allListings.length}`);
      
      // Check if there are more pages
      if (!response.links?.next || response.data.length < perPage) {
        break;
      }
      
      offset += perPage;
      page++;
      
      // Small delay between requests to be nice to the API
      await new Promise(r => setTimeout(r, 300));
      
    } catch (error) {
      console.error(`[OLX] Error fetching page ${page + 1}:`, error);
      break;
    }
  }
  
  console.log(`[OLX] Fetched ${allListings.length} total listings from ${page + 1} pages`);
  return allListings;
}

export const adapter: SiteAdapter = {
  siteId: "olx",
  siteName: "OLX",
  searchListings: async (context: SearchContext): Promise<Listing[]> => {
    try {
      const categoryId = mapPropertyType(context);
      const regionId = findRegionId(context.userLocation);

      // Fetch multiple pages of listings
      const olxListings = await fetchOLXListingsMultiPage(categoryId, {
        regionId,
        minPrice: context.priceRange?.min,
        maxPrice: context.priceRange?.max,
        maxListings: 200, // Get up to 200 listings
        maxPages: 5,      // From up to 5 pages
      });

      const listings = olxListings.map(mapOLXListingToListing);

      // Filter by price if specified (as backup in case API filter fails)
      return listings.filter((listing) => {
        if (context.priceRange?.min && listing.priceEur < context.priceRange.min) {
          return false;
        }
        if (context.priceRange?.max && listing.priceEur > context.priceRange.max) {
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error("[OLX Adapter] Error fetching listings:", error);
      return [];
    }
  },
};
