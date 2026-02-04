import crypto from "node:crypto";
import { APP_CONFIG, MATCH_RULES } from "../config";
import { SITE_POLICIES } from "../config/sitePolicies";
import type { Listing } from "../domain/listing";
import type { SearchRequest, SearchResponse, PriceRange } from "../types/api";
import { buildNearMissPriceRange, buildStrictPriceRange } from "../utils/priceRange";
import { formatCurrency, guessCurrency, toEur } from "./currencyService";
import { withinRadius, computeDistanceKm } from "./geoService";
import { diagnoseSite } from "./diagnosticsService";
import { ADAPTERS } from "../adapters/registry";
import { mockAdapter } from "../adapters/mock";
import { parseUserQuery } from "./queryParser";
import { saveSearch } from "../storage/searchStore";
import { getRelevantListings } from "./aiService";

const adapterById = new Map(ADAPTERS.map((adapter) => [adapter.siteId, adapter]));

/**
 * Detect if a listing is for sale or rent based on its content
 */
const detectListingType = (listing: Listing): 'sale' | 'rent' | undefined => {
  const title = listing.title.toLowerCase();
  const desc = (listing.description || '').toLowerCase();
  const combined = `${title} ${desc}`;
  
  // Rent indicators
  const rentKeywords = /arrendar|alugar|aluguer|rent|arrendamento|por mês|per month|\/mês|\/month|mensal|monthly/.test(combined);
  const lowPrice = listing.priceEur > 0 && listing.priceEur < 5000;
  
  // Sale indicators  
  const saleKeywords = /venda|vender|à venda|for sale|compra|comprar|sale/.test(combined);
  const highPrice = listing.priceEur >= 30000;
  
  if (listing.listingType) {
    return listing.listingType;
  } else if (rentKeywords || (lowPrice && !saleKeywords && !highPrice)) {
    return 'rent';
  } else if (saleKeywords || highPrice) {
    return 'sale';
  }
  return undefined;
};

const convertIntentToEur = (intent: ReturnType<typeof parseUserQuery>["priceIntent"], fallbackCurrency: string) => {
  const currency = intent.type === "none" ? fallbackCurrency : intent.currency ?? fallbackCurrency;
  switch (intent.type) {
    case "under":
      return { ...intent, max: toEur(intent.max, currency), currency: "EUR" };
    case "over":
      return { ...intent, min: toEur(intent.min, currency), currency: "EUR" };
    case "between":
      return {
        ...intent,
        min: toEur(intent.min, currency),
        max: toEur(intent.max, currency),
        currency: "EUR",
      };
    case "exact":
    case "around":
      return { ...intent, target: toEur(intent.target, currency), currency: "EUR" };
    default:
      return intent;
  }
};

const filterListings = (
  listings: Listing[],
  priceRange: PriceRange,
  radiusKm: number,
  userLat: number,
  userLng: number
) => {
  return listings
    .map((listing) => {
      let distance: number | undefined;
      if (listing.lat !== undefined && listing.lng !== undefined) {
        distance = computeDistanceKm(
          { lat: userLat, lng: userLng },
          { lat: listing.lat, lng: listing.lng }
        );
      }
      return { listing, distance };
    })
    .filter(({ listing, distance }) => {
      const withinPrice =
        (priceRange.min === undefined || listing.priceEur >= priceRange.min) &&
        (priceRange.max === undefined || listing.priceEur <= priceRange.max);
      const withinGeo =
        distance === undefined || withinRadius(
          { lat: userLat, lng: userLng },
          { lat: listing.lat ?? userLat, lng: listing.lng ?? userLng },
          radiusKm
        );
      return withinPrice && withinGeo;
    })
    .map(({ listing, distance }) => ({ listing, distance }));
};

