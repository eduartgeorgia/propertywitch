"use strict";
/**
 * Training Service - Bulk fetch and index listings for RAG
 * Used to train the AI on property listings from specific sources/locations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrainingProgress = getTrainingProgress;
exports.trainOnOLXListings = trainOnOLXListings;
exports.getAvailableCities = getAvailableCities;
exports.getAvailableCategories = getAvailableCategories;
const index_1 = require("./rag/index");
// OLX API configuration
// Main real estate category - fetches ALL property types
const OLX_MAIN_CATEGORY = 16; // Imóveis (Real Estate)
// Sub-categories discovered from API (for reference)
const OLX_SUB_CATEGORIES = {
    APARTAMENTOS_VENDA: 4777, // Apartments for sale
    APARTAMENTOS_ARRENDAR: 4779, // Apartments for rent
    MORADIAS_VENDA: 4781, // Houses for sale
    MORADIAS_ARRENDAR: 4783, // Houses for rent
    QUARTOS: 4785, // Rooms
    TERRENOS: 4795, // Land
    LOJAS: 4789, // Shops/Commercial
    ESCRITORIOS: 4791, // Offices
    ARMAZENS: 4793, // Warehouses
    GARAGENS: 4787, // Garages
    OUTROS: 5212, // Other real estate
};
const OLX_REGIONS = {
    porto: 13,
    lisboa: 11,
    faro: 8,
    braga: 3,
    coimbra: 6,
    aveiro: 1,
    setubal: 15,
    leiria: 10,
    santarem: 14,
    evora: 7,
};
function extractPrice(params) {
    const priceParam = params.find((p) => p.key === "price");
    return priceParam?.value?.value || 0;
}
function extractArea(params) {
    const areaKeys = ["m", "area", "area_de_terreno_m2", "area_util"];
    for (const key of areaKeys) {
        const areaParam = params.find((p) => p.key === key);
        if (areaParam?.value?.key) {
            const parsed = parseFloat(areaParam.value.key.replace(/[^\d.]/g, ""));
            if (!isNaN(parsed))
                return parsed;
        }
    }
    return undefined;
}
function extractBedrooms(params) {
    const bedsParam = params.find((p) => p.key === "rooms" || p.key === "quartos" || p.key === "t");
    if (bedsParam?.value?.key) {
        const match = bedsParam.value.key.match(/(\d+)/);
        if (match)
            return parseInt(match[1], 10);
    }
    return undefined;
}
function extractBathrooms(params) {
    const bathsParam = params.find((p) => p.key === "bathrooms" || p.key === "casas_banho");
    if (bathsParam?.value?.key) {
        const match = bathsParam.value.key.match(/(\d+)/);
        if (match)
            return parseInt(match[1], 10);
    }
    return undefined;
}
function buildPhotoUrl(photo) {
    return photo.link.replace("{width}", "800").replace("{height}", "600");
}
function mapOLXToListing(olx) {
    return {
        id: `olx-${olx.id}`,
        sourceSite: "OLX",
        sourceUrl: olx.url,
        title: olx.title,
        priceEur: extractPrice(olx.params),
        currency: "EUR",
        beds: extractBedrooms(olx.params),
        baths: extractBathrooms(olx.params),
        areaSqm: extractArea(olx.params),
        address: [olx.location?.city?.name, olx.location?.region?.name].filter(Boolean).join(", "),
        city: olx.location?.city?.name || olx.location?.region?.name || "",
        lat: olx.map?.lat,
        lng: olx.map?.lon,
        propertyType: olx.category?.type,
        description: olx.description?.replace(/<[^>]*>/g, " ").slice(0, 1000),
        photos: olx.photos.map(buildPhotoUrl),
        lastSeenAt: olx.last_refresh_time || olx.created_time,
    };
}
async function fetchOLXPage(categoryId, regionId, offset = 0, limit = 40) {
    const params = new URLSearchParams({
        category_id: String(categoryId),
        region_id: String(regionId),
        limit: String(limit),
        offset: String(offset),
    });
    const url = `https://www.olx.pt/api/v1/offers?${params.toString()}`;
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
    });
    if (!response.ok) {
        throw new Error(`OLX API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
// Store training progress for status queries
let currentTrainingProgress = null;
function getTrainingProgress() {
    return currentTrainingProgress;
}
/**
 * Train the AI on OLX listings from a specific city
 */
