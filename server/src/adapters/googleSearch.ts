import type { Listing } from "../domain/listing";
import type { SearchContext, SiteAdapter } from "./base";
import { GOOGLE_SEARCH } from "../config";

// Google Custom Search API configuration
const GOOGLE_API_KEY = GOOGLE_SEARCH.apiKey;
const SEARCH_ENGINE_ID = GOOGLE_SEARCH.searchEngineId;

// Property sites to search across
const PROPERTY_SITES = [
  "idealista.pt",
  "imovirtual.com", 
  "casasapo.pt",
  "supercasa.pt",
  "remax.pt",
  "era.pt",
  "century21.pt",
];

interface GoogleSearchResult {
  kind: string;
  title: string;
  htmlTitle: string;
  link: string;
  displayLink: string;
  snippet: string;
  htmlSnippet: string;
  pagemap?: {
    cse_image?: Array<{ src: string }>;
    cse_thumbnail?: Array<{ src: string; width: string; height: string }>;
    metatags?: Array<Record<string, string>>;
  };
}

interface GoogleSearchResponse {
  kind: string;
  items?: GoogleSearchResult[];
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Build search query with site restrictions
 */
const buildSearchQuery = (context: SearchContext): string => {
  const { query, priceRange, propertyType } = context;
  
  // Site restriction: search across all property sites
  const siteQuery = PROPERTY_SITES.map(site => `site:${site}`).join(" OR ");
  
  // Build the main query
  let searchQuery = query;
  
  // Add property type if specified
  if (propertyType) {
    const typeTerms: Record<string, string> = {
      apartment: "apartamento",
      house: "moradia casa",
      land: "terreno",
      villa: "vivenda",
      farm: "quinta",
      commercial: "comercial loja escritório",
    };
    searchQuery += ` ${typeTerms[propertyType] || propertyType}`;
  }
  
  // Add price hints to help Google find relevant results
  if (priceRange.max) {
    searchQuery += ` até €${priceRange.max}`;
  }
  if (priceRange.min) {
    searchQuery += ` desde €${priceRange.min}`;
  }
  
  // Combine with site restriction
  return `(${siteQuery}) ${searchQuery}`;
};

/**
 * Extract price from Google result snippet or title
 */
const extractPrice = (result: GoogleSearchResult): number | null => {
  const text = `${result.title} ${result.snippet}`;
  
  // Match various price formats: €150.000, 150.000€, 150,000€, €150000
  const pricePatterns = [
    /€\s*([\d.,]+)/g,
    /([\d.,]+)\s*€/g,
    /EUR\s*([\d.,]+)/gi,
    /([\d.,]+)\s*EUR/gi,
  ];
  
  for (const pattern of pricePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const priceStr = match[1]
        .replace(/\./g, "") // Remove thousand separators (European format)
        .replace(/,/g, "."); // Convert decimal comma to dot
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 100 && price < 100000000) {
        return price;
      }
    }
  }
  
  return null;
};

/**
 * Extract location from result
 */
const extractLocation = (result: GoogleSearchResult): string | undefined => {
  // Try to get location from URL or snippet
  const urlParts = result.link.split("/");
  
  // Idealista URLs: /comprar-casas/lisboa/
  // Imovirtual URLs: /anuncio/lisboa/
  const locationKeywords = [
    "lisboa", "porto", "faro", "braga", "coimbra", "setúbal", "setubal",
    "aveiro", "leiria", "santarém", "santarem", "évora", "evora", "beja",
    "algarve", "cascais", "sintra", "almada", "oeiras", "amadora",
  ];
  
  for (const part of urlParts) {
    const normalized = part.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const keyword of locationKeywords) {
      if (normalized.includes(keyword)) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
    }
  }
  
  return undefined;
};

/**
 * Detect which site the result is from
 */
const detectSourceSite = (url: string): string => {
  if (url.includes("idealista")) return "idealista";
  if (url.includes("imovirtual")) return "imovirtual";
  if (url.includes("casasapo")) return "casasapo";
  if (url.includes("supercasa")) return "supercasa";
  if (url.includes("remax")) return "remax";
  if (url.includes("era.pt")) return "era";
  if (url.includes("century21")) return "century21";
  return "google";
};

/**
 * Convert Google search result to Listing format
 */
const toListingFromGoogle = (result: GoogleSearchResult): Listing | null => {
  const price = extractPrice(result);
  const sourceSite = detectSourceSite(result.link);
  
  // Get image if available
  const image = result.pagemap?.cse_image?.[0]?.src || 
                result.pagemap?.cse_thumbnail?.[0]?.src;
  
  return {
    id: `google-${sourceSite}-${Buffer.from(result.link).toString("base64").slice(0, 20)}`,
    sourceSite,
    sourceUrl: result.link,
    title: result.title.replace(/ - .*$/, "").trim(), // Remove site name suffix
    priceEur: price || 0,
    currency: "EUR",
    description: result.snippet,
    city: extractLocation(result),
    address: extractLocation(result),
    photos: image ? [image] : [],
    lastSeenAt: new Date().toISOString(),
    propertyType: undefined, // Hard to detect from Google results
    listingType: undefined, // Will be detected by searchService
  };
};

/**
 * Search Google Custom Search API
 */
const searchGoogle = async (context: SearchContext): Promise<Listing[]> => {
  // If no Search Engine ID is configured, skip Google search
  if (!SEARCH_ENGINE_ID) {
    console.log("[GoogleSearch] ⚠️ No Search Engine ID configured - skipping Google search");
    console.log("[GoogleSearch] Set GOOGLE_SEARCH_ENGINE_ID env var to enable");
    return [];
  }

  const query = buildSearchQuery(context);
  console.log(`[GoogleSearch] 🔍 Searching: "${query}"`);

  try {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", GOOGLE_API_KEY);
    url.searchParams.set("cx", SEARCH_ENGINE_ID);
    url.searchParams.set("q", query);
    url.searchParams.set("num", "10"); // Max 10 results per request
    url.searchParams.set("gl", "pt"); // Geolocation: Portugal
    url.searchParams.set("lr", "lang_pt|lang_en"); // Language: Portuguese or English

    const response = await fetch(url.toString());
    const data: GoogleSearchResponse = await response.json();

    if (data.error) {
      console.error(`[GoogleSearch] ❌ API Error: ${data.error.message}`);
      return [];
    }

    if (!data.items || data.items.length === 0) {
      console.log("[GoogleSearch] No results found");
      return [];
    }

    console.log(`[GoogleSearch] ✅ Found ${data.items.length} results`);

    // Convert to listings
    const listings: Listing[] = [];
    for (const result of data.items) {
      const listing = toListingFromGoogle(result);
      if (listing) {
        listings.push(listing);
      }
    }

    console.log(`[GoogleSearch] 📋 Converted ${listings.length} valid listings`);
    return listings;

  } catch (error) {
    console.error("[GoogleSearch] ❌ Error:", error);
    return [];
  }
};

export const adapter: SiteAdapter = {
  siteId: "google",
  siteName: "Google Property Search",
  searchListings: searchGoogle,
};