const toCard = (listing: Listing, distanceKm?: number, relevanceScore?: number, relevanceReasoning?: string) => {
  // Detect if listing is for sale or rent based on title, description, and price
  const title = listing.title.toLowerCase();
  const desc = (listing.description || '').toLowerCase();
  const combined = `${title} ${desc}`;
  
  // Rent indicators
  const rentKeywords = /arrendar|alugar|aluguer|rent|arrendamento|por mês|per month|\/mês|\/month|mensal|monthly/.test(combined);
  const lowPrice = listing.priceEur > 0 && listing.priceEur < 5000;
  
  // Sale indicators
  const saleKeywords = /venda|vender|à venda|for sale|compra|comprar|sale/.test(combined);
  const highPrice = listing.priceEur >= 30000;
  
  // Determine listing type
  let listingType: 'sale' | 'rent' | undefined;
  if (listing.listingType) {
    listingType = listing.listingType;
  } else if (rentKeywords || (lowPrice && !saleKeywords && !highPrice)) {
    listingType = 'rent';
  } else if (saleKeywords || highPrice) {
    listingType = 'sale';
  }
  
  // Detect property type if not set
  let propertyType = listing.propertyType;
  if (!propertyType || propertyType === 'land') {
    const isRoom = /quarto(?!\s+de\s+banho)|room\b/.test(combined) && !/apartamento|moradia|t[1-4]/.test(title);
    const isApartment = /apartamento|apartment|flat|\bt[0-4]\b/.test(combined) && !isRoom;
    const isHouse = /moradia|house|villa|vivenda|quinta/.test(combined) && !isApartment;
    const isLand = /terreno|land|lote|plot|rústico/.test(combined);
    
    if (isRoom) propertyType = 'Room';
    else if (isApartment) propertyType = 'Apartment';
    else if (isHouse) propertyType = 'House';
    else if (isLand) propertyType = 'Land';
  }
  
  return {
    id: listing.id,
    title: listing.title,
    priceEur: listing.priceEur,
    displayPrice: formatCurrency(listing.priceEur, "EUR") + (listingType === 'rent' ? '/mo' : ''),
    locationLabel: listing.city ?? listing.address ?? "Portugal",
    beds: listing.beds,
    baths: listing.baths,
    areaSqm: listing.areaSqm,
    image: listing.photos[0],
    sourceSite: listing.sourceSite,
    sourceUrl: listing.sourceUrl,
    distanceKm,
    matchScore: relevanceScore ?? 0,
    aiReasoning: relevanceReasoning,
    listingType,
    propertyType,
  };
};

const runAdapterSearch = async (query: SearchRequest, priceRange: PriceRange, propertyType?: string) => {
  const adapters = APP_CONFIG.mockData ? [mockAdapter] : ADAPTERS;
  
  // Run adapters sequentially to share browser instance properly
  const results: Listing[] = [];
  for (const adapter of adapters) {
    try {
      const listings = await adapter.searchListings({
        query: query.query,
        priceRange,
        userLocation: query.userLocation,
        propertyType,
      });
      results.push(...listings);
    } catch (error) {
      console.error(`[Search] ${adapter.siteId} adapter failed:`, error);
    }
  }
  return results;
};

