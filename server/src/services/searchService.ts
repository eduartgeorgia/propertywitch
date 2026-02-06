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

  // AI Relevance Filtering: Analyze each listing's title, description, and photos
  // to determine if it truly matches what the user is looking for
  
  // Extract visual features from query (e.g., "sea view", "pool", "forest")
  const requestedVisualFeatures = extractImageFeatureQuery(request.query);
  if (requestedVisualFeatures.length > 0) {
    console.log(`[Search] Detected visual features in query: ${requestedVisualFeatures.join(", ")}`);
  }
  
  const listingsForAnalysis = filtered.map(({ listing, distance }) => {
    // Check if listing has pre-analyzed image features
    const imageFeatures = (listing as any).imageFeatures as ImageFeature[] | undefined;
    
    // Calculate visual feature match score
    let visualFeatureScore = 0;
    let visualMatchedFeatures: string[] = [];
    
    if (requestedVisualFeatures.length > 0) {
      // Check pre-analyzed image features
      if (imageFeatures && imageFeatures.length > 0) {
        const match = matchesFeatureQuery(imageFeatures, requestedVisualFeatures);
        visualFeatureScore = match.score * 30; // Up to 30 bonus points
        visualMatchedFeatures = match.matchedFeatures;
      }
      
      // Also check title and description for visual feature keywords
      const textContent = `${listing.title} ${listing.description || ''}`.toLowerCase();
      const textMatches: string[] = [];
      
      // Feature keyword mapping for text matching
      const featureTextPatterns: Record<string, RegExp> = {
        sea: /\b(mar|sea|ocean|vista\s*mar|sea\s*view|ocean\s*view|frente\s*mar|praia|beach)\b/i,
        ocean: /\b(ocean|oceano|ocean\s*view|vista\s*oceano)\b/i,
        pool: /\b(piscina|pool|swimming)\b/i,
        forest: /\b(floresta|forest|arborizado|trees|árvores|bosque)\b/i,
        mountain: /\b(montanha|mountain|serra|vista\s*montanha|mountain\s*view)\b/i,
        garden: /\b(jardim|garden|quintal)\b/i,
        river: /\b(rio|river|ribeira|riverside)\b/i,
        ruins: /\b(ruína|ruins?|abandonad[oa]|para\s*reconstruir|para\s*recuperar)\b/i,
        modern: /\b(modern[oa]?|contemporary|contemporâne[oa])\b/i,
        traditional: /\b(tradicional|traditional|típic[oa]|rústic[oa]|rustic)\b/i,
        vineyard: /\b(vinha|vineyard|vinícola|vinho)\b/i,
        terrace: /\b(terraço|terrace|varanda)\b/i,
        balcony: /\b(varanda|balcon[y]?|sacada)\b/i,
        parking: /\b(estacionamento|parking|garagem|garage)\b/i,
        rural: /\b(rural|campo|countryside|isolad[oa])\b/i,
      };
      
      for (const feature of requestedVisualFeatures) {
        const pattern = featureTextPatterns[feature];
        if (pattern && pattern.test(textContent)) {
          textMatches.push(feature);
        }
      }
      
      // Add text match bonus (up to 20 points)
      if (textMatches.length > 0) {
        const textMatchScore = (textMatches.length / requestedVisualFeatures.length) * 20;
        visualFeatureScore = Math.max(visualFeatureScore, visualFeatureScore + textMatchScore);
        visualMatchedFeatures = [...new Set([...visualMatchedFeatures, ...textMatches])];
      }
    }
    
    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      photos: listing.photos,
      priceEur: listing.priceEur,
      areaSqm: listing.areaSqm,
      propertyType: listing.propertyType,
      city: listing.city,
      locationLabel: listing.city ?? listing.address ?? "Portugal",
      // Visual feature data
      visualFeatureScore,
      visualMatchedFeatures,
      requestedVisualFeatures,
      // Keep original data for later
      _original: listing,
      _distance: distance,
    };
  });

  // Get AI-filtered relevant listings
  const relevantListings = await getRelevantListings(request.query, listingsForAnalysis);

  // Smart Vision Analysis: Only trigger if visual features requested but NOT found in text
  // This saves API calls by only analyzing photos when text doesn't have the info
  let visionAnalyzedCount = 0;
  if (requestedVisualFeatures.length > 0) {
    const visionStatus = getVisionServiceStatus();
    
    // Find listings that match other criteria but have NO text matches for visual features
    const needsVisionAnalysis = relevantListings.filter(({ listing }) => {
      const visualScore = (listing as any).visualFeatureScore || 0;
      const hasPhoto = listing.photos && listing.photos.length > 0;
      // Only analyze if: has photo, no text match, and relevance score is decent
      return hasPhoto && visualScore === 0;
    });
    
    if (needsVisionAnalysis.length > 0 && visionStatus.available) {
      console.log(`[Search] Vision AI: ${needsVisionAnalysis.length} listings need photo analysis (no text matches)`);
      
      // Limit vision analysis to top candidates (max 5 to keep search fast)
      const maxVisionAnalysis = 5;
      const toAnalyze = needsVisionAnalysis.slice(0, maxVisionAnalysis);
      
      for (const { listing } of toAnalyze) {
        try {
          const photoUrl = listing.photos[0];
          console.log(`[Search] Vision AI: Analyzing photo for "${listing.title.substring(0, 40)}..."`);
          
          const analysis = await analyzeImage(photoUrl);
          if (analysis && analysis.features.length > 0) {
            // Check if vision detected the requested features
            const match = matchesFeatureQuery(analysis.features, requestedVisualFeatures);
            if (match.matches) {
              // Update the listing's visual score
              (listing as any).visualFeatureScore = match.score * 30;
              (listing as any).visualMatchedFeatures = match.matchedFeatures;
              (listing as any).visionAnalyzed = true;
              visionAnalyzedCount++;
              console.log(`[Search] Vision AI: Found ${match.matchedFeatures.join(", ")} in photo!`);
            }
          }
        } catch (error) {
          console.error(`[Search] Vision AI error:`, error);
        }
      }
      
      if (visionAnalyzedCount > 0) {
        console.log(`[Search] Vision AI: ${visionAnalyzedCount} listings matched via photo analysis`);
      }
    } else if (needsVisionAnalysis.length > 0 && !visionStatus.available) {
      console.log(`[Search] Vision AI not available, skipping photo analysis`);
    }
  }

  // Boost listings that match visual features and sort by combined score
  const sortedListings = relevantListings
    .map(({ listing, relevance }) => {
      const visualScore = (listing as any).visualFeatureScore || 0;
      const visualMatches = (listing as any).visualMatchedFeatures || [];
      const combinedScore = relevance.relevanceScore + visualScore;
      
      // Enhance reasoning with visual feature info
      let enhancedReasoning = relevance.reasoning;
      if (visualMatches.length > 0) {
        enhancedReasoning += ` [Visual matches: ${visualMatches.join(", ")}]`;
      }
      
      return {
        listing,
        relevance: {
          ...relevance,
          relevanceScore: Math.min(100, combinedScore), // Cap at 100
          reasoning: enhancedReasoning,
        },
        visualScore,
      };
    })
    .sort((a, b) => b.relevance.relevanceScore - a.relevance.relevanceScore);

  // If visual features were requested, prioritize listings with matches
  let finalListings = sortedListings;
  if (requestedVisualFeatures.length > 0) {
    // Separate listings with visual matches from those without
    const withVisualMatch = sortedListings.filter(l => l.visualScore > 0);
    const withoutVisualMatch = sortedListings.filter(l => l.visualScore === 0);
    
    // Put visual matches first, then others
    finalListings = [...withVisualMatch, ...withoutVisualMatch];
    
    if (withVisualMatch.length > 0) {
      console.log(`[Search] ${withVisualMatch.length} listings match visual features (${requestedVisualFeatures.join(", ")})`);
    } else {
      console.log(`[Search] No listings found with exact visual feature matches, showing best available`);
    }
  }

  // Convert to response format with AI relevance scores
  const responseListings = finalListings.map(({ listing, relevance }) => {
    const visionAnalyzed = (listing as any).visionAnalyzed || false;
    const visualMatchedFeatures = (listing as any).visualMatchedFeatures || [];
    
    return toCard(
      listing._original as Listing, 
      listing._distance, 
      relevance.relevanceScore,
      relevance.reasoning,
      visionAnalyzed,
      visualMatchedFeatures
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
  const visualFeatureLabel = requestedVisualFeatures.length > 0 
    ? ` with ${requestedVisualFeatures.join(", ")}` 
    : '';
  
  // Count how many have visual matches
  const visualMatchCount = finalListings.filter(l => l.visualScore > 0).length;
  
  let note =
    matchType === "exact"
      ? aiFilteredCount > 0 
        ? `Found ${finalListings.length} ${listingTypeLabel} listings${visualFeatureLabel}${aiFilteredCount > 0 ? ` (filtered from ${filtered.length})` : ''}.`
        : `Showing ${finalListings.length} ${listingTypeLabel} listings${visualFeatureLabel}.`.trim()
      : aiFilteredCount > 0
        ? `AI analyzed ${filtered.length} near-miss results, showing ${finalListings.length} most relevant ${listingTypeLabel}${visualFeatureLabel}.`
        : `No exact matches. Showing ${finalListings.length} closest ${listingTypeLabel}${visualFeatureLabel} matches.`.trim();
  
  // Add visual feature match info
  if (requestedVisualFeatures.length > 0 && visualMatchCount > 0) {
    note += ` ${visualMatchCount} listings mention these features.`;
  }
  
  // Add vision analysis info
  if (visionAnalyzedCount > 0) {
    note += ` 🔍 AI analyzed ${visionAnalyzedCount} photos to find matches.`;
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
    detectedVisualFeatures: requestedVisualFeatures.length > 0 ? requestedVisualFeatures : undefined,
  };
};
