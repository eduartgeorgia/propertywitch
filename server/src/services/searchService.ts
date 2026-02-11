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
import { extractImageFeatureQuery, matchesFeatureQuery, analyzeImage, getVisionServiceStatus, type ImageFeature } from "./visionService";

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

const toCard = (
  listing: Listing, 
  distanceKm?: number, 
  relevanceScore?: number, 
  relevanceReasoning?: string,
  visionAnalyzed?: boolean,
  visualMatchedFeatures?: string[]
) => {
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
    photos: listing.photos, // All photos for carousel
    sourceSite: listing.sourceSite,
    sourceUrl: listing.sourceUrl,
    distanceKm,
    matchScore: relevanceScore ?? 0,
    aiReasoning: relevanceReasoning,
    listingType,
    propertyType,
    // Vision AI analysis markers
    visionAnalyzed: visionAnalyzed || false,
    visualFeatures: visualMatchedFeatures && visualMatchedFeatures.length > 0 ? visualMatchedFeatures : undefined,
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

  // ========== AI-DRIVEN SEARCH FLOW ==========
  // 1. Extract visual features from query
  // 2. AI analyzes ALL listing text (title + description) with full comprehension
  // 3. AI determines relevance scores and notes missing visual features
  // 4. Vision AI analyzes photos ONLY when AI says text doesn't confirm visual features
  
  // Step 1: Detect visual feature requests
  const requestedVisualFeatures = extractImageFeatureQuery(request.query);
  const hasVisualFeatureRequest = requestedVisualFeatures.length > 0;
  
  if (hasVisualFeatureRequest) {
    console.log(`[Search] 🔍 Visual features detected in query: ${requestedVisualFeatures.join(", ")}`);
    console.log(`[Search] AI will analyze listing text for these features, then vision AI for photos if needed`);
  }
  
  // Step 2: Prepare listings for AI analysis (with FULL descriptions)
  // LIMIT to 15 listings max for fast responses
  const MAX_LISTINGS = 15;
  const limitedFiltered = filtered.slice(0, MAX_LISTINGS);
  
  const listingsForAnalysis = limitedFiltered.map(({ listing, distance }) => {
    return {
      id: listing.id,
      title: listing.title,
      description: listing.description, // FULL description - AI needs to read this
      photos: listing.photos,
      priceEur: listing.priceEur,
      areaSqm: listing.areaSqm,
      propertyType: listing.propertyType,
      city: listing.city,
      locationLabel: listing.city ?? listing.address ?? "Portugal",
      // Keep original data for later
      _original: listing,
      _distance: distance,
    };
  });

  console.log(`[Search] 🤖 Starting AI analysis of ${listingsForAnalysis.length} listings (limited from ${filtered.length})...`);

  // Step 3: Get AI-filtered relevant listings
  // AI now:
  // - Reads FULL title + description
  // - Understands what's being offered
  // - Checks if visual features are mentioned in text
  // - Notes when features are "not confirmed in text" (triggers vision later)
  const relevantListings = await getRelevantListings(request.query, listingsForAnalysis);
  
  console.log(`[Search] 🤖 AI analyzed ${relevantListings.length} relevant listings from ${listingsForAnalysis.length} total`);

  // Step 4: Smart Vision Analysis
  // Trigger ONLY when:
  // - User requested visual features
  // - AI's reasoning indicates feature "not confirmed in text" / "not mentioned"
  // - Listing has photos to analyze
  let visionAnalyzedCount = 0;
  const visionResults: Map<string, { features: string[], matched: boolean }> = new Map();
  
  if (hasVisualFeatureRequest) {
    const visionStatus = getVisionServiceStatus();
    
    // Find listings where AI said visual features are NOT in the text
    const needsVisionAnalysis = relevantListings.filter(({ listing, relevance }) => {
      const reasoning = relevance.reasoning?.toLowerCase() || '';
      const hasPhoto = listing.photos && listing.photos.length > 0;
      
      // Trigger vision when:
      // 1. AI explicitly says features aren't confirmed in text
      // 2. AI gave a moderate score (could go either way)
      // 3. Listing hasn't been vision-analyzed yet
      const textMissingFeature = 
        reasoning.includes('not confirmed') ||
        reasoning.includes('not mentioned') ||
        reasoning.includes('no mention') ||
        reasoning.includes('photo analysis') ||
        reasoning.includes('check photo') ||
        reasoning.includes('visual feature not') ||
        reasoning.includes('não menciona') ||
        reasoning.includes('sem menção') ||
        // Analyze photos for any listing with moderate score (visual verification helps)
        (relevance.relevanceScore < 85 && relevance.relevanceScore > 25);
      
      return hasPhoto && textMissingFeature;
    });
    
    if (needsVisionAnalysis.length > 0 && visionStatus.available) {
      console.log(`[Search] 👁️ Vision AI: ${needsVisionAnalysis.length} listings need photo analysis (AI found visual features not confirmed in text)`);
      
      // Analyze more photos - vision is key for visual feature searches
      const maxVisionAnalysis = 15; // Analyze up to 15 photos for visual feature queries
      const toAnalyze = needsVisionAnalysis.slice(0, maxVisionAnalysis);
      
      for (const { listing, relevance } of toAnalyze) {
        try {
          const photoUrl = listing.photos[0];
          console.log(`[Search] 👁️ Vision AI: Analyzing photo for "${listing.title.substring(0, 40)}..."`);
          
          const analysis = await analyzeImage(photoUrl);
          if (analysis && analysis.features.length > 0) {
            // Check if vision detected the requested features
            const match = matchesFeatureQuery(analysis.features, requestedVisualFeatures);
            
            // Store vision results
            visionResults.set(listing.id, {
              features: match.matchedFeatures,
              matched: match.matches,
            });
            
            if (match.matches) {
              // Mark listing as vision-analyzed with matches
              (listing as any).visionAnalyzed = true;
              (listing as any).visualMatchedFeatures = match.matchedFeatures;
              (listing as any).visionScore = match.score * 25; // Up to 25 bonus points from vision
              visionAnalyzedCount++;
              console.log(`[Search] 👁️ Vision AI: ✓ Found ${match.matchedFeatures.join(", ")} in photo!`);
            } else {
              // Analyzed but didn't find requested features
              (listing as any).visionAnalyzed = true;
              (listing as any).visualMatchedFeatures = [];
              console.log(`[Search] 👁️ Vision AI: ✗ Requested features not visible in photo`);
            }
          }
        } catch (error) {
          console.error(`[Search] 👁️ Vision AI error:`, error);
        }
      }
      
      if (visionAnalyzedCount > 0) {
        console.log(`[Search] 👁️ Vision AI: ${visionAnalyzedCount}/${toAnalyze.length} listings matched requested visual features via photo analysis`);
      }
    } else if (needsVisionAnalysis.length > 0 && !visionStatus.available) {
      console.log(`[Search] Vision AI not available, skipping photo analysis for ${needsVisionAnalysis.length} candidates`);
    }
  }

  // Step 5: Combine AI text analysis scores with vision results
  const sortedListings = relevantListings
    .map(({ listing, relevance }) => {
      const visionScore = (listing as any).visionScore || 0;
      const visualMatches = (listing as any).visualMatchedFeatures || [];
      const wasVisionAnalyzed = (listing as any).visionAnalyzed || false;
      
      // Combine AI text score with vision bonus
      const combinedScore = Math.min(100, relevance.relevanceScore + visionScore);
      
      // Enhance reasoning with vision info
      let enhancedReasoning = relevance.reasoning || '';
      if (wasVisionAnalyzed && visualMatches.length > 0) {
        enhancedReasoning += ` [📷 Photo confirmed: ${visualMatches.join(", ")}]`;
      } else if (wasVisionAnalyzed && visualMatches.length === 0 && hasVisualFeatureRequest) {
        enhancedReasoning += ` [📷 Photo analyzed: requested features not visible]`;
      }
      
      return {
        listing,
        relevance: {
          ...relevance,
          relevanceScore: combinedScore,
          reasoning: enhancedReasoning,
        },
        visionScore,
        visualMatches,
        wasVisionAnalyzed,
      };
    })
    .sort((a, b) => b.relevance.relevanceScore - a.relevance.relevanceScore);

  // Step 6: Final ordering - prioritize vision-confirmed matches
  let finalListings = sortedListings;
  if (hasVisualFeatureRequest) {
    // Three tiers: 1) Vision confirmed, 2) Text confirmed (high AI score), 3) Others
    const visionConfirmed = sortedListings.filter(l => l.wasVisionAnalyzed && l.visualMatches.length > 0);
    const textConfirmed = sortedListings.filter(l => 
      !l.wasVisionAnalyzed && l.relevance.relevanceScore >= 75
    );
    const others = sortedListings.filter(l => 
      !(l.wasVisionAnalyzed && l.visualMatches.length > 0) && 
      !(l.relevance.relevanceScore >= 75 && !l.wasVisionAnalyzed)
    );
    
    finalListings = [...visionConfirmed, ...textConfirmed, ...others];
    
    console.log(`[Search] 📊 Results: ${visionConfirmed.length} vision-confirmed, ${textConfirmed.length} text-confirmed, ${others.length} other`);
  }

  // STRICT PRICE ENFORCEMENT: Remove any listings outside price range after AI analysis
  if (appliedRange.max || appliedRange.min) {
    const beforeStrictFilter = finalListings.length;
    finalListings = finalListings.filter(({ listing }) => {
      const price = listing.priceEur;
      if (price === null || price === undefined) return true; // Keep listings without price (rare)
      
      // Strict enforcement with a small tolerance for rounding
      const maxPrice = appliedRange.max ? appliedRange.max * 1.01 : Infinity; // 1% tolerance
      const minPrice = appliedRange.min ? appliedRange.min * 0.99 : 0;
      
      const withinRange = price >= minPrice && price <= maxPrice;
      if (!withinRange) {
        console.log(`[Search] 🚫 Price filter removed: €${price} (range: €${appliedRange.min || 0}-€${appliedRange.max || '∞'})`);
      }
      return withinRange;
    });
    
    if (beforeStrictFilter > finalListings.length) {
      console.log(`[Search] 💰 Strict price filter removed ${beforeStrictFilter - finalListings.length} overpriced listings`);
    }
  }

  // Convert to response format with AI relevance scores
  const responseListings = finalListings.map(({ listing, relevance, wasVisionAnalyzed, visualMatches }) => {
    return toCard(
      listing._original as Listing, 
      listing._distance, 
      relevance.relevanceScore,
      relevance.reasoning,
      wasVisionAnalyzed,
      visualMatches
    );
  });

  const searchId = crypto.randomUUID();

  saveSearch({
    id: searchId,
    createdAt: new Date().toISOString(),
    listings: finalListings.map(({ listing }) => listing._original as Listing),
  });

  const aiFilteredCount = filtered.length - finalListings.length;
  const listingTypeLabel = parsed.listingIntent === 'rent' ? 'for rent' : parsed.listingIntent === 'sale' ? 'for sale' : '';
  const visualFeatureLabel = hasVisualFeatureRequest 
    ? ` with ${requestedVisualFeatures.join(", ")}` 
    : '';
  
  // Count statistics
  const visionConfirmedCount = finalListings.filter(l => l.wasVisionAnalyzed && l.visualMatches.length > 0).length;
  const textConfirmedCount = finalListings.filter(l => l.relevance.relevanceScore >= 75).length;
  
  let note =
    matchType === "exact"
      ? aiFilteredCount > 0 
        ? `🤖 AI analyzed ${filtered.length} listings, showing ${finalListings.length} most relevant${visualFeatureLabel}.`
        : `🤖 AI found ${finalListings.length} ${listingTypeLabel} listings${visualFeatureLabel}.`.trim()
      : aiFilteredCount > 0
        ? `🤖 AI analyzed ${filtered.length} near-miss results, showing ${finalListings.length} most relevant${visualFeatureLabel}.`
        : `No exact matches. Showing ${finalListings.length} closest${visualFeatureLabel} matches.`.trim();
  
  // Add visual feature confirmation info
  if (hasVisualFeatureRequest) {
    if (visionConfirmedCount > 0) {
      note += ` 📷 ${visionConfirmedCount} confirmed via photo analysis.`;
    }
    if (textConfirmedCount > 0 && visionConfirmedCount === 0) {
      note += ` ${textConfirmedCount} mention these features in description.`;
    }
  }

  return {
    searchId,
    matchType,
    note,
    appliedPriceRange: appliedRange,
    appliedRadiusKm: matchType === "exact" ? MATCH_RULES.strictRadiusKm : MATCH_RULES.nearMissRadiusKm,
    listings: responseListings,
    blockedSites,
    // Include detected visual features in response
    detectedVisualFeatures: hasVisualFeatureRequest ? requestedVisualFeatures : undefined,
  };
};
