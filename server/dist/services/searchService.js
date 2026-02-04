"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSearch = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const config_1 = require("../config");
const sitePolicies_1 = require("../config/sitePolicies");
const priceRange_1 = require("../utils/priceRange");
const currencyService_1 = require("./currencyService");
const geoService_1 = require("./geoService");
const diagnosticsService_1 = require("./diagnosticsService");
const registry_1 = require("../adapters/registry");
const mock_1 = require("../adapters/mock");
const queryParser_1 = require("./queryParser");
const searchStore_1 = require("../storage/searchStore");
const aiService_1 = require("./aiService");
const adapterById = new Map(registry_1.ADAPTERS.map((adapter) => [adapter.siteId, adapter]));
/**
 * Detect if a listing is for sale or rent based on its content
 */
const detectListingType = (listing) => {
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
    }
    else if (rentKeywords || (lowPrice && !saleKeywords && !highPrice)) {
        return 'rent';
    }
    else if (saleKeywords || highPrice) {
        return 'sale';
    }
    return undefined;
};
const convertIntentToEur = (intent, fallbackCurrency) => {
    const currency = intent.type === "none" ? fallbackCurrency : intent.currency ?? fallbackCurrency;
    switch (intent.type) {
        case "under":
            return { ...intent, max: (0, currencyService_1.toEur)(intent.max, currency), currency: "EUR" };
        case "over":
            return { ...intent, min: (0, currencyService_1.toEur)(intent.min, currency), currency: "EUR" };
        case "between":
            return {
                ...intent,
                min: (0, currencyService_1.toEur)(intent.min, currency),
                max: (0, currencyService_1.toEur)(intent.max, currency),
                currency: "EUR",
            };
        case "exact":
        case "around":
            return { ...intent, target: (0, currencyService_1.toEur)(intent.target, currency), currency: "EUR" };
        default:
            return intent;
    }
};
const filterListings = (listings, priceRange, radiusKm, userLat, userLng) => {
    return listings
        .map((listing) => {
        let distance;
        if (listing.lat !== undefined && listing.lng !== undefined) {
            distance = (0, geoService_1.computeDistanceKm)({ lat: userLat, lng: userLng }, { lat: listing.lat, lng: listing.lng });
        }
        return { listing, distance };
    })
        .filter(({ listing, distance }) => {
        const withinPrice = (priceRange.min === undefined || listing.priceEur >= priceRange.min) &&
            (priceRange.max === undefined || listing.priceEur <= priceRange.max);
        const withinGeo = distance === undefined || (0, geoService_1.withinRadius)({ lat: userLat, lng: userLng }, { lat: listing.lat ?? userLat, lng: listing.lng ?? userLng }, radiusKm);
        return withinPrice && withinGeo;
    })
        .map(({ listing, distance }) => ({ listing, distance }));
};
const toCard = (listing, distanceKm, relevanceScore, relevanceReasoning) => {
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
    let listingType;
    if (listing.listingType) {
        listingType = listing.listingType;
    }
    else if (rentKeywords || (lowPrice && !saleKeywords && !highPrice)) {
        listingType = 'rent';
    }
    else if (saleKeywords || highPrice) {
        listingType = 'sale';
    }
    // Detect property type if not set
    let propertyType = listing.propertyType;
    if (!propertyType || propertyType === 'land') {
        const isRoom = /quarto(?!\s+de\s+banho)|room\b/.test(combined) && !/apartamento|moradia|t[1-4]/.test(title);
        const isApartment = /apartamento|apartment|flat|\bt[0-4]\b/.test(combined) && !isRoom;
        const isHouse = /moradia|house|villa|vivenda|quinta/.test(combined) && !isApartment;
        const isLand = /terreno|land|lote|plot|rústico/.test(combined);
        if (isRoom)
            propertyType = 'Room';
        else if (isApartment)
            propertyType = 'Apartment';
        else if (isHouse)
            propertyType = 'House';
        else if (isLand)
            propertyType = 'Land';
    }
    return {
        id: listing.id,
        title: listing.title,
        priceEur: listing.priceEur,
        displayPrice: (0, currencyService_1.formatCurrency)(listing.priceEur, "EUR") + (listingType === 'rent' ? '/mo' : ''),
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
const runAdapterSearch = async (query, priceRange, propertyType) => {
    const adapters = config_1.APP_CONFIG.mockData ? [mock_1.mockAdapter] : registry_1.ADAPTERS;
    // Run adapters sequentially to share browser instance properly
    const results = [];
    for (const adapter of adapters) {
        try {
            const listings = await adapter.searchListings({
                query: query.query,
                priceRange,
                userLocation: query.userLocation,
                propertyType,
            });
            results.push(...listings);
        }
        catch (error) {
            console.error(`[Search] ${adapter.siteId} adapter failed:`, error);
        }
    }
    return results;
};
const runSearch = async (request) => {
    const parsed = (0, queryParser_1.parseUserQuery)(request.query);
    const inferredCurrency = (0, currencyService_1.guessCurrency)(request.query) ?? request.userLocation.currency;
    const intentInEur = convertIntentToEur(parsed.priceIntent, inferredCurrency);
    const strictRange = (0, priceRange_1.buildStrictPriceRange)(intentInEur, "EUR", config_1.MATCH_RULES);
    const nearMissRange = (0, priceRange_1.buildNearMissPriceRange)(intentInEur, "EUR", config_1.MATCH_RULES);
    const diagnostics = await Promise.all(sitePolicies_1.SITE_POLICIES.map((policy) => (0, diagnosticsService_1.diagnoseSite)(policy)));
    const blockedSites = diagnostics
        .filter((diag) => diag.accessMethod === "BYOC" || diag.accessMethod === "NONE")
        .map((diag) => ({
        siteId: diag.siteId,
        siteName: diag.siteName,
        requiredMethod: diag.accessMethod,
        reason: diag.reason,
    }));
    const listings = await runAdapterSearch(request, strictRange, parsed.propertyType);
    let filtered = filterListings(listings, strictRange, config_1.MATCH_RULES.strictRadiusKm, request.userLocation.lat, request.userLocation.lng);
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
    let matchType = "exact";
    let appliedRange = strictRange;
    if (filtered.length === 0) {
        const nearMissListings = await runAdapterSearch(request, nearMissRange, parsed.propertyType);
        let nearFiltered = filterListings(nearMissListings, nearMissRange, config_1.MATCH_RULES.nearMissRadiusKm, request.userLocation.lat, request.userLocation.lng);
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
    const relevantListings = await (0, aiService_1.getRelevantListings)(request.query, listingsForAnalysis);
    // Convert to response format with AI relevance scores
    const responseListings = relevantListings.map(({ listing, relevance }) => toCard(listing._original, listing._distance, relevance.relevanceScore, relevance.reasoning));
    const searchId = node_crypto_1.default.randomUUID();
    (0, searchStore_1.saveSearch)({
        id: searchId,
        createdAt: new Date().toISOString(),
        listings: relevantListings.map(({ listing }) => listing._original),
    });
    const aiFilteredCount = filtered.length - relevantListings.length;
    const listingTypeLabel = parsed.listingIntent === 'rent' ? 'for rent' : parsed.listingIntent === 'sale' ? 'for sale' : '';
    const note = matchType === "exact"
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
        appliedRadiusKm: matchType === "exact" ? config_1.MATCH_RULES.strictRadiusKm : config_1.MATCH_RULES.nearMissRadiusKm,
        listings: responseListings,
        blockedSites,
    };
};
exports.runSearch = runSearch;