async function trainOnOLXListings(city, options = {}) {
    const startTime = Date.now();
    const cityLower = city.toLowerCase();
    const regionId = OLX_REGIONS[cityLower];
    if (!regionId) {
        return {
            success: false,
            source: "OLX",
            location: city,
            listingsFetched: 0,
            listingsIndexed: 0,
            duration: 0,
            error: `Unknown city: ${city}. Available cities: ${Object.keys(OLX_REGIONS).join(", ")}`,
        };
    }
    const categoriesToFetch = options.categories || ["all"];
    const maxListings = options.maxListings || 1000; // OLX limits to 1000 per category
    const startOffset = options.startOffset || 0;
    const allListings = [];
    let totalFetched = 0;
    // Map category names to IDs - use sub-categories for specific types, main category for "all"
    const categoryMap = {
        all: [OLX_MAIN_CATEGORY], // Main real estate category gets everything
        apartments: [OLX_SUB_CATEGORIES.APARTAMENTOS_VENDA, OLX_SUB_CATEGORIES.APARTAMENTOS_ARRENDAR],
        houses: [OLX_SUB_CATEGORIES.MORADIAS_VENDA, OLX_SUB_CATEGORIES.MORADIAS_ARRENDAR],
        rooms: [OLX_SUB_CATEGORIES.QUARTOS],
        land: [OLX_SUB_CATEGORIES.TERRENOS],
        commercial: [OLX_SUB_CATEGORIES.LOJAS, OLX_SUB_CATEGORIES.ESCRITORIOS, OLX_SUB_CATEGORIES.ARMAZENS],
        garages: [OLX_SUB_CATEGORIES.GARAGENS],
    };
    for (const categoryName of categoriesToFetch) {
        const categoryIds = categoryMap[categoryName.toLowerCase()] || [OLX_MAIN_CATEGORY];
        for (const categoryId of categoryIds) {
            let offset = startOffset; // Start from provided offset
            let hasMore = true;
            let pageNum = 1;
            const perCategoryMax = Math.ceil(maxListings / categoryIds.length);
            console.log(`[Training] Fetching ${categoryName} (cat ${categoryId}) from OLX ${city} starting at offset ${startOffset}...`);
            while (hasMore && totalFetched < maxListings) {
                try {
                    // Update progress
                    currentTrainingProgress = {
                        status: "running",
                        source: "OLX",
                        location: city,
                        category: categoryName,
                        totalFetched,
                        totalIndexed: 0,
                        currentPage: pageNum,
                        totalPages: Math.ceil(maxListings / 40),
                    };
                    options.onProgress?.(currentTrainingProgress);
                    const response = await fetchOLXPage(categoryId, regionId, offset, 40);
                    const listings = response.data.map(mapOLXToListing);
                    allListings.push(...listings);
                    totalFetched += listings.length;
                    console.log(`[Training] Page ${pageNum}: fetched ${listings.length} listings (total: ${totalFetched})`);
                    // Check if there are more pages - OLX returns variable results, check for next link
                    hasMore = !!response.links.next && listings.length > 0;
                    // Use the next link's offset if available, otherwise increment
                    if (response.links.next?.href) {
                        const nextUrl = new URL(response.links.next.href);
                        const nextOffset = nextUrl.searchParams.get('offset');
                        offset = nextOffset ? parseInt(nextOffset, 10) : offset + listings.length;
                    }
                    else {
                        offset += listings.length;
                    }
                    pageNum++;
                    // Rate limiting - be nice to OLX
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }
                catch (error) {
                    console.error(`[Training] Error fetching page ${pageNum}:`, error);
                    hasMore = false;
                }
            }
        }
    }
    // Remove duplicates by ID
    const uniqueListings = Array.from(new Map(allListings.map((l) => [l.id, l])).values());
    console.log(`[Training] Fetched ${uniqueListings.length} unique listings from OLX ${city}`);
    // Index listings into RAG
    try {
        currentTrainingProgress = {
            status: "running",
            source: "OLX",
            location: city,
            category: "indexing",
            totalFetched: uniqueListings.length,
            totalIndexed: 0,
            currentPage: 0,
            totalPages: 1,
        };
        await (0, index_1.indexListings)(uniqueListings);
        currentTrainingProgress = {
            status: "completed",
            source: "OLX",
            location: city,
            category: "all",
            totalFetched: uniqueListings.length,
            totalIndexed: uniqueListings.length,
            currentPage: 0,
            totalPages: 0,
        };
        const duration = Date.now() - startTime;
        console.log(`[Training] Successfully indexed ${uniqueListings.length} listings in ${duration}ms`);
        return {
            success: true,
            source: "OLX",
            location: city,
            listingsFetched: uniqueListings.length,
            listingsIndexed: uniqueListings.length,
            duration,
        };
    }
    catch (error) {
        currentTrainingProgress = {
            status: "error",
            source: "OLX",
            location: city,
            category: "indexing",
            totalFetched: uniqueListings.length,
            totalIndexed: 0,
            currentPage: 0,
            totalPages: 0,
            error: String(error),
        };
        return {
            success: false,
            source: "OLX",
            location: city,
            listingsFetched: uniqueListings.length,
            listingsIndexed: 0,
            duration: Date.now() - startTime,
            error: String(error),
        };
    }
}
/**
 * Get available cities for training
 */
function getAvailableCities() {
    return Object.keys(OLX_REGIONS);
}
/**
 * Get available categories for training
 */
function getAvailableCategories() {
    return ["all", "land", "apartments", "houses", "rooms", "commercial"];
}