export const runSearch = async (request: SearchRequest): Promise<SearchResponse> => {
  const parsed = parseUserQuery(request.query);
  const inferredCurrency = guessCurrency(request.query) ?? request.userLocation.currency;
  const intentInEur = convertIntentToEur(parsed.priceIntent, inferredCurrency);

  const strictRange = buildStrictPriceRange(intentInEur, "EUR", MATCH_RULES);
  const nearMissRange = buildNearMissPriceRange(intentInEur, "EUR", MATCH_RULES);

  const diagnostics = await Promise.all(SITE_POLICIES.map((policy) => diagnoseSite(policy)));
  const blockedSites = diagnostics
    .filter((diag) => diag.accessMethod === "BYOC" || diag.accessMethod === "NONE")
    .map((diag) => ({
      siteId: diag.siteId,
      siteName: diag.siteName,
      requiredMethod: diag.accessMethod,
      reason: diag.reason,
    }));

  const listings = await runAdapterSearch(request, strictRange, parsed.propertyType);
  let filtered = filterListings(
    listings,
    strictRange,
    MATCH_RULES.strictRadiusKm,
    request.userLocation.lat,
    request.userLocation.lng
  );
  
  // Filter by listing intent (sale vs rent) if specified
  if (parsed.listingIntent) {
    const beforeCount = filtered.length;
    filtered = filtered.filter(({ listing }) => {
      const detectedType = detectListingType(listing);
      // Keep if type matches OR if we couldn't determine the type
      return detectedType === parsed.listingIntent || detectedType === undefined;
    });
    console.log(`[Search] Filtered by ${parsed.listingIntent}: ${beforeCount} → ${filtered.length} listings`);
  }
  
  let matchType: "exact" | "near-miss" = "exact";
  let appliedRange = strictRange;

  if (filtered.length === 0) {
    const nearMissListings = await runAdapterSearch(request, nearMissRange, parsed.propertyType);
    let nearFiltered = filterListings(
      nearMissListings,
      nearMissRange,
      MATCH_RULES.nearMissRadiusKm,
      request.userLocation.lat,
      request.userLocation.lng
    );
    
    // Also filter near-miss by listing intent
    if (parsed.listingIntent) {
      nearFiltered = nearFiltered.filter(({ listing }) => {
        const detectedType = detectListingType(listing);
        return detectedType === parsed.listingIntent || detectedType === undefined;
      });
    }
    
    filtered = nearFiltered;
    matchType = "near-miss";
    appliedRange = nearMissRange;
  }

  // AI Relevance Filtering: Analyze each listing's title, description, and photos
  // to determine if it truly matches what the user is looking for
  const listingsForAnalysis = filtered.map(({ listing, distance }) => ({
    id: listing.id,
    title: listing.title,
    description: listing.description,
    photos: listing.photos,
    priceEur: listing.priceEur,
    areaSqm: listing.areaSqm,
    propertyType: listing.propertyType,
    city: listing.city,
    locationLabel: listing.city ?? listing.address ?? "Portugal",
    // Keep original data for later
    _original: listing,
    _distance: distance,
  }));

  // Get AI-filtered relevant listings
  const relevantListings = await getRelevantListings(request.query, listingsForAnalysis);

  // Convert to response format with AI relevance scores
  const responseListings = relevantListings.map(({ listing, relevance }) => 
    toCard(
      listing._original as Listing, 
      listing._distance, 
      relevance.relevanceScore,
      relevance.reasoning
    )
  );

  const searchId = crypto.randomUUID();

  saveSearch({
    id: searchId,
    createdAt: new Date().toISOString(),
    listings: relevantListings.map(({ listing }) => listing._original as Listing),
  });

  const aiFilteredCount = filtered.length - relevantListings.length;
  const listingTypeLabel = parsed.listingIntent === 'rent' ? 'for rent' : parsed.listingIntent === 'sale' ? 'for sale' : '';
  const note =
    matchType === "exact"
      ? aiFilteredCount > 0 
        ? `Found ${relevantListings.length} ${listingTypeLabel} listings${aiFilteredCount > 0 ? ` (filtered from ${filtered.length})` : ''}.`
        : `Showing ${relevantListings.length} ${listingTypeLabel} listings.`.trim()
      : aiFilteredCount > 0
        ? `AI analyzed ${filtered.length} near-miss results, showing ${relevantListings.length} most relevant ${listingTypeLabel}.`
        : `No exact matches. Showing ${relevantListings.length} closest ${listingTypeLabel} matches.`.trim();

  return {
    searchId,
    matchType,
    note,
    appliedPriceRange: appliedRange,
    appliedRadiusKm: matchType === "exact" ? MATCH_RULES.strictRadiusKm : MATCH_RULES.nearMissRadiusKm,
    listings: responseListings,
    blockedSites,
  };
};
