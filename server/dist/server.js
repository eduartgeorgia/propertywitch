var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_express11 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_node_path4 = __toESM(require("node:path"));

// src/config.ts
var import_dotenv = require("dotenv");
var import_node_path = __toESM(require("node:path"));
(0, import_dotenv.config)();
var projectRoot = process.cwd();
var toBool = (value, fallback) => {
  if (value === void 0) return fallback;
  return value === "1" || value.toLowerCase() === "true";
};
var APP_CONFIG = {
  port: Number(process.env.PORT ?? 4e3),
  mockData: toBool(process.env.MOCK_DATA, false),
  // Use real OLX API data
  reportsDir: import_node_path.default.resolve(projectRoot, process.env.REPORTS_DIR ?? "reports")
};
var MATCH_RULES = {
  exactTolerancePercent: 0.02,
  exactToleranceAbsoluteEur: 50,
  nearMissTolerancePercent: 0.1,
  nearMissToleranceAbsoluteEur: 200,
  strictRadiusKm: 50,
  nearMissRadiusKm: 50
};
var FX_RATES = {
  USD_EUR: Number(process.env.FX_RATE_USD_EUR ?? 0.92),
  GBP_EUR: Number(process.env.FX_RATE_GBP_EUR ?? 1.17)
};

// src/routes/search.ts
var import_express = require("express");
var import_zod = require("zod");

// src/services/searchService.ts
var import_node_crypto = __toESM(require("node:crypto"));

// src/config/sitePolicies.ts
var allow = (methods) => {
  return {
    api: methods.includes("API"),
    sitemap: methods.includes("SITEMAP"),
    publicHtml: methods.includes("PUBLIC_HTML"),
    byoc: methods.includes("BYOC")
  };
};
var SITE_POLICIES = [
  {
    id: "olx",
    name: "OLX Portugal",
    baseUrl: "https://www.olx.pt",
    allowed: allow(["API"]),
    order: ["API"]
  }
];

// src/utils/priceRange.ts
var exactDelta = (value, rules) => Math.min(value * rules.exactTolerancePercent, rules.exactToleranceAbsoluteEur);
var nearMissDelta = (value, rules) => Math.max(value * rules.nearMissTolerancePercent, rules.nearMissToleranceAbsoluteEur);
var buildStrictPriceRange = (intent, currency, rules) => {
  switch (intent.type) {
    case "under":
      return { max: intent.max, currency };
    case "over":
      return { min: intent.min, currency };
    case "between":
      return { min: intent.min, max: intent.max, currency };
    case "exact":
    case "around": {
      const delta = exactDelta(intent.target, rules);
      return { min: intent.target - delta, max: intent.target + delta, currency };
    }
    case "none":
    default:
      return { currency };
  }
};
var buildNearMissPriceRange = (intent, currency, rules) => {
  switch (intent.type) {
    case "under": {
      const delta = nearMissDelta(intent.max, rules);
      return { max: intent.max + delta, currency };
    }
    case "over": {
      const delta = nearMissDelta(intent.min, rules);
      return { min: Math.max(0, intent.min - delta), currency };
    }
    case "between": {
      const deltaMin = nearMissDelta(intent.min, rules);
      const deltaMax = nearMissDelta(intent.max, rules);
      return { min: Math.max(0, intent.min - deltaMin), max: intent.max + deltaMax, currency };
    }
    case "exact":
    case "around": {
      const delta = nearMissDelta(intent.target, rules);
      return { min: Math.max(0, intent.target - delta), max: intent.target + delta, currency };
    }
    case "none":
    default:
      return { currency };
  }
};

// src/services/currencyService.ts
var normalize = (currency) => currency.trim().toUpperCase();
var toEur = (amount, currency) => {
  const code = normalize(currency);
  if (code === "EUR") return amount;
  if (code === "USD") return amount * FX_RATES.USD_EUR;
  if (code === "GBP") return amount * FX_RATES.GBP_EUR;
  throw new Error(`Unsupported currency: ${currency}`);
};
var formatCurrency = (amount, currency) => {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
};
var guessCurrency = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes("usd") || lower.includes("$") || lower.includes("us$")) return "USD";
  if (lower.includes("eur") || lower.includes("\u20AC")) return "EUR";
  if (lower.includes("gbp") || lower.includes("\xA3")) return "GBP";
  return void 0;
};

// src/utils/distance.ts
var toRad = (value) => value * Math.PI / 180;
var distanceKm = (lat1, lng1, lat2, lng2) => {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

// src/services/geoService.ts
var computeDistanceKm = (a, b) => distanceKm(a.lat, a.lng, b.lat, b.lng);
var withinRadius = (a, b, radiusKm) => computeDistanceKm(a, b) <= radiusKm;

// src/services/diagnosticsService.ts
var fetchWithTimeout = async (url, timeoutMs = 3500) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PropertyAssistant/0.1; +https://localhost)"
      }
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};
var probeApi = async (policy) => {
  if (policy.id === "olx") {
    try {
      const response = await fetchWithTimeout("https://www.olx.pt/api/v1/offers?limit=1");
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data?.data);
      }
    } catch {
      return false;
    }
  }
  return false;
};
var probeSitemap = async (policy) => {
  try {
    const response = await fetchWithTimeout(`${policy.baseUrl}/sitemap.xml`);
    return response.ok;
  } catch {
    return false;
  }
};
var robotsAllows = async (policy) => {
  try {
    const response = await fetchWithTimeout(`${policy.baseUrl}/robots.txt`);
    if (!response.ok) return false;
    const body = await response.text();
    const lower = body.toLowerCase();
    if (lower.includes("disallow: /")) return false;
    return true;
  } catch {
    return false;
  }
};
var probePublicHtml = async (policy) => {
  const robotsOk = await robotsAllows(policy);
  if (!robotsOk) return false;
  try {
    const response = await fetchWithTimeout(policy.baseUrl);
    return response.ok;
  } catch {
    return false;
  }
};
var diagnoseSite = async (policy) => {
  for (const method of policy.order) {
    if (method === "API" && policy.allowed.api) {
      if (await probeApi(policy)) {
        return {
          siteId: policy.id,
          siteName: policy.name,
          accessMethod: "API",
          requiresUserSession: false,
          reason: "API access available"
        };
      }
    }
    if (method === "SITEMAP" && policy.allowed.sitemap) {
      if (await probeSitemap(policy)) {
        return {
          siteId: policy.id,
          siteName: policy.name,
          accessMethod: "SITEMAP",
          requiresUserSession: false,
          reason: "Sitemap accessible"
        };
      }
    }
    if (method === "PUBLIC_HTML" && policy.allowed.publicHtml) {
      if (await probePublicHtml(policy)) {
        return {
          siteId: policy.id,
          siteName: policy.name,
          accessMethod: "PUBLIC_HTML",
          requiresUserSession: false,
          reason: "Public HTML allowed"
        };
      }
    }
    if (method === "BYOC" && policy.allowed.byoc) {
      return {
        siteId: policy.id,
        siteName: policy.name,
        accessMethod: "BYOC",
        requiresUserSession: true,
        reason: "Requires user-authenticated browsing"
      };
    }
  }
  return {
    siteId: policy.id,
    siteName: policy.name,
    accessMethod: "NONE",
    requiresUserSession: false,
    reason: "No compliant access method found"
  };
};

// src/adapters/olx.ts
var OLX_CATEGORIES = {
  // Main Real Estate category - use this as default to get all property types
  IMOVEIS: 16,
  // Sub-categories (discovered from API metadata)
  TERRENOS_QUINTAS: 410,
  // Terrenos e Quintas
  TERRENOS_VENDA: 4795
  // Terrenos - Venda (works!)
};
var OLX_REGIONS = {
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
  madeira: 20
};
function mapPropertyType(context) {
  const type = context.propertyType?.toLowerCase() || "";
  const query = context.query.toLowerCase();
  if (type.includes("land") || type.includes("plot") || query.includes("terreno") || query.includes("land")) {
    return OLX_CATEGORIES.TERRENOS_VENDA;
  }
  return OLX_CATEGORIES.IMOVEIS;
}
function findRegionId(location) {
  if (!location) return void 0;
  const searchTerms = [
    location.label?.toLowerCase(),
    location.city?.toLowerCase(),
    location.region?.toLowerCase()
  ].filter(Boolean);
  for (const term of searchTerms) {
    if (!term) continue;
    for (const [regionName, regionId] of Object.entries(OLX_REGIONS)) {
      if (term.includes(regionName) || regionName.includes(term)) {
        return regionId;
      }
    }
  }
  return void 0;
}
function extractPrice(params) {
  const priceParam = params.find((p) => p.key === "price");
  if (priceParam?.value?.value) {
    return priceParam.value.value;
  }
  return 0;
}
function extractArea(params) {
  const areaKeys = ["m", "area", "area_de_terreno_m2", "area_util"];
  for (const key of areaKeys) {
    const areaParam = params.find((p) => p.key === key);
    if (areaParam?.value?.key) {
      const parsed = parseFloat(areaParam.value.key.replace(/[^\d.]/g, ""));
      if (!isNaN(parsed)) return parsed;
    }
  }
  return void 0;
}
function extractBedrooms(params) {
  const bedsParam = params.find((p) => p.key === "rooms" || p.key === "quartos" || p.key === "t");
  if (bedsParam?.value?.key) {
    const match = bedsParam.value.key.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return void 0;
}
function extractBathrooms(params) {
  const bathsParam = params.find((p) => p.key === "bathrooms" || p.key === "casas_banho");
  if (bathsParam?.value?.key) {
    const match = bathsParam.value.key.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return void 0;
}
function buildPhotoUrl(photo, width = 800, height = 600) {
  return photo.link.replace("{width}", String(width)).replace("{height}", String(height));
}
function mapOLXListingToListing(olxListing) {
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
    lastSeenAt: olxListing.last_refresh_time || olxListing.created_time
  };
}
async function fetchWithRetry(url, options, maxRetries = 3, timeoutMs = 15e3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error;
      console.log(`[OLX] Fetch attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1e3;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error("Fetch failed after retries");
}
async function fetchOLXListings(categoryId, options = {}) {
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
  const response = await fetchWithRetry(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; AIPA/1.0)"
    }
  });
  if (!response.ok) {
    throw new Error(`OLX API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
async function fetchOLXListingsMultiPage(categoryId, options = {}) {
  const maxListings = options.maxListings || 200;
  const maxPages = options.maxPages || 5;
  const perPage = 40;
  const allListings = [];
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
        offset
      });
      if (!response.data || response.data.length === 0) {
        console.log(`[OLX] No more listings found at offset ${offset}`);
        break;
      }
      allListings.push(...response.data);
      console.log(`[OLX] Got ${response.data.length} listings, total: ${allListings.length}`);
      if (!response.links?.next || response.data.length < perPage) {
        break;
      }
      offset += perPage;
      page++;
      await new Promise((r) => setTimeout(r, 300));
    } catch (error) {
      console.error(`[OLX] Error fetching page ${page + 1}:`, error);
      break;
    }
  }
  console.log(`[OLX] Fetched ${allListings.length} total listings from ${page + 1} pages`);
  return allListings;
}
var adapter = {
  siteId: "olx",
  siteName: "OLX",
  searchListings: async (context) => {
    try {
      const categoryId = mapPropertyType(context);
      const regionId = findRegionId(context.userLocation);
      const olxListings = await fetchOLXListingsMultiPage(categoryId, {
        regionId,
        minPrice: context.priceRange?.min,
        maxPrice: context.priceRange?.max,
        maxListings: 200,
        // Get up to 200 listings
        maxPages: 5
        // From up to 5 pages
      });
      const listings = olxListings.map(mapOLXListingToListing);
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
  }
};

// src/adapters/registry.ts
var ADAPTERS = [
  adapter
];

// src/adapters/mock.ts
var mockListings = [
  // Land/plots near Lisbon
  {
    id: "mock-idealista-001",
    sourceSite: "idealista",
    sourceUrl: "https://www.idealista.pt/imovel/mock-001",
    title: "Rustic land plot with views near Sintra",
    priceEur: 18500,
    currency: "EUR",
    areaSqm: 1200,
    address: "Sintra, Lisbon District",
    city: "Sintra",
    lat: 38.8029,
    lng: -9.3817,
    propertyType: "land",
    description: "Quiet plot with access road and utilities nearby. Perfect for small farming or weekend retreat.",
    photos: ["https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-kyero-002",
    sourceSite: "kyero",
    sourceUrl: "https://www.kyero.com/en/property/mock-002",
    title: "Agricultural land in Loures",
    priceEur: 22e3,
    currency: "EUR",
    areaSqm: 2500,
    address: "Loures, Lisbon District",
    city: "Loures",
    lat: 38.8309,
    lng: -9.1685,
    propertyType: "land",
    description: "Flat agricultural land with water access. 30 min from Lisbon center.",
    photos: ["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-supercasa-003",
    sourceSite: "supercasa",
    sourceUrl: "https://supercasa.pt/mock-003",
    title: "Building plot in Torres Vedras",
    priceEur: 35e3,
    currency: "EUR",
    areaSqm: 800,
    address: "Torres Vedras, Lisbon District",
    city: "Torres Vedras",
    lat: 39.0914,
    lng: -9.2586,
    propertyType: "land",
    description: "Urban land with building permit approved. All utilities connected.",
    photos: ["https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-idealista-004",
    sourceSite: "idealista",
    sourceUrl: "https://www.idealista.pt/imovel/mock-004",
    title: "Vineyard land in Alentejo",
    priceEur: 45e3,
    currency: "EUR",
    areaSqm: 15e3,
    address: "\xC9vora, Alentejo",
    city: "\xC9vora",
    lat: 38.5667,
    lng: -7.9,
    propertyType: "land",
    description: "Large plot with existing vineyard. Ideal for wine production or agritourism project.",
    photos: ["https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-kyero-005",
    sourceSite: "kyero",
    sourceUrl: "https://www.kyero.com/en/property/mock-005",
    title: "Coastal plot near Set\xFAbal",
    priceEur: 48e3,
    currency: "EUR",
    areaSqm: 3200,
    address: "Set\xFAbal, Set\xFAbal District",
    city: "Set\xFAbal",
    lat: 38.5244,
    lng: -8.8926,
    propertyType: "land",
    description: "Sea views, 10 min from beach. Electricity at boundary.",
    photos: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  // Houses
  {
    id: "mock-supercasa-006",
    sourceSite: "supercasa",
    sourceUrl: "https://supercasa.pt/mock-006",
    title: "Traditional stone house to renovate in Mafra",
    priceEur: 55e3,
    currency: "EUR",
    beds: 2,
    baths: 1,
    areaSqm: 120,
    address: "Mafra, Lisbon District",
    city: "Mafra",
    lat: 38.9369,
    lng: -9.3309,
    propertyType: "house",
    description: "Charming stone cottage needing renovation. Large garden with fruit trees. 40 min from Lisbon.",
    photos: ["https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-idealista-007",
    sourceSite: "idealista",
    sourceUrl: "https://www.idealista.pt/imovel/mock-007",
    title: "Rural house with land in Alenquer",
    priceEur: 72e3,
    currency: "EUR",
    beds: 3,
    baths: 1,
    areaSqm: 150,
    address: "Alenquer, Lisbon District",
    city: "Alenquer",
    lat: 39.0547,
    lng: -9.0158,
    propertyType: "house",
    description: "Renovated farmhouse with 5000sqm land. Perfect for self-sufficiency. 45 min from Lisbon.",
    photos: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  // Apartments
  {
    id: "mock-imovirtual-008",
    sourceSite: "imovirtual",
    sourceUrl: "https://www.imovirtual.com/mock-008",
    title: "Studio apartment in Porto center",
    priceEur: 89e3,
    currency: "EUR",
    beds: 0,
    baths: 1,
    areaSqm: 35,
    address: "Porto, Porto District",
    city: "Porto",
    lat: 41.1579,
    lng: -8.6291,
    propertyType: "apartment",
    description: "Compact studio in historic center. Recently renovated, perfect for investment.",
    photos: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-olx-009",
    sourceSite: "olx",
    sourceUrl: "https://www.olx.pt/mock-009",
    title: "1-bed apartment in Coimbra",
    priceEur: 65e3,
    currency: "EUR",
    beds: 1,
    baths: 1,
    areaSqm: 55,
    address: "Coimbra",
    city: "Coimbra",
    lat: 40.2033,
    lng: -8.4103,
    propertyType: "apartment",
    description: "Bright apartment near university. Good rental potential.",
    photos: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  // Budget options
  {
    id: "mock-idealista-010",
    sourceSite: "idealista",
    sourceUrl: "https://www.idealista.pt/imovel/mock-010",
    title: "Small plot in interior Portugal",
    priceEur: 8500,
    currency: "EUR",
    areaSqm: 500,
    address: "Guarda",
    city: "Guarda",
    lat: 40.5372,
    lng: -7.2676,
    propertyType: "land",
    description: "Affordable plot in mountain region. Road access, no utilities yet.",
    photos: ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-kyero-011",
    sourceSite: "kyero",
    sourceUrl: "https://www.kyero.com/en/property/mock-011",
    title: "Rustic land in Tr\xE1s-os-Montes",
    priceEur: 12e3,
    currency: "EUR",
    areaSqm: 4e3,
    address: "Bragan\xE7a",
    city: "Bragan\xE7a",
    lat: 41.8061,
    lng: -6.7589,
    propertyType: "land",
    description: "Large rural plot with spring water. Remote but beautiful location.",
    photos: ["https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "mock-supercasa-012",
    sourceSite: "supercasa",
    sourceUrl: "https://supercasa.pt/mock-012",
    title: "Olive grove land in Algarve",
    priceEur: 29e3,
    currency: "EUR",
    areaSqm: 8e3,
    address: "Tavira, Algarve",
    city: "Tavira",
    lat: 37.1271,
    lng: -7.6506,
    propertyType: "land",
    description: "Established olive grove with 50+ trees. Potential for rural tourism.",
    photos: ["https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800"],
    lastSeenAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var filterByContext = (listings, context) => {
  const query = context.query.toLowerCase();
  return listings.filter((listing) => {
    if (context.propertyType) {
      const type = context.propertyType.toLowerCase();
      const listingType = listing.propertyType?.toLowerCase() ?? "";
      if (type === "land" || type === "plot" || type === "terrain") {
        if (listingType !== "land") return false;
      } else if (type === "house" || type === "villa" || type === "cottage") {
        if (listingType !== "house") return false;
      } else if (type === "apartment" || type === "flat") {
        if (listingType !== "apartment") return false;
      }
    } else {
      if (query.includes("land") || query.includes("plot") || query.includes("terrain")) {
        if (listing.propertyType !== "land") return false;
      } else if (query.includes("house") || query.includes("villa") || query.includes("cottage")) {
        if (listing.propertyType !== "house") return false;
      } else if (query.includes("apartment") || query.includes("flat")) {
        if (listing.propertyType !== "apartment") return false;
      }
    }
    if (context.priceRange.min && listing.priceEur < context.priceRange.min) return false;
    if (context.priceRange.max && listing.priceEur > context.priceRange.max) return false;
    return true;
  });
};
var mockAdapter = {
  siteId: "mock",
  siteName: "Mock Listings",
  searchListings: async (context) => {
    console.log(`[Mock] Searching with price range: ${context.priceRange.min ?? 0} - ${context.priceRange.max ?? "unlimited"}`);
    const filtered = filterByContext(mockListings, context);
    console.log(`[Mock] Found ${filtered.length} matching listings`);
    return filtered;
  }
};

// src/services/queryParser.ts
var numberFrom = (value) => {
  const normalized = value.replace(/[, ]/g, "").replace(/\.(?=\d{3})/g, "");
  return Number(normalized);
};
var parseUserQuery = (input) => {
  const raw = input.trim();
  const lower = raw.toLowerCase();
  let priceIntent = { type: "none" };
  const betweenMatch = lower.match(/between\s+([\d.,]+)\s+and\s+([\d.,]+)/);
  if (betweenMatch) {
    priceIntent = {
      type: "between",
      min: numberFrom(betweenMatch[1]),
      max: numberFrom(betweenMatch[2]),
      currency: guessCurrency(raw)
    };
  }
  const underMatch = lower.match(/(?:under|below|max|up to)\s+([\d.,]+)/);
  if (!betweenMatch && underMatch) {
    priceIntent = {
      type: "under",
      max: numberFrom(underMatch[1]),
      currency: guessCurrency(raw)
    };
  }
  const overMatch = lower.match(/(?:over|above|min|at least)\s+([\d.,]+)/);
  if (!betweenMatch && !underMatch && overMatch) {
    priceIntent = {
      type: "over",
      min: numberFrom(overMatch[1]),
      currency: guessCurrency(raw)
    };
  }
  const plainPriceMatch = lower.match(/(?:€|£|\$|eur|euro|euros|usd|gbp)\s*([\d.,]+)|([\d.,]+)\s*(?:€|£|\$|eur|euro|euros|usd|gbp)/i) || lower.match(/\b([\d]{4,}(?:[.,]\d+)?)\b/);
  if (!betweenMatch && !underMatch && !overMatch && plainPriceMatch) {
    const priceValue = plainPriceMatch[1] || plainPriceMatch[2];
    if (priceValue) {
      priceIntent = {
        type: "exact",
        target: numberFrom(priceValue),
        currency: guessCurrency(raw)
      };
    }
  }
  let propertyType;
  if (/(land|plot|terrain|lote)/.test(lower)) propertyType = "land";
  if (/(apartment|apartamento|apt)/.test(lower)) propertyType = "apartment";
  if (/(house|villa|casa|moradia)/.test(lower)) propertyType = "house";
  let listingIntent;
  if (/(for rent|to rent|rental|rentals|arrendar|alugar|aluguer|per month|monthly|\/month|\/mo)/.test(lower)) {
    listingIntent = "rent";
  } else if (/(for sale|to buy|buy|purchase|comprar|venda|à venda)/.test(lower)) {
    listingIntent = "sale";
  }
  return {
    raw,
    propertyType,
    priceIntent,
    listingIntent
  };
};

// src/storage/searchStore.ts
var store = /* @__PURE__ */ new Map();
var saveSearch = (search) => {
  store.set(search.id, search);
};

// src/services/rag/vectorStore.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path2 = __toESM(require("node:path"));
var DATA_DIR = import_node_path2.default.resolve(process.cwd(), "data", "rag");
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}
var VectorStore = class {
  collections = /* @__PURE__ */ new Map();
  persistPath;
  constructor(storeName = "default") {
    this.persistPath = import_node_path2.default.join(DATA_DIR, `${storeName}.json`);
    this.load();
  }
  /**
   * Load store from disk
   */
  load() {
    try {
      if (import_node_fs.default.existsSync(this.persistPath)) {
        const data = JSON.parse(import_node_fs.default.readFileSync(this.persistPath, "utf-8"));
        this.collections = new Map(Object.entries(data));
        console.log(`[VectorStore] Loaded ${this.collections.size} collections from disk`);
      }
    } catch (error) {
      console.error("[VectorStore] Failed to load from disk:", error);
    }
  }
  /**
   * Save store to disk
   */
  save() {
    try {
      import_node_fs.default.mkdirSync(DATA_DIR, { recursive: true });
      const data = Object.fromEntries(this.collections);
      import_node_fs.default.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("[VectorStore] Failed to save to disk:", error);
    }
  }
  /**
   * Create or get a collection
   */
  getCollection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }
    return this.collections.get(name);
  }
  /**
   * Add documents to a collection
   */
  addDocuments(collectionName, documents) {
    const collection = this.getCollection(collectionName);
    for (const doc of documents) {
      const existingIndex = collection.findIndex((d) => d.id === doc.id);
      if (existingIndex >= 0) {
        collection[existingIndex] = doc;
      } else {
        collection.push(doc);
      }
    }
    this.save();
    console.log(`[VectorStore] Added ${documents.length} documents to ${collectionName}`);
  }
  /**
   * Search for similar documents using cosine similarity
   */
  search(collectionName, queryEmbedding, topK = 5, minScore = 0.5) {
    const collection = this.getCollection(collectionName);
    const results = collection.filter((doc) => doc.embedding && doc.embedding.length > 0).map((doc) => ({
      document: doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    })).filter((result) => result.score >= minScore).sort((a, b) => b.score - a.score).slice(0, topK);
    return results;
  }
  /**
   * Search by text (for documents without embeddings, uses simple keyword matching)
   */
  searchByKeywords(collectionName, query, topK = 5) {
    const collection = this.getCollection(collectionName);
    const queryTerms = query.toLowerCase().split(/\s+/);
    const results = collection.map((doc) => {
      const content = doc.content.toLowerCase();
      const metadata = JSON.stringify(doc.metadata).toLowerCase();
      const fullText = content + " " + metadata;
      let score = 0;
      for (const term of queryTerms) {
        const regex = new RegExp(term, "gi");
        const matches = fullText.match(regex);
        score += matches ? matches.length : 0;
      }
      return { document: doc, score: score / queryTerms.length };
    }).filter((result) => result.score > 0).sort((a, b) => b.score - a.score).slice(0, topK);
    return results;
  }
  /**
   * Delete documents from a collection
   */
  deleteDocuments(collectionName, documentIds) {
    const collection = this.getCollection(collectionName);
    const filtered = collection.filter((doc) => !documentIds.includes(doc.id));
    this.collections.set(collectionName, filtered);
    this.save();
  }
  /**
   * Get collection stats
   */
  getStats() {
    const stats = {};
    for (const [name, docs] of this.collections) {
      stats[name] = docs.length;
    }
    return stats;
  }
  /**
   * Clear a collection
   */
  clearCollection(collectionName) {
    this.collections.set(collectionName, []);
    this.save();
  }
};
var vectorStoreInstance = null;
function getVectorStore() {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore("property-assistant");
  }
  return vectorStoreInstance;
}

// src/services/rag/embeddingService.ts
var GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
var EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
var OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
var PROPERTY_VOCABULARY = [
  // Property types
  "land",
  "plot",
  "house",
  "villa",
  "apartment",
  "farm",
  "quinta",
  "commercial",
  "rural",
  "urban",
  // Features
  "bedroom",
  "bathroom",
  "kitchen",
  "pool",
  "garden",
  "garage",
  "terrace",
  "balcony",
  "view",
  "sea",
  // Location
  "portugal",
  "lisbon",
  "porto",
  "algarve",
  "alentejo",
  "coimbra",
  "braga",
  "faro",
  "cascais",
  "sintra",
  "central",
  "north",
  "south",
  "coast",
  "beach",
  "mountain",
  "countryside",
  "city",
  "town",
  "village",
  // Price/Size
  "cheap",
  "affordable",
  "expensive",
  "luxury",
  "budget",
  "small",
  "large",
  "spacious",
  "sqm",
  "hectare",
  // Condition
  "new",
  "renovated",
  "restored",
  "ruin",
  "construction",
  "modern",
  "traditional",
  "old",
  // Amenities
  "water",
  "electricity",
  "road",
  "access",
  "internet",
  "heating",
  "cooling",
  "furnished",
  // Actions
  "buy",
  "rent",
  "invest",
  "sale",
  "price",
  "cost",
  "value",
  // Legal/Process
  "tax",
  "imt",
  "notary",
  "lawyer",
  "contract",
  "deed",
  "registration",
  "nif",
  "visa",
  "golden"
];
var activeBackend = "tfidf";
async function detectBackend() {
  if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith("sk-")) {
    console.log("[Embeddings] Using OpenAI API");
    return "openai";
  }
  console.log("[Embeddings] Using TF-IDF fallback (no embedding API configured)");
  return "tfidf";
}
async function generateOpenAIEmbedding(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8e3)
      // Truncate to fit model limits
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embedding API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return data.data?.[0]?.embedding || [];
}
function generateTFIDFEmbedding(text) {
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const wordCounts = /* @__PURE__ */ new Map();
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, "");
    if (clean.length > 2) {
      wordCounts.set(clean, (wordCounts.get(clean) || 0) + 1);
    }
  }
  const embedding = new Array(PROPERTY_VOCABULARY.length).fill(0);
  for (let i = 0; i < PROPERTY_VOCABULARY.length; i++) {
    const term = PROPERTY_VOCABULARY[i];
    const count = wordCounts.get(term) || 0;
    let partialCount = 0;
    for (const [word, cnt] of wordCounts) {
      if (word.includes(term) || term.includes(word)) {
        partialCount += cnt * 0.5;
      }
    }
    const tf = (count + partialCount) / Math.max(words.length, 1);
    const idf = Math.log(PROPERTY_VOCABULARY.length / (i + 1));
    embedding[i] = tf * idf;
  }
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }
  return embedding;
}
async function generateEmbedding(text) {
  if (activeBackend === "tfidf") {
    activeBackend = await detectBackend();
  }
  try {
    switch (activeBackend) {
      case "openai":
        return await generateOpenAIEmbedding(text);
      case "tfidf":
      default:
        return generateTFIDFEmbedding(text);
    }
  } catch (error) {
    console.error("[Embeddings] API failed, falling back to TF-IDF:", error);
    return generateTFIDFEmbedding(text);
  }
}
async function generateEmbeddings(texts) {
  if (activeBackend === "tfidf") {
    return texts.map((text) => generateTFIDFEmbedding(text));
  }
  const embeddings = [];
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map((text) => generateEmbedding(text))
    );
    embeddings.push(...batchEmbeddings);
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return embeddings;
}
function getEmbeddingDimension() {
  return activeBackend === "openai" ? 1536 : PROPERTY_VOCABULARY.length;
}
function getEmbeddingBackend() {
  return {
    backend: activeBackend,
    dimension: getEmbeddingDimension()
  };
}

// src/services/rag/knowledgeBase.ts
var PORTUGAL_REAL_ESTATE_KNOWLEDGE = [
  // Buying Process
  {
    id: "buying-process-overview",
    title: "Buying Property in Portugal - Overview",
    content: `The process of buying property in Portugal typically involves these steps:
1. Get a NIF (N\xFAmero de Identifica\xE7\xE3o Fiscal) - Portuguese tax number required for any financial transaction
2. Open a Portuguese bank account (recommended but not required)
3. Find a property through agents, websites, or direct search
4. Make an offer and negotiate the price
5. Sign a Promissory Contract (CPCV) with a deposit (usually 10-20%)
6. Due diligence: verify property registration, debts, licenses
7. Sign the final deed (Escritura) at a notary
8. Register the property at the Land Registry (Conservat\xF3ria)
9. Pay taxes: IMT (transfer tax) and Stamp Duty`,
    category: "buying-process",
    tags: ["buying", "process", "steps", "how-to", "purchase"]
  },
  {
    id: "nif-tax-number",
    title: "NIF - Portuguese Tax Number",
    content: `The NIF (N\xFAmero de Identifica\xE7\xE3o Fiscal) is essential for buying property in Portugal.
- EU citizens can apply directly at any Tax Office (Finan\xE7as)
- Non-EU citizens need a fiscal representative (can be a lawyer or accountant)
- Required documents: passport, proof of address
- Can be obtained in person or through a representative
- Cost: Free if done in person, \u20AC100-300 through a representative
- Processing time: Usually immediate if in person, 1-2 weeks through representative`,
    category: "buying-process",
    tags: ["nif", "tax", "documents", "requirements"]
  },
  {
    id: "imt-transfer-tax",
    title: "IMT - Property Transfer Tax",
    content: `IMT (Imposto Municipal sobre Transmiss\xF5es) is the main tax when buying property in Portugal.
Rates for residential property (mainland Portugal):
- Up to \u20AC97,064: 0%
- \u20AC97,064 - \u20AC132,774: 2%
- \u20AC132,774 - \u20AC181,034: 5%
- \u20AC181,034 - \u20AC301,688: 7%
- \u20AC301,688 - \u20AC578,598: 8%
- \u20AC578,598 - \u20AC1,050,400: 6% (single rate)
- Over \u20AC1,050,400: 7.5%
Rural land: 5% flat rate
Note: Rates are lower for permanent residence and higher for second homes.
IMT must be paid before signing the deed.`,
    category: "taxes",
    tags: ["imt", "tax", "transfer", "costs", "rates"]
  },
  {
    id: "stamp-duty",
    title: "Stamp Duty (Imposto de Selo)",
    content: `Stamp Duty is an additional tax when buying property in Portugal.
- Rate: 0.8% of the property value or tax value (whichever is higher)
- Paid together with IMT before the deed
- Also applies to mortgage contracts (0.6% on the loan amount)
- No exemptions for first-time buyers
Example: For a \u20AC100,000 property, stamp duty = \u20AC800`,
    category: "taxes",
    tags: ["stamp", "duty", "tax", "costs"]
  },
  {
    id: "regions-algarve",
    title: "Algarve Region - Property Guide",
    content: `The Algarve is Portugal's southernmost region, famous for tourism and expat communities.
Popular areas:
- Lagos: Historic town, great beaches, mid-range prices
- Albufeira: Tourist hub, lots of amenities, higher prices
- Tavira: Quieter, traditional, good value
- Faro: Regional capital, airport, more local feel
- Vilamoura: Luxury marina, golf, premium prices
Property types: Apartments, villas, townhouses, golf properties
Price range: \u20AC150,000-500,000 for apartments, \u20AC300,000-2M+ for villas
Climate: 300+ sunny days, mild winters, hot summers
Considerations: Tourist-heavy, seasonal rentals potential, international community`,
    category: "regions",
    tags: ["algarve", "south", "coast", "beach", "tourism", "lagos", "albufeira", "tavira", "faro"]
  },
  {
    id: "regions-lisbon",
    title: "Lisbon Region - Property Guide",
    content: `Lisbon is Portugal's capital and largest city, with diverse property options.
Popular areas:
- Lisbon City: Historic neighborhoods, apartments, \u20AC3,000-8,000/sqm
- Cascais: Upscale coastal town, \u20AC4,000-10,000/sqm
- Sintra: UNESCO heritage, palaces, nature, \u20AC2,500-5,000/sqm
- Set\xFAbal Peninsula: More affordable, beaches, \u20AC1,500-3,000/sqm
- Mafra/Torres Vedras: Rural, affordable, \u20AC1,000-2,000/sqm
Property types: Apartments (most common), townhouses, villas, rural estates
Investment potential: Strong rental market, Airbnb popular
Considerations: Higher prices, traffic, excellent infrastructure`,
    category: "regions",
    tags: ["lisbon", "capital", "city", "cascais", "sintra", "urban"]
  },
  {
    id: "regions-alentejo",
    title: "Alentejo Region - Property Guide",
    content: `Alentejo is Portugal's largest region, known for rural landscapes and affordable property.
Popular areas:
- \xC9vora: UNESCO city, cultural hub
- Beja: Agricultural, very affordable
- Alentejo Coast: Unspoiled beaches, growing popularity
- Comporta: Upscale coastal area, celebrities, premium prices
Property types: Farms (herdades), rural houses (montes), land, ruins for renovation
Price range: \u20AC50,000-200,000 for rural properties, land from \u20AC5,000/hectare
Climate: Hot summers (40\xB0C+), cold winters, low rainfall
Considerations: Remote, limited services, great for self-sufficiency, agriculture`,
    category: "regions",
    tags: ["alentejo", "rural", "farm", "land", "affordable", "evora", "countryside"]
  },
  {
    id: "regions-porto-north",
    title: "Porto and Northern Portugal - Property Guide",
    content: `Northern Portugal offers a different character from the south - greener, more traditional.
Popular areas:
- Porto City: Second largest city, UNESCO, \u20AC2,500-5,000/sqm
- Vila Nova de Gaia: Wine cellars, river views, slightly cheaper
- Braga: Historic, religious, growing tech hub
- Guimar\xE3es: Medieval, UNESCO, traditional
- Douro Valley: Wine region, river, tourism potential
- Minho: Green, rural, very affordable
Property types: City apartments, traditional stone houses, quintas (estates)
Price range: Generally 30-50% cheaper than Lisbon
Climate: Rainy, green, mild summers, cool winters
Considerations: Less English spoken, more authentic, good value`,
    category: "regions",
    tags: ["porto", "north", "douro", "braga", "traditional", "wine"]
  },
  {
    id: "regions-silver-coast",
    title: "Silver Coast - Property Guide",
    content: `The Silver Coast (Costa de Prata) stretches from Lisbon to Porto along the Atlantic.
Popular areas:
- \xD3bidos: Medieval walled town, charming, touristy
- Caldas da Rainha: Spa town, ceramics, affordable
- Nazar\xE9: Giant waves, fishing village, tourism
- Leiria: Regional center, practical
- Figueira da Foz: Beach resort, casinos
- Aveiro: "Portuguese Venice", canals, university
Property types: Beach apartments, traditional houses, rural properties
Price range: \u20AC100,000-300,000 for most properties
Climate: Atlantic influence, cooler summers, mild winters, some fog
Considerations: Good value, authentic, less crowded, surfing`,
    category: "regions",
    tags: ["silver-coast", "central", "beach", "obidos", "nazare", "affordable"]
  },
  {
    id: "land-buying",
    title: "Buying Land in Portugal",
    content: `Land purchase in Portugal has specific considerations:
Types of land:
- Urban (Urbano): Designated for construction, more expensive
- Rural (R\xFAstico): Agricultural use, harder to build on
- Mixed: Some construction rights on rural land

Building permissions:
- Urban land: Usually straightforward to build
- Rural land: Minimum plot sizes (often 5000+ sqm), may need special permits
- RAN/REN zones: Protected agricultural/ecological areas, very restricted

Price ranges:
- Urban plots (Algarve): \u20AC50-200/sqm
- Rural land (Alentejo): \u20AC1-10/sqm
- Rural land (Central): \u20AC3-20/sqm

Key checks:
- Verify caderneta predial (property registration)
- Check PDM (municipal development plan) for zoning
- Confirm access rights (servitude)
- Water and electricity availability
- Any existing structures or ruins`,
    category: "property-types",
    tags: ["land", "plot", "rural", "urban", "building", "construction", "terreno"]
  },
  {
    id: "construction-land-portugal",
    title: "Construction Land Laws in Portugal - Terreno para Constru\xE7\xE3o",
    content: `IMPORTANT: Not all land in Portugal can be built on. Understanding land classification is critical.

LAND TYPES AND BUILDABILITY:

1. TERRENO URBANO (Urban Land) - CAN BUILD \u2705
   - Officially classified for construction in municipal plans (PDM)
   - Listed as "urbano" in Caderneta Predial (property registry)
   - Has approved building parameters (height, area, usage)
   - Usually has or can get utilities (\xE1gua, luz, saneamento)
   - Keywords in listings: "urbano", "para constru\xE7\xE3o", "lote", "urbaniz\xE1vel"

2. TERRENO R\xDASTICO (Rural/Rustic Land) - DIFFICULT TO BUILD \u274C
   - Agricultural land, usually cannot build residential
   - Listed as "r\xFAstico" in Caderneta Predial
   - May only allow agricultural structures (barns, storage)
   - Exceptions: Very large plots (5000+ sqm) in some municipalities
   - Keywords: "r\xFAstico", "agr\xEDcola", "terreno agr\xEDcola"

3. MIXED/APTO PARA CONSTRU\xC7\xC3O (Mixed Use) - CAN BUILD WITH CONDITIONS \u26A0\uFE0F
   - Rural land with building rights
   - Often old "grandfathered" plots
   - Check PIP (Pedido de Informa\xE7\xE3o Pr\xE9via) for exact allowances

CRITICAL DOCUMENTS TO CHECK:

\u{1F4C4} CADERNETA PREDIAL (Property Registry)
   - Shows if land is "urbano" or "r\xFAstico"
   - Get from Finan\xE7as (tax office)
   - If it says "urbano" \u2192 construction allowed

\u{1F4C4} PDM (Plano Director Municipal)
   - Municipal zoning plan
   - Defines what can be built where
   - Check at local C\xE2mara Municipal (city hall)
   - Zones: residential, commercial, industrial, agricultural

\u{1F4C4} PIP (Pedido de Informa\xE7\xE3o Pr\xE9via)
   - Pre-approval request to municipality
   - Confirms exactly what you can build
   - Cost: \u20AC50-200, takes 30-60 days
   - HIGHLY RECOMMENDED before buying

\u{1F4C4} ALVAR\xC1 DE LOTEAMENTO
   - For plots in approved developments
   - Includes all specifications for building
   - Simplest option - everything pre-approved

WHAT TO LOOK FOR IN LISTINGS:

\u2705 GOOD SIGNS (can build):
- "Terreno urbano" - urban land
- "Lote de terreno" - building plot
- "Para constru\xE7\xE3o" - for construction
- "Viabilidade de constru\xE7\xE3o" - building viability
- "Projeto aprovado" - approved project
- "Com alvar\xE1" - with building permit
- "\xCDndice de constru\xE7\xE3o" - building index specified
- "\xC1rea de implanta\xE7\xE3o" - footprint area specified

\u274C WARNING SIGNS (may NOT be buildable):
- "Terreno r\xFAstico" - rural land (usually no building)
- "Terreno agr\xEDcola" - agricultural land
- "RAN" - National Agricultural Reserve (no building)
- "REN" - National Ecological Reserve (no building)
- "\xC1rea protegida" - protected area
- No mention of "urbano" or "constru\xE7\xE3o"

BUILDING PERMIT PROCESS:
1. Projeto de Arquitetura - Architectural project
2. Submit to C\xE2mara Municipal
3. Technical evaluation (60-120 days)
4. Pay license fee (taxa de licen\xE7a)
5. Receive Alvar\xE1 de Constru\xE7\xE3o
6. Build within permit timeframe

COMMON MISTAKES:
- Buying "r\xFAstico" thinking you can build \u2192 you usually cannot
- Not checking PDM before purchase \u2192 may have restrictions
- Assuming ruins = building rights \u2192 not always
- Not verifying utilities access \u2192 expensive to connect

PRICE DIFFERENCE:
- Urban plots: \u20AC30-300/sqm (depending on location)
- Rural/r\xFAstico: \u20AC1-15/sqm (much cheaper but can't build)
- The price difference reflects buildability!`,
    category: "property-types",
    tags: ["construction", "land", "terreno", "urbano", "rustico", "building", "permit", "PDM", "constru\xE7\xE3o", "lote", "plot"]
  },
  {
    id: "ruins-renovation",
    title: "Buying and Renovating Ruins in Portugal",
    content: `Ruins can be excellent value but require careful consideration:
Advantages:
- Low purchase price (\u20AC5,000-50,000 typical)
- Potential to create dream home
- Often come with land
- Authentic stone construction

Challenges:
- Renovation costs often exceed purchase price (budget \u20AC1,000-2,000/sqm)
- Permits can be complex and slow (6-18 months)
- May need architect and engineer
- Unexpected structural issues common
- Remote locations may lack utilities

Key considerations:
- Check if ruin has habitation license (more valuable)
- Verify building footprint can be maintained
- Ensure access to water and electricity
- Get structural assessment before purchase
- Budget 30% contingency for surprises

Popular areas for ruins: Alentejo, Central Portugal, Interior North`,
    category: "property-types",
    tags: ["ruins", "renovation", "restore", "reconstruction", "project"]
  },
  {
    id: "golden-visa",
    title: "Golden Visa Program",
    content: `Portugal's Golden Visa grants residency through investment.
Current investment options (2024+):
- \u20AC500,000 in investment funds
- \u20AC500,000 in qualifying company shares
- \u20AC250,000 in arts/culture (reduced from \u20AC500k)
- \u20AC500,000 in research activities
- Job creation (10 jobs minimum)

Note: Real estate investment NO LONGER qualifies for Golden Visa as of 2023.

Benefits:
- Residency permit for investor and family
- Free movement in Schengen area
- Path to permanent residency (5 years) and citizenship (5 years)
- Low presence requirement (7 days in year 1, 14 days in subsequent years)

For property buyers: Consider D7 visa (passive income visa) instead.`,
    category: "visas-residency",
    tags: ["golden-visa", "residency", "investment", "visa", "immigration"]
  },
  {
    id: "d7-visa",
    title: "D7 Passive Income Visa",
    content: `The D7 visa is popular for retirees and remote workers wanting to live in Portugal.
Requirements:
- Proof of regular passive income (pension, investments, rental income)
- Minimum income: Portuguese minimum wage (\u20AC820/month for 2024)
- Recommended: \u20AC1,500-2,000/month for comfortable approval
- Accommodation in Portugal (can be rental)
- Clean criminal record
- Health insurance

Process:
1. Apply at Portuguese consulate in home country
2. Receive temporary visa (4 months)
3. Travel to Portugal
4. Apply for residence permit at SEF/AIMA
5. Receive 2-year residence permit
6. Renew for 3 more years
7. Apply for permanent residency or citizenship after 5 years

Benefits:
- Path to citizenship
- Can work in Portugal
- Family reunification possible
- NHR tax benefits may apply`,
    category: "visas-residency",
    tags: ["d7", "visa", "passive-income", "retirement", "residency"]
  },
  {
    id: "nhr-tax-regime",
    title: "NHR - Non-Habitual Resident Tax Regime",
    content: `NHR offers significant tax benefits for new residents (program modified in 2024).
Original NHR (before 2024):
- 10 years of tax benefits
- 20% flat rate on Portuguese income from qualifying professions
- Potential exemption on foreign income
- Popular with retirees and digital nomads

New regime (2024+):
- NHR replaced with "Incentivized Tax Regime for Scientific Research and Innovation"
- More restrictive qualifying criteria
- Focus on researchers, academics, and innovation
- 20% flat rate on qualifying employment income
- 10-year duration

Existing NHR holders:
- Grandfathered under old rules
- Benefits continue for original 10-year period

Consult a tax advisor for current rules and eligibility.`,
    category: "taxes",
    tags: ["nhr", "tax", "non-habitual", "resident", "benefits"]
  },
  {
    id: "annual-property-taxes",
    title: "Annual Property Taxes (IMI)",
    content: `IMI (Imposto Municipal sobre Im\xF3veis) is the annual property tax in Portugal.
Rates:
- Urban properties: 0.3% to 0.45% of tax value (VPT)
- Rural properties: 0.8% of tax value
- Rates set by each municipality

Tax value (VPT):
- Usually lower than market value
- Based on formulas considering size, age, location, quality
- Reassessed periodically

Payment:
- Due in April, May, or November (depending on amount)
- Can be paid in 2-3 installments if over \u20AC100/\u20AC500
- Penalties for late payment

Exemptions:
- Low-income households
- 3-year exemption for primary residence (under certain values)
- Rehabilitation projects may qualify

Example: \u20AC200,000 market value property might have \u20AC80,000 VPT = \u20AC320/year IMI at 0.4%`,
    category: "taxes",
    tags: ["imi", "annual", "tax", "property", "municipal"]
  },
  {
    id: "utilities-costs",
    title: "Utilities and Running Costs",
    content: `Typical monthly costs for property in Portugal:
Utilities:
- Electricity: \u20AC50-150/month (higher with AC/heating)
- Water: \u20AC20-40/month
- Gas (if piped): \u20AC20-50/month
- Internet/TV: \u20AC30-60/month
- Mobile phone: \u20AC15-30/month

Property costs:
- IMI (property tax): Varies, typically \u20AC200-1000/year
- Condominium fees (apartments): \u20AC30-100/month
- Home insurance: \u20AC100-300/year
- Maintenance reserve: Budget 1% of value/year

Tips for savings:
- Solar panels increasingly popular (good ROI)
- Bi-hourly electricity tariffs save money
- Well water for irrigation
- Good insulation reduces heating/cooling costs

Total monthly running costs:
- Small apartment: \u20AC150-250
- House: \u20AC200-400
- Large villa: \u20AC400-800+`,
    category: "costs",
    tags: ["utilities", "costs", "electricity", "water", "monthly", "running"]
  },
  {
    id: "lawyers-notaries",
    title: "Lawyers and Notaries in Portugal",
    content: `Professional help is recommended when buying property in Portugal.
Lawyers (Advogados):
- Not legally required but highly recommended
- Handle due diligence, contracts, negotiations
- Costs: \u20AC1,000-3,000 for standard purchase
- English-speaking lawyers available in main cities
- Can act as fiscal representative for NIF

Notaries (Not\xE1rios):
- Required for final deed (Escritura)
- Government-regulated fees
- Verify identities, witness signing
- Costs: \u20AC300-800 for deed

Other professionals:
- Solicitors (Solicitadores): Lower cost alternative to lawyers
- Estate agents: Typically paid by seller (5% commission)
- Surveyors: Not common in Portugal, but recommended for old properties
- Translators: For documents and appointments

Recommendation: Always use a lawyer independent from the seller and agent.`,
    category: "buying-process",
    tags: ["lawyer", "notary", "legal", "professional", "advogado"]
  },
  {
    id: "mortgage-financing",
    title: "Mortgages and Financing",
    content: `Mortgages are available in Portugal for residents and non-residents.
For residents:
- Up to 90% LTV (loan-to-value)
- Lower interest rates
- Longer terms available (up to 40 years)

For non-residents:
- Typically 60-70% LTV
- Higher interest rates
- Maximum terms usually 25-30 years

Current rates (2024):
- Variable: Euribor + 0.8-1.5%
- Fixed: 3-4% (varies by term)

Requirements:
- Proof of income (3 years tax returns)
- Bank statements
- Property valuation
- Life insurance required
- Property insurance required

Banks offering mortgages to foreigners:
- Millennium BCP
- Novo Banco
- Santander
- BPI

Process: Allow 4-8 weeks for approval
Costs: Expect 2-3% of loan value in fees`,
    category: "financing",
    tags: ["mortgage", "loan", "bank", "financing", "credit"]
  },
  {
    id: "rental-income",
    title: "Rental Income and Regulations",
    content: `Renting out property in Portugal has specific rules and tax implications.
Long-term rentals (Arrendamento):
- Tenant protection laws apply
- Notice periods: 2-5 years depending on contract
- Rent increases limited to inflation coefficient
- Tax: 28% flat rate or progressive (depending on status)

Short-term/Tourist rentals (Alojamento Local):
- Registration required with local council
- Maximum 120 days in some areas (Lisbon, Porto)
- Safety requirements (fire extinguishers, etc.)
- Tax: 35% of gross income (simplified regime) or actual expenses

Gross yields:
- Lisbon: 3-5%
- Porto: 4-6%
- Algarve: 4-8% (seasonal)
- Rural: 2-4%

Costs to deduct:
- IMI, condominium, insurance
- Maintenance and repairs
- Agent fees
- Mortgage interest (if applicable)

Platform requirements:
- Airbnb, Booking.com require AL license number
- Tax reporting mandatory`,
    category: "investment",
    tags: ["rental", "income", "investment", "airbnb", "alojamento", "yield"]
  }
];
function getAllKnowledge() {
  return PORTUGAL_REAL_ESTATE_KNOWLEDGE;
}
function getCategories() {
  return [...new Set(PORTUGAL_REAL_ESTATE_KNOWLEDGE.map((doc) => doc.category))];
}

// src/services/rag/ragService.ts
var KNOWLEDGE_COLLECTION = "knowledge";
var LISTINGS_COLLECTION = "listings";
var CONVERSATIONS_COLLECTION = "conversations";
async function initializeRAG() {
  const store2 = getVectorStore();
  const knowledge = getAllKnowledge();
  const stats = store2.getStats();
  if (stats[KNOWLEDGE_COLLECTION] === knowledge.length) {
    console.log("[RAG] Knowledge base already indexed");
    return;
  }
  console.log("[RAG] Indexing knowledge base...");
  const texts = knowledge.map((doc) => `${doc.title}
${doc.content}`);
  const embeddings = await generateEmbeddings(texts);
  const documents = knowledge.map((doc, index) => ({
    id: doc.id,
    content: doc.content,
    metadata: {
      title: doc.title,
      category: doc.category,
      tags: doc.tags
    },
    embedding: embeddings[index]
  }));
  store2.addDocuments(KNOWLEDGE_COLLECTION, documents);
  console.log(`[RAG] Indexed ${documents.length} knowledge documents`);
}
async function indexListings(listings) {
  if (listings.length === 0) return;
  const store2 = getVectorStore();
  const documents = [];
  const texts = [];
  for (const listing of listings) {
    const text = [
      listing.title,
      `Price: \u20AC${listing.priceEur}`,
      listing.city ? `Location: ${listing.city}` : "",
      listing.beds ? `Bedrooms: ${listing.beds}` : "",
      listing.baths ? `Bathrooms: ${listing.baths}` : "",
      listing.areaSqm ? `Area: ${listing.areaSqm} sqm` : "",
      listing.description || ""
    ].filter(Boolean).join(". ");
    texts.push(text);
    documents.push({
      id: listing.id,
      content: text,
      metadata: {
        title: listing.title,
        priceEur: listing.priceEur,
        city: listing.city,
        sourceSite: listing.sourceSite,
        sourceUrl: listing.sourceUrl,
        beds: listing.beds,
        baths: listing.baths,
        areaSqm: listing.areaSqm,
        indexedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
  const embeddings = await generateEmbeddings(texts);
  for (let i = 0; i < documents.length; i++) {
    documents[i].embedding = embeddings[i];
  }
  store2.addDocuments(LISTINGS_COLLECTION, documents);
  console.log(`[RAG] Indexed ${documents.length} listings`);
}
async function storeConversation(conversationId, userQuery, assistantResponse, searchContext) {
  const store2 = getVectorStore();
  const content = [
    `User: ${userQuery}`,
    `Assistant: ${assistantResponse}`,
    searchContext ? `Context: ${searchContext}` : ""
  ].filter(Boolean).join("\n");
  const embedding = await generateEmbedding(content);
  const document = {
    id: `conv-${conversationId}-${Date.now()}`,
    content,
    metadata: {
      conversationId,
      userQuery,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    },
    embedding
  };
  store2.addDocuments(CONVERSATIONS_COLLECTION, [document]);
}
async function retrieveKnowledge(query, topK = 3, minScore = 0.3) {
  const store2 = getVectorStore();
  const backend = getEmbeddingBackend();
  if (backend.backend === "tfidf") {
    const queryEmbedding2 = await generateEmbedding(query);
    return store2.search(KNOWLEDGE_COLLECTION, queryEmbedding2, topK, minScore);
  }
  const queryEmbedding = await generateEmbedding(query);
  return store2.search(KNOWLEDGE_COLLECTION, queryEmbedding, topK, minScore);
}
async function retrieveSimilarListings(query, topK = 5, minScore = 0.3) {
  const store2 = getVectorStore();
  const queryEmbedding = await generateEmbedding(query);
  return store2.search(LISTINGS_COLLECTION, queryEmbedding, topK, minScore);
}
function searchListingsByCriteria(criteria, limit = 10) {
  const store2 = getVectorStore();
  const collection = store2.getCollection(LISTINGS_COLLECTION);
  const results = [];
  for (const doc of collection) {
    const meta = doc.metadata;
    let score = 100;
    let matches = true;
    if (criteria.city) {
      const cityLower = (meta.city || "").toLowerCase();
      const criteriaCity = criteria.city.toLowerCase();
      if (!cityLower.includes(criteriaCity) && !criteriaCity.includes(cityLower)) {
        matches = false;
      }
    }
    const beds = meta.beds;
    if (criteria.minBeds !== void 0 && (beds === void 0 || beds < criteria.minBeds)) {
      matches = false;
    }
    if (criteria.maxBeds !== void 0 && beds !== void 0 && beds > criteria.maxBeds) {
      matches = false;
    }
    const area = meta.areaSqm;
    if (criteria.minArea !== void 0) {
      if (area === void 0) {
        score -= 20;
      } else if (area < criteria.minArea * 0.8) {
        matches = false;
      } else if (area < criteria.minArea) {
        score -= 10;
      }
    }
    if (criteria.maxArea !== void 0 && area !== void 0 && area > criteria.maxArea * 1.2) {
      matches = false;
    }
    const price = meta.priceEur;
    if (criteria.minPrice !== void 0 && price !== void 0 && price < criteria.minPrice) {
      matches = false;
    }
    if (criteria.maxPrice !== void 0 && price !== void 0 && price > criteria.maxPrice) {
      matches = false;
    }
    if (criteria.forRent !== void 0) {
      const content = doc.content.toLowerCase();
      const title = (meta.title || "").toLowerCase();
      const isRent = content.includes("arrend") || content.includes("rent") || content.includes("alug") || title.includes("arrend") || title.includes("rent") || title.includes("alug");
      const isSale = content.includes("vend") || content.includes("sale") || title.includes("vend") || title.includes("sale");
      if (criteria.forRent && !isRent && isSale) {
        matches = false;
      } else if (!criteria.forRent && !isSale && isRent) {
        matches = false;
      }
    }
    if (criteria.propertyType) {
      const content = doc.content.toLowerCase();
      const title = (meta.title || "").toLowerCase();
      const propType = criteria.propertyType.toLowerCase();
      const typeMatches = propType === "apartment" && (content.includes("apartamento") || content.includes("apartment") || title.includes("t1") || title.includes("t2") || title.includes("t3") || title.includes("t4")) || propType === "house" && (content.includes("moradia") || content.includes("house") || content.includes("vivenda") || content.includes("villa")) || propType === "land" && (content.includes("terreno") || content.includes("land") || content.includes("lote")) || propType === "room" && (content.includes("quarto") || content.includes("room"));
      if (!typeMatches) {
        score -= 30;
      }
    }
    if (criteria.minArea && area) {
      const areaRatio = area / criteria.minArea;
      if (areaRatio >= 0.9 && areaRatio <= 1.2) {
        score += 20;
      }
    }
    if (matches && score > 0) {
      results.push({ listing: doc, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
function parseSearchQuery(query) {
  const lower = query.toLowerCase();
  const criteria = {};
  const cities = ["porto", "lisboa", "lisbon", "faro", "braga", "coimbra", "aveiro", "setubal", "evora"];
  for (const city of cities) {
    if (lower.includes(city)) {
      criteria.city = city;
      break;
    }
  }
  const bedsMatch = lower.match(/(\d+)\s*(?:bed|bedroom|quarto|t)|\bt(\d+)\b/);
  if (bedsMatch) {
    const beds = parseInt(bedsMatch[1] || bedsMatch[2], 10);
    if (beds > 0 && beds < 10) {
      criteria.minBeds = beds;
      criteria.maxBeds = beds;
    }
  }
  const areaMatch = lower.match(/(\d+)\s*(?:m2|sqm|m²|square|metros)/);
  if (areaMatch) {
    const area = parseInt(areaMatch[1], 10);
    if (area > 10 && area < 1e4) {
      criteria.minArea = area * 0.8;
      criteria.maxArea = area * 1.5;
    }
  }
  const priceMatch = lower.match(/(?:€|eur|euro|price|under|below|max)\s*(\d+(?:[.,]\d{3})*)/i);
  if (priceMatch) {
    const price = parseInt(priceMatch[1].replace(/[.,]/g, ""), 10);
    if (price > 0) {
      criteria.maxPrice = price;
    }
  }
  if (lower.includes("rent") || lower.includes("arrend") || lower.includes("alug") || lower.includes("arrendar")) {
    criteria.forRent = true;
  } else if (lower.includes("buy") || lower.includes("sale") || lower.includes("comprar") || lower.includes("vend")) {
    criteria.forRent = false;
  }
  if (lower.includes("apartment") || lower.includes("apartamento") || lower.includes("flat")) {
    criteria.propertyType = "apartment";
  } else if (lower.includes("house") || lower.includes("moradia") || lower.includes("villa") || lower.includes("vivenda")) {
    criteria.propertyType = "house";
  } else if (lower.includes("land") || lower.includes("terreno") || lower.includes("plot")) {
    criteria.propertyType = "land";
  } else if (lower.includes("room") || lower.includes("quarto")) {
    criteria.propertyType = "room";
  }
  return criteria;
}
async function retrieveConversationContext(query, conversationId, topK = 3) {
  const store2 = getVectorStore();
  const queryEmbedding = await generateEmbedding(query);
  let results = store2.search(CONVERSATIONS_COLLECTION, queryEmbedding, topK * 2, 0.2);
  if (conversationId) {
    results = results.filter(
      (r) => r.document.metadata.conversationId === conversationId
    );
  }
  return results.slice(0, topK);
}
async function buildRAGContext(query, options = {}) {
  const {
    includeKnowledge = true,
    includeListings = false,
    includeConversations = false,
    conversationId,
    maxTokens = 2e3
  } = options;
  const contextParts = [];
  let estimatedTokens = 0;
  const avgCharsPerToken = 4;
  if (includeKnowledge) {
    const knowledge = await retrieveKnowledge(query, 3, 0.2);
    if (knowledge.length > 0) {
      contextParts.push("=== Relevant Information ===");
      for (const result of knowledge) {
        const text = `[${result.document.metadata.title}]
${result.document.content}`;
        const tokens = Math.ceil(text.length / avgCharsPerToken);
        if (estimatedTokens + tokens < maxTokens) {
          contextParts.push(text);
          estimatedTokens += tokens;
        }
      }
    }
  }
  if (includeListings) {
    const listings = await retrieveSimilarListings(query, 3, 0.3);
    if (listings.length > 0) {
      contextParts.push("\n=== Similar Properties ===");
      for (const result of listings) {
        const meta = result.document.metadata;
        const text = `- ${meta.title}: \u20AC${meta.priceEur} in ${meta.city || "Portugal"}`;
        const tokens = Math.ceil(text.length / avgCharsPerToken);
        if (estimatedTokens + tokens < maxTokens) {
          contextParts.push(text);
          estimatedTokens += tokens;
        }
      }
    }
  }
  if (includeConversations) {
    const conversations = await retrieveConversationContext(query, conversationId, 2);
    if (conversations.length > 0) {
      contextParts.push("\n=== Previous Relevant Conversations ===");
      for (const result of conversations) {
        const tokens = Math.ceil(result.document.content.length / avgCharsPerToken);
        if (estimatedTokens + tokens < maxTokens) {
          contextParts.push(result.document.content);
          estimatedTokens += tokens;
        }
      }
    }
  }
  return contextParts.join("\n\n");
}
function getRAGStats() {
  const store2 = getVectorStore();
  const backend = getEmbeddingBackend();
  return {
    collections: store2.getStats(),
    embeddingBackend: backend.backend,
    embeddingDimension: backend.dimension
  };
}
function clearRAGData(collection) {
  const store2 = getVectorStore();
  if (collection) {
    store2.clearCollection(collection);
  } else {
    store2.clearCollection(KNOWLEDGE_COLLECTION);
    store2.clearCollection(LISTINGS_COLLECTION);
    store2.clearCollection(CONVERSATIONS_COLLECTION);
  }
}

// src/services/aiService.ts
var GROQ_API_KEY2 = process.env.GROQ_API_KEY ?? "";
var GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
var CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
var OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
var LOCAL_AI_URL = process.env.LOCAL_AI_URL ?? "http://localhost:8080";
var OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.3-thinking-claude";
var ragInitialized = false;
var ensureRAGInitialized = async () => {
  if (!ragInitialized) {
    await initializeRAG();
    ragInitialized = true;
  }
};
var activeBackend2 = "none";
var activeOllamaModel = process.env.OLLAMA_MODEL ?? "llama3.3-thinking-claude";
var backendChecked = false;
var PROPERTY_SYSTEM_PROMPT = `You are an AI property search assistant for Portugal. Parse the user's query and extract search parameters.

IMPORTANT RULES:
- ALWAYS set clarificationNeeded to false - never ask for clarification
- Extract as much info as possible, use sensible defaults for missing info
- For "under X" queries, set priceMax to X
- For "around X" queries, set priceTarget to X
- Always extract the numeric price value

Respond with ONLY valid JSON in this format:
{
  "parsedIntent": {
    "propertyType": "land|apartment|house|villa|commercial|null",
    "priceMin": null,
    "priceMax": 50000,
    "priceTarget": null,
    "priceIntent": "under|over|between|exact|around|none",
    "currency": "EUR",
    "location": "Lisbon",
    "rawQuery": "original query"
  },
  "clarificationNeeded": false,
  "responseMessage": "Searching for land near Lisbon under \u20AC50,000..."
}`;
var RAG_ENHANCED_SYSTEM_PROMPT = `You are a magical AI Property Witch for Portugal with deep knowledge about Portuguese real estate.

You have access to a knowledge base about:
- Buying process and legal requirements (NIF, lawyers, notaries)
- Taxes (IMT, Stamp Duty, IMI, NHR regime)
- Regions of Portugal (Algarve, Lisbon, Porto, Alentejo, Silver Coast)
- Property types (land, ruins, villas, apartments)
- Visas and residency (Golden Visa, D7 visa)
- Financing and mortgages
- Rental income and regulations

IMPORTANT RULES:
- Use the KNOWLEDGE CONTEXT provided to answer accurately
- Cite specific figures, percentages, and requirements from the context
- If information isn't in the context, say you're not certain
- Be helpful and conversational
- Keep responses focused and informative`;
var INTENT_DETECTION_PROMPT = `Analyze this message in the context of the conversation and determine the user's intent.

Respond with ONLY valid JSON:
{
  "intent": "search" | "conversation" | "follow_up" | "refine_search",
  "reason": "brief explanation",
  "isPropertySearch": true/false
}

Intent types:
- "search": User wants to search for NEW properties (mentions specific criteria like price, location, property type)
- "conversation": General chat, questions about Portugal, real estate advice, greetings, etc.
- "follow_up": User is asking about or referring to previous search results
- "refine_search": User wants to adjust the previous search (cheaper, different area, etc.)`;
var detectBackend2 = async () => {
  if (GROQ_API_KEY2 && GROQ_API_KEY2.startsWith("gsk_")) {
    console.log("AI Backend: Groq API (cloud) - PRIMARY");
    activeBackend2 = "groq";
    return "groq";
  }
  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2e3)
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      if (data.models && data.models.length > 0) {
        const modelNames = data.models.map((m) => m.name);
        console.log("AI Backend: Ollama (local) - FALLBACK, models:", modelNames);
        const hasThinkingClaude = modelNames.some(
          (n) => n.includes("thinking-claude") || n.includes("llama3.3")
        );
        if (hasThinkingClaude) {
          console.log("  \u2192 Using Llama3.3-Thinking-Claude (high-reasoning model)");
        }
        activeBackend2 = "ollama";
        return "ollama";
      }
    }
  } catch {
  }
  try {
    const localRes = await fetch(`${LOCAL_AI_URL}/tools`, {
      method: "GET",
      signal: AbortSignal.timeout(2e3)
    });
    if (localRes.ok) {
      console.log("AI Backend: Local LLaMA server at", LOCAL_AI_URL, "- FALLBACK");
      activeBackend2 = "local";
      return "local";
    }
  } catch {
  }
  console.log("AI Backend: None (using regex fallback)");
  activeBackend2 = "none";
  return "none";
};
var getAvailableBackends = async () => {
  const backends = [];
  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2e3)
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      const models = data.models?.map((m) => m.name) || [];
      backends.push({
        id: "ollama",
        name: "Ollama (Local)",
        available: models.length > 0,
        models,
        isCloud: false
      });
    } else {
      backends.push({ id: "ollama", name: "Ollama (Local)", available: false, isCloud: false });
    }
  } catch {
    backends.push({ id: "ollama", name: "Ollama (Local)", available: false, isCloud: false });
  }
  backends.push({
    id: "groq",
    name: "Groq Cloud",
    available: !!(GROQ_API_KEY2 && GROQ_API_KEY2.startsWith("gsk_")),
    models: GROQ_API_KEY2 ? [GROQ_MODEL] : void 0,
    isCloud: true
  });
  backends.push({
    id: "claude",
    name: "Claude (Anthropic)",
    available: !!(ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.startsWith("sk-ant-")),
    models: ANTHROPIC_API_KEY ? [CLAUDE_MODEL] : void 0,
    isCloud: true
  });
  try {
    const localRes = await fetch(`${LOCAL_AI_URL}/tools`, {
      method: "GET",
      signal: AbortSignal.timeout(2e3)
    });
    backends.push({
      id: "local",
      name: "Local LLaMA",
      available: localRes.ok,
      isCloud: false
    });
  } catch {
    backends.push({ id: "local", name: "Local LLaMA", available: false, isCloud: false });
  }
  return backends;
};
var setActiveBackend = async (backend, model) => {
  const backends = await getAvailableBackends();
  const target = backends.find((b) => b.id === backend);
  if (!target) {
    return { success: false, message: `Unknown backend: ${backend}` };
  }
  if (!target.available) {
    return { success: false, message: `Backend ${backend} is not available` };
  }
  if (backend === "ollama" && model) {
    if (!target.models?.includes(model)) {
      const modelWithLatest = model.includes(":") ? model : `${model}:latest`;
      if (!target.models?.some((m) => m === modelWithLatest || m.startsWith(model))) {
        return {
          success: false,
          message: `Model ${model} not found. Available: ${target.models?.join(", ")}`
        };
      }
    }
    activeOllamaModel = model;
  }
  activeBackend2 = backend;
  backendChecked = true;
  console.log(`AI Backend manually switched to: ${backend}${model ? ` (model: ${model})` : ""}`);
  return {
    success: true,
    message: `Switched to ${target.name}${model ? ` with model ${model}` : ""}`
  };
};
var getCurrentBackendInfo = () => {
  let model = "unknown";
  if (activeBackend2 === "ollama") {
    model = activeOllamaModel;
  } else if (activeBackend2 === "groq") {
    model = GROQ_MODEL;
  } else if (activeBackend2 === "claude") {
    model = CLAUDE_MODEL;
  } else if (activeBackend2 === "local") {
    model = "local-llm";
  }
  return { backend: activeBackend2, model };
};
var checkAIHealth = async () => {
  if (!backendChecked) {
    await detectBackend2();
    backendChecked = true;
  }
  return {
    available: activeBackend2 !== "none",
    backend: activeBackend2
  };
};
async function callGroq(prompt, system, conversationHistory) {
  const messages = [
    { role: "system", content: system || "You are a helpful assistant." }
  ];
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory.map((m) => ({ role: m.role, content: m.content })));
  }
  messages.push({ role: "user", content: prompt });
  const maxRetries = 3;
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3e4);
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY2}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 1024
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (error) {
      lastError = error;
      const isRetryable = lastError.name === "AbortError" || lastError.message.includes("network") || lastError.message.includes("ECONNREFUSED") || lastError.message.includes("ETIMEDOUT") || lastError.message.includes("Groq API error: 5") && attempt < maxRetries - 1;
      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }
      console.log(`Groq API attempt ${attempt + 1} failed, retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 1e3 * Math.pow(2, attempt)));
    }
  }
  throw lastError || new Error("Groq API call failed after retries");
}
async function callAIWithFallback(prompt, system, conversationHistory) {
  const health = await checkAIHealth();
  const tryProvider = async (provider) => {
    switch (provider) {
      case "groq":
        return await callGroq(prompt, system, conversationHistory);
      case "claude":
        return await callClaude(prompt, system, conversationHistory);
      case "ollama":
        return await callOllama(prompt, system, conversationHistory);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  };
  const providers = ["groq", "ollama"];
  if (health.backend && health.backend !== "local" && health.backend !== "none") {
    const startIdx = providers.indexOf(health.backend);
    if (startIdx > 0) {
      providers.splice(startIdx, 1);
      providers.unshift(health.backend);
    }
  }
  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`[AI] Trying ${provider}...`);
      return await tryProvider(provider);
    } catch (error) {
      const errMsg = error.message;
      console.log(`[AI] ${provider} failed: ${errMsg.substring(0, 100)}`);
      lastError = error;
      if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("Rate limit")) {
        console.log(`[AI] Rate limit hit on ${provider}, trying fallback...`);
      }
    }
  }
  throw lastError || new Error("All AI providers failed");
}
async function callClaude(prompt, system, conversationHistory) {
  const messages = [];
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory.map((m) => ({ role: m.role, content: m.content })));
  }
  messages.push({ role: "user", content: prompt });
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: system || "You are a helpful assistant.",
      messages
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || "";
}
async function callOllama(prompt, system, conversationHistory) {
  let contextualPrompt = prompt;
  if (conversationHistory && conversationHistory.length > 0) {
    const historyText = conversationHistory.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
    contextualPrompt = `Previous conversation:
${historyText}

User: ${prompt}`;
  }
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: activeOllamaModel,
      prompt: contextualPrompt,
      system,
      stream: false
    })
  });
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }
  const data = await response.json();
  return data.response || "";
}
var parseQueryWithAI = async (query) => {
  const health = await checkAIHealth();
  if (!health.available) {
    return fallbackParse(query);
  }
  try {
    const response = await callAIWithFallback(
      `Parse this property search query and respond with JSON only:

"${query}"`,
      PROPERTY_SYSTEM_PROMPT
    );
    return extractJSONFromResponse(response, query);
  } catch (error) {
    console.error("AI parsing failed:", error);
    return fallbackParse(query);
  }
};
var generateResultsResponse = async (query, matchType, listingsCount, priceRange, locations) => {
  const health = await checkAIHealth();
  if (!health.available) {
    return matchType === "exact" ? `Found ${listingsCount} listings matching your search.` : `No exact matches at that price. Found ${listingsCount} alternatives within the acceptable range and 50km radius.`;
  }
  try {
    const prompt = `User searched for: "${query}"
Results: ${listingsCount} listings (${matchType} match)
Price range: ${priceRange.min ?? "any"} - ${priceRange.max ?? "any"} EUR
Locations: ${locations.join(", ") || "Various Portugal"}

Write a brief, helpful response (2-3 sentences) about these results. Be conversational.`;
    const response = await callAIWithFallback(prompt, "You are a helpful property search assistant. Keep responses brief and friendly.");
    return cleanResponse(response);
  } catch (error) {
    console.error("AI response failed:", error);
    return matchType === "exact" ? `Found ${listingsCount} listings matching your search.` : `No exact matches at that price. Found ${listingsCount} alternatives within the acceptable range.`;
  }
};
var detectIntent = async (message, conversationHistory, hasRecentResults) => {
  const health = await checkAIHealth();
  const lower = message.toLowerCase().trim();
  const confirmationPatterns = /^(yes|yeah|yep|yup|sure|please|ok|okay|go ahead|do it|definitely|absolutely|of course|please do|yes please)\.?$/i;
  if (confirmationPatterns.test(lower)) {
    if (conversationHistory && conversationHistory.length > 0) {
      const lastAssistantMsg = [...conversationHistory].reverse().find((m) => m.role === "assistant");
      if (lastAssistantMsg) {
        const assistantLower = lastAssistantMsg.content.toLowerCase();
        if (assistantLower.includes("search again") || assistantLower.includes("try searching") || assistantLower.includes("refine your search") || assistantLower.includes("would you like me to") || assistantLower.includes("shall i search") || assistantLower.includes("want me to search") || assistantLower.includes("focus on central") || assistantLower.includes("narrow down")) {
          return { intent: "refine_search", isPropertySearch: true, confirmationContext: lastAssistantMsg.content };
        }
      }
    }
    return { intent: "follow_up", isPropertySearch: false };
  }
  const searchIndicators = [
    /(?:find|show|search|looking for|want|need)\s+(?:me\s+)?(?:a\s+)?(?:land|house|apartment|villa|property|properties|flat)/i,
    /(?:under|below|around|about)\s+[\d€$£]+/i,
    /(?:in|near|around)\s+[A-Z][a-z]+.*(?:for|under|around)/i,
    /^(?:land|house|apartment|properties?)\s+(?:in|near|under|for)/i
  ];
  const conversationIndicators = [
    /^(?:hi|hello|hey|thanks|thank you|ok|okay|great|nice|good|how|what|why|when|who|where|can you|could you|tell me|explain)/i,
    /\?$/,
    /(?:about|advice|recommend|suggest|help me understand|what do you think)/i
  ];
  const showListingsPatterns = [
    /(?:show|display|list|see|view)\s+(?:me\s+)?(?:the|those|these|all|some)?\s*(?:listing|listings|properties|options|results)/i,
    /(?:show|give|display)\s+(?:me\s+)?(?:the|those|these)?\s*(?:best|top|cheapest|most expensive)/i,
    /(?:best|top|cheapest)\s+(?:one|ones|listing|listings|properties|options)/i,
    /(?:for sale|to buy|available)/i,
    /^show\s+(?:me\s+)?(?:them|those|these|the\s+listings?)/i
  ];
  const pickSelectPatterns = [
    /(?:pick|select|choose|get|give me|show me)\s+(\d+|one|two|three|four|five|a few|some|the best|top)\s*(?:of them|from them|that|which|listings?|properties?|options?|ones?)?/i,
    /(?:pick|select|choose)\s+(?:the\s+)?(?:\d+|one|two|three|four|five)\s*(?:closest|nearest|cheapest|best|top)/i,
    /(?:the\s+)?(?:\d+|two|three)\s+(?:closest|nearest|cheapest|best)\s*(?:to|ones?)?/i
  ];
  if (hasRecentResults) {
    for (const pattern of pickSelectPatterns) {
      if (pattern.test(message)) {
        return { intent: "pick_from_results", isPropertySearch: true };
      }
    }
  }
  for (const pattern of searchIndicators) {
    if (pattern.test(message)) {
      return { intent: "search", isPropertySearch: true };
    }
  }
  if (hasRecentResults) {
    for (const pattern of showListingsPatterns) {
      if (pattern.test(message)) {
        return { intent: "show_listings", isPropertySearch: true };
      }
    }
  }
  if (hasRecentResults) {
    const followUpPatterns = [
      /(?:cheaper|more expensive|different|another|other)\s+(?:one|ones|option|options|listing|listings)?/i,
      /(?:first|second|third|last)\s+(?:one|listing|property)/i,
      /^(?:and|also|what about|how about)/i
    ];
    for (const pattern of followUpPatterns) {
      if (pattern.test(message)) {
        if (lower.includes("cheaper") || lower.includes("expensive") || lower.includes("different") || lower.includes("another")) {
          return { intent: "refine_search", isPropertySearch: true };
        }
        return { intent: "follow_up", isPropertySearch: false };
      }
    }
  }
  for (const pattern of conversationIndicators) {
    if (pattern.test(message) && !searchIndicators.some((p) => p.test(message))) {
      return { intent: "conversation", isPropertySearch: false };
    }
  }
  if (health.available) {
    try {
      const contextInfo = conversationHistory && conversationHistory.length > 0 ? `
Recent conversation:
${conversationHistory.slice(-4).map((m) => `${m.role}: ${m.content}`).join("\n")}
` : "";
      const prompt = `${contextInfo}
User message: "${message}"

Determine the intent.`;
      const response = await callAIWithFallback(prompt, INTENT_DETECTION_PROMPT);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: parsed.intent || "search",
          isPropertySearch: parsed.isPropertySearch ?? true
        };
      }
    } catch (error) {
      console.error("Intent detection failed:", error);
    }
  }
  return { intent: "search", isPropertySearch: true };
};
var chatWithAI = async (message, conversationHistory, searchContext, conversationId) => {
  const health = await checkAIHealth();
  if (!health.available) {
    return "AI is currently unavailable. Please try your search - I can still find listings using the search system.";
  }
  await ensureRAGInitialized();
  const ragContext = await buildRAGContext(message, {
    includeKnowledge: true,
    includeListings: false,
    includeConversations: !!conversationId,
    conversationId,
    maxTokens: 1500
  });
  let contextualPrompt = message;
  const contextParts = [];
  if (ragContext) {
    contextParts.push(`KNOWLEDGE CONTEXT:
${ragContext}`);
  }
  if (searchContext) {
    contextParts.push(`RECENT SEARCH RESULTS:
${searchContext}`);
  }
  if (contextParts.length > 0) {
    contextualPrompt = `${contextParts.join("\n\n")}

USER QUESTION: ${message}`;
  }
  try {
    const response = await callAIWithFallback(contextualPrompt, RAG_ENHANCED_SYSTEM_PROMPT, conversationHistory);
    if (conversationId) {
      try {
        await storeConversation(conversationId, message, response, searchContext);
      } catch (err) {
        console.error("[RAG] Failed to store conversation:", err);
      }
    }
    return response;
  } catch (error) {
    console.error("AI chat failed:", error);
    return "I'm having trouble connecting to the AI. Please try again.";
  }
};
function extractJSONFromResponse(text, originalQuery) {
  const jsonMatch = text.match(/\{[\s\S]*"parsedIntent"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        parsedIntent: {
          ...parsed.parsedIntent,
          rawQuery: originalQuery
        },
        clarificationNeeded: parsed.clarificationNeeded ?? false,
        clarificationQuestion: parsed.clarificationQuestion,
        responseMessage: parsed.responseMessage ?? "Let me search for that..."
      };
    } catch {
    }
  }
  return fallbackParse(originalQuery);
}
function fallbackParse(query) {
  const lower = query.toLowerCase();
  let propertyType;
  if (/(land|plot|terrain|lote|terreno)/.test(lower)) propertyType = "land";
  else if (/(apartment|apartamento|apt|flat)/.test(lower)) propertyType = "apartment";
  else if (/(house|villa|casa|moradia|home)/.test(lower)) propertyType = "house";
  let priceTarget;
  let priceMin;
  let priceMax;
  let priceIntent = "none";
  const betweenMatch = lower.match(/between\s+([\d.,]+)\s*(?:k|thousand|mil)?\s*(?:and|to|-)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
  const underMatch = lower.match(/(?:under|below|max|up to|less than|<)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
  const overMatch = lower.match(/(?:over|above|min|at least|more than|>)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
  const forMatch = lower.match(/(?:for|at|around|about|~)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
  const plainMatch = query.match(/([\d.,]+)\s*(?:k|thousand|mil)?/i);
  const parseNumber = (str, suffix) => {
    let num = parseFloat(str.replace(/[,]/g, ""));
    const hasK = suffix?.toLowerCase().includes("k") || suffix?.toLowerCase().includes("thousand");
    const hasMil = suffix?.toLowerCase().includes("mil");
    if (hasK) num *= 1e3;
    if (hasMil) num *= 1e6;
    return num;
  };
  if (betweenMatch) {
    priceMin = parseNumber(betweenMatch[1]);
    priceMax = parseNumber(betweenMatch[2]);
    priceIntent = "between";
  } else if (underMatch) {
    priceMax = parseNumber(underMatch[1]);
    priceIntent = "under";
  } else if (overMatch) {
    priceMin = parseNumber(overMatch[1]);
    priceIntent = "over";
  } else if (forMatch) {
    priceTarget = parseNumber(forMatch[1]);
    priceIntent = "around";
  } else if (plainMatch) {
    priceTarget = parseNumber(plainMatch[1]);
    priceIntent = "around";
  }
  let currency;
  if (lower.includes("usd") || lower.includes("$") || lower.includes("dollar")) currency = "USD";
  else if (lower.includes("eur") || lower.includes("\u20AC") || lower.includes("euro")) currency = "EUR";
  else if (lower.includes("gbp") || lower.includes("\xA3") || lower.includes("pound")) currency = "GBP";
  let location;
  const locationPatterns = [
    /(?:in|near|around|at|close to)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i
  ];
  for (const pattern of locationPatterns) {
    const match = query.match(pattern);
    if (match && !["portugal", "pt"].includes(match[1].toLowerCase())) {
      location = match[1];
      break;
    }
  }
  let responseMessage = "Searching for ";
  if (propertyType) responseMessage += `${propertyType} `;
  else responseMessage += "properties ";
  if (location) responseMessage += `near ${location} `;
  if (priceTarget) responseMessage += `around ${currency === "USD" ? "$" : "\u20AC"}${priceTarget.toLocaleString()}`;
  else if (priceMax) responseMessage += `under ${currency === "USD" ? "$" : "\u20AC"}${priceMax.toLocaleString()}`;
  else if (priceMin) responseMessage += `over ${currency === "USD" ? "$" : "\u20AC"}${priceMin.toLocaleString()}`;
  responseMessage += "...";
  return {
    parsedIntent: {
      propertyType,
      priceMin,
      priceMax,
      priceTarget,
      priceIntent,
      currency,
      location,
      rawQuery: query
    },
    clarificationNeeded: false,
    responseMessage
  };
}
function cleanResponse(text) {
  return text.replace(/```json[\s\S]*?```/g, "").replace(/```[\s\S]*?```/g, "").replace(/\{[\s\S]*?\}/g, "").trim().slice(0, 500);
}
var LISTING_ANALYSIS_PROMPT = `You are an expert real estate analyst helping users find exactly what they're looking for in Portugal.

CRITICAL: First, understand EXACTLY what the user wants:
- Parse their query to identify: property type, specific features, location preferences, intended use
- "land for farming" = agricultural/rural land with good soil, water access
- "building plot" = urban land with construction permits
- "land with sea view" = coastal property with ocean visibility
- "vineyard" = agricultural land suitable for wine production
- "investment property" = something with rental/resale potential

CONSTRUCTION LAND IN PORTUGAL - CRITICAL RULES:
When user asks for "land for construction", "building land", "terreno para constru\xE7\xE3o", "lote":
- ONLY include listings with "urbano" (urban), "constru\xE7\xE3o" (construction), "lote" (plot), "viabilidade", "projeto aprovado"
- EXCLUDE listings with "r\xFAstico" (rural), "agr\xEDcola" (agricultural) - these CANNOT be built on!
- "Terreno r\xFAstico" = REJECT (no construction allowed)
- "Terreno urbano" or "lote de terreno" = ACCEPT (construction allowed)
- If listing doesn't mention land type, check price: urban plots are \u20AC30-300/sqm, rural is \u20AC1-15/sqm
- Very cheap land (under \u20AC5/sqm) is usually r\xFAstico and CANNOT be built on

For EACH listing, analyze:
1. TITLE: What does the Portuguese title tell us? (terreno=land, r\xFAstico=rural/NO BUILD, urbano=urban/CAN BUILD, quinta=farm estate)
2. DESCRIPTION: Read the full description carefully. Look for keywords about:
   - Land type (agr\xEDcola=agricultural/NO BUILD, constru\xE7\xE3o=building/OK, r\xFAstico=rustic/NO BUILD, urbano=urban/OK)
   - Features (\xE1gua=water, eletricidade=electricity, estrada=road access, vista=view)
   - Permits (licen\xE7a=license, projeto=project approved, alvar\xE1=permit)
   - Condition (para recuperar=needs work, pronto=ready)
3. SIZE & PRICE: Does the area make sense for the user's purpose?
4. LOCATION: Is it in the right region for what they want?

SCORING GUIDE:
- 90-100: Perfect match - exactly what user asked for
- 70-89: Good match - mostly fits with minor differences
- 50-69: Partial match - could work but not ideal
- Below 50: Not relevant - mark as isRelevant: false

BE STRICT: 
- If user wants "construction land" \u2192 ONLY show "urbano" or "lote" listings, REJECT all "r\xFAstico"
- If user wants "land" without specifying \u2192 show both but note which are buildable
- If user wants "farming land" \u2192 show r\xFAstico, REJECT urban plots

Respond with ONLY a valid JSON array:
[
  {
    "id": "listing-id",
    "isRelevant": true/false,
    "relevanceScore": 0-100,
    "reasoning": "2-3 sentence explanation in English of why this listing matches or doesn't match the user's specific needs. For construction queries, explicitly mention if land is urbano (buildable) or r\xFAstico (not buildable)."
  }
]`;
var AI_ANALYSIS_CONFIG = {
  // Skip AI analysis if more than this many listings (use local analysis instead)
  maxListingsForAI: 20,
  // Timeout for AI analysis in milliseconds (increased for Ollama fallback)
  analysisTimeoutMs: 6e4,
  // Enable/disable AI listing analysis (set to false for faster searches)
  enableAIAnalysis: true
};
var filterListingsByRelevance = async (userQuery, listings, options) => {
  const skipAI = options?.skipAI ?? !AI_ANALYSIS_CONFIG.enableAIAnalysis;
  const timeout = options?.timeout ?? AI_ANALYSIS_CONFIG.analysisTimeoutMs;
  if (skipAI || listings.length > AI_ANALYSIS_CONFIG.maxListingsForAI) {
    console.log(`[AI Analysis] Using fast local analysis (skipAI=${skipAI}, listings=${listings.length})`);
    return analyzeListingsLocally(userQuery, listings);
  }
  const health = await checkAIHealth();
  if (!health.available || listings.length === 0) {
    return listings.map((l) => ({
      id: l.id,
      isRelevant: true,
      relevanceScore: 50,
      reasoning: "AI unavailable - showing all results"
    }));
  }
  const listingSummaries = listings.map((l, idx) => {
    const photoInfo = l.photos.length > 0 ? `Photos: ${l.photos.length} image(s)` : "No photos";
    const cleanDesc = l.description ? l.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400) : "No description available";
    return `
LISTING ${idx + 1} (ID: ${l.id}):
Title: "${l.title}"
Price: \u20AC${l.priceEur.toLocaleString()}
Area: ${l.areaSqm ? `${l.areaSqm.toLocaleString()} m\xB2` : "Not specified"}
Property Type: ${l.propertyType || "Not specified"}
Location: ${l.city || l.locationLabel || "Portugal"}
Description: "${cleanDesc}"
${photoInfo}`;
  }).join("\n" + "=".repeat(50));
  const prompt = `USER SEARCH QUERY: "${userQuery}"

IMPORTANT: Understand what the user REALLY wants. Parse their query for:
- Property type (land, house, apartment, farm, etc.)
- Specific features they mentioned
- Their apparent purpose (farming, building, investment, living, etc.)

Now analyze these ${listings.length} listings from Portugal:
${listingSummaries}

For EACH listing, determine if it genuinely matches what the user is looking for.
Return a JSON array with your analysis.`;
  try {
    console.log(`[AI Analysis] Analyzing ${listings.length} listings with ${health.backend} backend (timeout: ${timeout}ms)...`);
    const aiCallPromise = callAIWithFallback(prompt, LISTING_ANALYSIS_PROMPT);
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(() => reject(new Error("AI analysis timeout")), timeout)
    );
    const response = await Promise.race([aiCallPromise, timeoutPromise]);
    console.log(`[AI Analysis] Got response (${response.length} chars)`);
    let jsonStr = null;
    const codeBlockMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }
    if (!jsonStr) {
      const startIdx = response.indexOf("[");
      if (startIdx !== -1) {
        let depth = 0;
        let endIdx = startIdx;
        for (let i = startIdx; i < response.length; i++) {
          if (response[i] === "[") depth++;
          else if (response[i] === "]") {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
        if (depth === 0 && endIdx > startIdx) {
          jsonStr = response.slice(startIdx, endIdx);
        }
      }
    }
    if (jsonStr) {
      try {
        const rawResults = JSON.parse(jsonStr);
        const results = rawResults.map((r) => ({
          id: String(r.id || ""),
          isRelevant: r.isRelevant === true || r.isRelevant === "true" || r.relevant === true,
          relevanceScore: typeof r.relevanceScore === "number" ? r.relevanceScore : typeof r.relevanceScore === "string" ? parseInt(r.relevanceScore, 10) : typeof r.score === "number" ? r.score : 50,
          reasoning: String(r.reasoning || r.reason || r.explanation || "Analyzed by AI")
        }));
        const validResults = results.filter((r) => r.id && r.id.length > 0);
        console.log(`[AI Analysis] Parsed ${validResults.length} valid results from ${rawResults.length} total`);
        if (validResults.length > 0) {
          const resultMap = new Map(validResults.map((r) => [r.id, r]));
          return listings.map((l) => {
            const aiResult = resultMap.get(l.id);
            if (aiResult) {
              return aiResult;
            }
            const altResult = validResults.find(
              (r) => r.id.includes(l.id) || l.id.includes(r.id) || r.reasoning?.toLowerCase().includes(l.title?.toLowerCase().slice(0, 20))
            );
            if (altResult) {
              return { ...altResult, id: l.id };
            }
            return {
              id: l.id,
              isRelevant: true,
              relevanceScore: 60,
              reasoning: "Included based on search criteria"
            };
          });
        }
      } catch (parseError) {
        console.error("[AI Analysis] JSON parse error:", parseError);
        console.log("[AI Analysis] Raw JSON attempt:", jsonStr?.slice(0, 500));
      }
    } else {
      console.log("[AI Analysis] No JSON array found in response");
      console.log("[AI Analysis] Response preview:", response.slice(0, 500));
    }
  } catch (error) {
    console.error("[AI Analysis] Failed:", error);
  }
  console.log("[AI Analysis] Using smart local fallback");
  return analyzeListingsLocally(userQuery, listings);
};
function analyzeListingsLocally(userQuery, listings) {
  const query = userQuery.toLowerCase();
  const wantsApartment = /apartment|apartamento|apt|flat/.test(query) && !/house|moradia|villa/.test(query);
  const wantsHouse = /house|casa|moradia|villa|vivenda|quinta/.test(query);
  const wantsLand = /land|terreno|plot|lote|terrain/.test(query);
  const wantsConstructionLand = /construct|build|construção|construir|building plot|lote para|urbano/.test(query) && wantsLand;
  const wantsFarmingLand = /farm|agric|farming|cultiv|rústico|agrícola/.test(query) && wantsLand;
  const wantsRoom = /room|quarto|bedroom/.test(query);
  const wantsForSale = /sale|buy|compra|venda|purchase|\d{5,}/.test(query);
  const wantsForRent = /rent|arrendar|alugar|aluguer/.test(query);
  const locationWords = query.match(/(?:in|near|around)\s+(\w+)/i)?.[1]?.toLowerCase();
  return listings.map((l) => {
    const title = l.title.toLowerCase();
    const desc = (l.description || "").toLowerCase();
    const city = (l.city || "").toLowerCase();
    const combined = `${title} ${desc}`;
    let score = 50;
    let reasons = [];
    let isRelevant = true;
    const isRoom = /quarto(?!\s+de\s+banho)|room\b|single room/.test(combined) && !/apartamento|moradia|t[1-4]/.test(title);
    const isApartment = /apartamento|apartment|flat|\bt[0-4]\b/.test(combined) && !isRoom && !/moradia|house|villa/.test(title);
    const isHouse = /moradia|house|villa|vivenda|quinta/.test(combined) && !isApartment;
    const isLand = /terreno|land|lote|plot|rústico/.test(combined);
    const isCommercial = /comercial|loja|armazém|pavilh|escritório|office/.test(combined);
    const isMobileHome = /mobil\s*home|caravana|rulote/.test(combined);
    const isUrbanLand = isLand && /urbano|urbanizável|construção|lote de|para construir|viabilidade|projeto aprovado|alvará/.test(combined);
    const isRuralLand = isLand && /rústico|rústica|agrícola|agricultural|rural/.test(combined);
    const isLandBuildable = isUrbanLand && !isRuralLand;
    const propertyType = isRoom ? "Room" : isApartment ? "Apartment" : isHouse ? "House/Villa" : isUrbanLand ? "Urban Land (buildable)" : isRuralLand ? "Rural Land (not buildable)" : isLand ? "Land" : isCommercial ? "Commercial" : isMobileHome ? "Mobile Home" : "Property";
    if (wantsApartment) {
      if (isApartment) {
        score += 35;
        reasons.push(`${propertyType} in ${l.city || "the area"}`);
      } else if (isRoom) {
        score -= 25;
        reasons.push(`This is a room rental, not a full apartment`);
        isRelevant = false;
      } else if (isHouse) {
        score += 10;
        reasons.push(`${propertyType} - you searched for apartments`);
      } else if (isCommercial) {
        score -= 30;
        reasons.push(`Commercial property, not residential`);
        isRelevant = false;
      } else if (isMobileHome) {
        score -= 10;
        reasons.push(`Mobile home listing`);
      }
    } else if (wantsHouse) {
      if (isHouse) {
        score += 35;
        reasons.push(`${propertyType} matches your search`);
      } else if (isApartment) {
        score += 5;
        reasons.push(`${propertyType} - you searched for houses`);
      }
    } else if (wantsLand && isLand) {
      if (wantsConstructionLand) {
        if (isUrbanLand && !isRuralLand) {
          score += 40;
          reasons.push(`Urban land - suitable for construction`);
        } else if (isRuralLand) {
          score -= 40;
          reasons.push(`\u26A0\uFE0F Rural/r\xFAstico land - CANNOT build on this`);
          isRelevant = false;
        } else {
          const pricePerSqm = l.areaSqm && l.areaSqm > 0 ? l.priceEur / l.areaSqm : 0;
          if (pricePerSqm > 20) {
            score += 20;
            reasons.push(`Land (\u20AC${Math.round(pricePerSqm)}/m\xB2 suggests buildable)`);
          } else if (pricePerSqm > 0 && pricePerSqm < 10) {
            score -= 20;
            reasons.push(`Low price (\u20AC${Math.round(pricePerSqm)}/m\xB2) suggests rural/unbuildable`);
            isRelevant = false;
          } else {
            reasons.push(`Land - verify if urbano (buildable) or r\xFAstico (not buildable)`);
          }
        }
      } else if (wantsFarmingLand) {
        if (isRuralLand) {
          score += 40;
          reasons.push(`Rural/agricultural land - suitable for farming`);
        } else if (isUrbanLand) {
          score -= 10;
          reasons.push(`Urban land - designed for construction, not farming`);
        } else {
          score += 20;
          reasons.push(`Land plot - check if suitable for agriculture`);
        }
      } else {
        score += 30;
        if (isUrbanLand) {
          reasons.push(`Urban land (construction allowed)`);
        } else if (isRuralLand) {
          reasons.push(`Rural land (agricultural use only)`);
        } else {
          reasons.push(`Land plot - verify land classification`);
        }
      }
    } else if (wantsRoom && isRoom) {
      score += 25;
      reasons.push(`Room rental matches your search`);
    } else if (wantsApartment && isCommercial) {
      score -= 30;
      reasons.push(`Commercial property, not residential`);
      isRelevant = false;
    } else if (!wantsApartment && !wantsHouse && !wantsLand && !wantsRoom) {
      if (isApartment || isHouse) {
        score += 20;
        reasons.push(`${propertyType} in ${l.city || "the area"}`);
      }
    }
    if (locationWords && city.includes(locationWords)) {
      score += 15;
      if (reasons.length === 0) {
        reasons.push(`Located in ${l.city}`);
      }
    }
    const forRent = /arrendar|alugar|aluguer|rent|mês|month|mensal/.test(combined) || l.priceEur < 3e3 && l.priceEur > 100;
    const forSale = /venda|vender|sale|compra/.test(combined) || l.priceEur > 3e4;
    if (wantsForSale && forRent && !forSale) {
      score -= 20;
      reasons.push(`Rental listing (\u20AC${l.priceEur}/month)`);
      isRelevant = l.priceEur > 1e4;
    } else if (wantsForRent && forSale && !forRent) {
      score -= 15;
      reasons.push(`For sale at \u20AC${l.priceEur.toLocaleString()}`);
    } else if (forSale && l.priceEur > 0) {
      reasons.push(`\u20AC${l.priceEur.toLocaleString()}`);
    }
    if (l.areaSqm && l.areaSqm > 0) {
      const sizeInfo = `${l.areaSqm}m\xB2`;
      if (!reasons.some((r) => r.includes("m\xB2"))) {
        reasons.push(sizeInfo);
      }
    }
    score = Math.max(10, Math.min(95, score));
    let reasoning;
    if (reasons.length > 0) {
      reasoning = reasons.slice(0, 2).join(". ");
      if (!reasoning.endsWith(".")) reasoning += ".";
    } else {
      reasoning = `${propertyType} in ${l.city || "Portugal"} at \u20AC${l.priceEur.toLocaleString()}.`;
    }
    return {
      id: l.id,
      isRelevant,
      relevanceScore: score,
      reasoning
    };
  });
}
var getRelevantListings = async (userQuery, listings) => {
  if (listings.length === 0) return [];
  const relevanceResults = await filterListingsByRelevance(userQuery, listings);
  const relevanceMap = new Map(relevanceResults.map((r) => [r.id, r]));
  return listings.map((listing) => ({
    listing,
    relevance: relevanceMap.get(listing.id) || {
      id: listing.id,
      isRelevant: true,
      relevanceScore: 50,
      reasoning: "Default"
    }
  })).filter((item) => item.relevance.isRelevant).sort((a, b) => b.relevance.relevanceScore - a.relevance.relevanceScore);
};
var getRAGSystemStats = () => {
  return getRAGStats();
};
var pickBestListings = async (userQuery, listings, count = 2) => {
  if (listings.length === 0) {
    return { selectedListings: [], explanation: "No listings available to pick from." };
  }
  const countMatch = userQuery.match(/(\d+|one|two|three|four|five|a few|some)/i);
  if (countMatch) {
    const numWords = { one: 1, two: 2, three: 3, four: 4, five: 5, "a few": 3, some: 3 };
    const parsed = numWords[countMatch[1].toLowerCase()] || parseInt(countMatch[1]);
    if (!isNaN(parsed)) count = parsed;
  }
  count = Math.min(count, listings.length);
  const health = await checkAIHealth();
  if (!health.available) {
    return {
      selectedListings: listings.slice(0, count),
      explanation: `Here are the top ${count} listings from your search.`
    };
  }
  const listingData = listings.slice(0, 30).map((l, idx) => ({
    index: idx,
    id: l.id,
    title: l.title,
    price: l.priceEur || l.displayPrice,
    location: l.locationLabel || l.city,
    distance: l.distanceKm,
    beds: l.beds,
    baths: l.baths,
    area: l.areaSqm,
    propertyType: l.propertyType
  }));
  const pickPrompt = `You are helping a user select properties from their search results.

User request: "${userQuery}"

Available listings:
${JSON.stringify(listingData, null, 2)}

TASK: Select the ${count} best listings that match the user's criteria.
- If they want "closest to center", prioritize by distance (lower distanceKm = closer)
- If they want "cheapest", prioritize by price
- If they want "best", use overall value (price/quality/location balance)

Respond with ONLY a valid JSON object:
{
  "selectedIndices": [0, 3],  // Array of indices from the listings
  "explanation": "I selected these because... (2-3 sentences explaining why these are the best choices)"
}`;
  try {
    const response = await callAIWithFallback(pickPrompt, "You are a helpful real estate assistant that selects the best properties based on user criteria.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const indices = parsed.selectedIndices || [];
      const selectedListings = indices.filter((i) => i >= 0 && i < listings.length).slice(0, count).map((i) => listings[i]);
      return {
        selectedListings,
        explanation: parsed.explanation || `Here are the ${count} best options based on your criteria.`
      };
    }
  } catch (error) {
    console.error("Error picking listings with AI:", error);
  }
  const sortedListings = [...listings].sort((a, b) => {
    if (userQuery.toLowerCase().includes("closest") || userQuery.toLowerCase().includes("center")) {
      return (a.distanceKm || 999) - (b.distanceKm || 999);
    }
    return (a.priceEur || 0) - (b.priceEur || 0);
  });
  return {
    selectedListings: sortedListings.slice(0, count),
    explanation: `Here are the ${count} listings that best match your criteria.`
  };
};

// src/services/searchService.ts
var adapterById = new Map(ADAPTERS.map((adapter2) => [adapter2.siteId, adapter2]));
var detectListingType = (listing) => {
  const title = listing.title.toLowerCase();
  const desc = (listing.description || "").toLowerCase();
  const combined = `${title} ${desc}`;
  const rentKeywords = /arrendar|alugar|aluguer|rent|arrendamento|por mês|per month|\/mês|\/month|mensal|monthly/.test(combined);
  const lowPrice = listing.priceEur > 0 && listing.priceEur < 5e3;
  const saleKeywords = /venda|vender|à venda|for sale|compra|comprar|sale/.test(combined);
  const highPrice = listing.priceEur >= 3e4;
  if (listing.listingType) {
    return listing.listingType;
  } else if (rentKeywords || lowPrice && !saleKeywords && !highPrice) {
    return "rent";
  } else if (saleKeywords || highPrice) {
    return "sale";
  }
  return void 0;
};
var convertIntentToEur = (intent, fallbackCurrency) => {
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
        currency: "EUR"
      };
    case "exact":
    case "around":
      return { ...intent, target: toEur(intent.target, currency), currency: "EUR" };
    default:
      return intent;
  }
};
var filterListings = (listings, priceRange, radiusKm, userLat, userLng) => {
  return listings.map((listing) => {
    let distance;
    if (listing.lat !== void 0 && listing.lng !== void 0) {
      distance = computeDistanceKm(
        { lat: userLat, lng: userLng },
        { lat: listing.lat, lng: listing.lng }
      );
    }
    return { listing, distance };
  }).filter(({ listing, distance }) => {
    const withinPrice = (priceRange.min === void 0 || listing.priceEur >= priceRange.min) && (priceRange.max === void 0 || listing.priceEur <= priceRange.max);
    const withinGeo = distance === void 0 || withinRadius(
      { lat: userLat, lng: userLng },
      { lat: listing.lat ?? userLat, lng: listing.lng ?? userLng },
      radiusKm
    );
    return withinPrice && withinGeo;
  }).map(({ listing, distance }) => ({ listing, distance }));
};
var toCard = (listing, distanceKm2, relevanceScore, relevanceReasoning) => {
  const title = listing.title.toLowerCase();
  const desc = (listing.description || "").toLowerCase();
  const combined = `${title} ${desc}`;
  const rentKeywords = /arrendar|alugar|aluguer|rent|arrendamento|por mês|per month|\/mês|\/month|mensal|monthly/.test(combined);
  const lowPrice = listing.priceEur > 0 && listing.priceEur < 5e3;
  const saleKeywords = /venda|vender|à venda|for sale|compra|comprar|sale/.test(combined);
  const highPrice = listing.priceEur >= 3e4;
  let listingType;
  if (listing.listingType) {
    listingType = listing.listingType;
  } else if (rentKeywords || lowPrice && !saleKeywords && !highPrice) {
    listingType = "rent";
  } else if (saleKeywords || highPrice) {
    listingType = "sale";
  }
  let propertyType = listing.propertyType;
  if (!propertyType || propertyType === "land") {
    const isRoom = /quarto(?!\s+de\s+banho)|room\b/.test(combined) && !/apartamento|moradia|t[1-4]/.test(title);
    const isApartment = /apartamento|apartment|flat|\bt[0-4]\b/.test(combined) && !isRoom;
    const isHouse = /moradia|house|villa|vivenda|quinta/.test(combined) && !isApartment;
    const isLand = /terreno|land|lote|plot|rústico/.test(combined);
    if (isRoom) propertyType = "Room";
    else if (isApartment) propertyType = "Apartment";
    else if (isHouse) propertyType = "House";
    else if (isLand) propertyType = "Land";
  }
  return {
    id: listing.id,
    title: listing.title,
    priceEur: listing.priceEur,
    displayPrice: formatCurrency(listing.priceEur, "EUR") + (listingType === "rent" ? "/mo" : ""),
    locationLabel: listing.city ?? listing.address ?? "Portugal",
    beds: listing.beds,
    baths: listing.baths,
    areaSqm: listing.areaSqm,
    image: listing.photos[0],
    sourceSite: listing.sourceSite,
    sourceUrl: listing.sourceUrl,
    distanceKm: distanceKm2,
    matchScore: relevanceScore ?? 0,
    aiReasoning: relevanceReasoning,
    listingType,
    propertyType
  };
};
var runAdapterSearch = async (query, priceRange, propertyType) => {
  const adapters = APP_CONFIG.mockData ? [mockAdapter] : ADAPTERS;
  const results = [];
  for (const adapter2 of adapters) {
    try {
      const listings = await adapter2.searchListings({
        query: query.query,
        priceRange,
        userLocation: query.userLocation,
        propertyType
      });
      results.push(...listings);
    } catch (error) {
      console.error(`[Search] ${adapter2.siteId} adapter failed:`, error);
    }
  }
  return results;
};
var runSearch = async (request) => {
  const parsed = parseUserQuery(request.query);
  const inferredCurrency = guessCurrency(request.query) ?? request.userLocation.currency;
  const intentInEur = convertIntentToEur(parsed.priceIntent, inferredCurrency);
  const strictRange = buildStrictPriceRange(intentInEur, "EUR", MATCH_RULES);
  const nearMissRange = buildNearMissPriceRange(intentInEur, "EUR", MATCH_RULES);
  const diagnostics = await Promise.all(SITE_POLICIES.map((policy) => diagnoseSite(policy)));
  const blockedSites = diagnostics.filter((diag) => diag.accessMethod === "BYOC" || diag.accessMethod === "NONE").map((diag) => ({
    siteId: diag.siteId,
    siteName: diag.siteName,
    requiredMethod: diag.accessMethod,
    reason: diag.reason
  }));
  const listings = await runAdapterSearch(request, strictRange, parsed.propertyType);
  let filtered = filterListings(
    listings,
    strictRange,
    MATCH_RULES.strictRadiusKm,
    request.userLocation.lat,
    request.userLocation.lng
  );
  if (parsed.listingIntent) {
    const beforeCount = filtered.length;
    filtered = filtered.filter(({ listing }) => {
      const detectedType = detectListingType(listing);
      return detectedType === parsed.listingIntent || detectedType === void 0;
    });
    console.log(`[Search] Filtered by ${parsed.listingIntent}: ${beforeCount} \u2192 ${filtered.length} listings`);
  }
  let matchType = "exact";
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
    if (parsed.listingIntent) {
      nearFiltered = nearFiltered.filter(({ listing }) => {
        const detectedType = detectListingType(listing);
        return detectedType === parsed.listingIntent || detectedType === void 0;
      });
    }
    filtered = nearFiltered;
    matchType = "near-miss";
    appliedRange = nearMissRange;
  }
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
    _distance: distance
  }));
  const relevantListings = await getRelevantListings(request.query, listingsForAnalysis);
  const responseListings = relevantListings.map(
    ({ listing, relevance }) => toCard(
      listing._original,
      listing._distance,
      relevance.relevanceScore,
      relevance.reasoning
    )
  );
  const searchId = import_node_crypto.default.randomUUID();
  saveSearch({
    id: searchId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    listings: relevantListings.map(({ listing }) => listing._original)
  });
  const aiFilteredCount = filtered.length - relevantListings.length;
  const listingTypeLabel = parsed.listingIntent === "rent" ? "for rent" : parsed.listingIntent === "sale" ? "for sale" : "";
  const note = matchType === "exact" ? aiFilteredCount > 0 ? `Found ${relevantListings.length} ${listingTypeLabel} listings${aiFilteredCount > 0 ? ` (filtered from ${filtered.length})` : ""}.` : `Showing ${relevantListings.length} ${listingTypeLabel} listings.`.trim() : aiFilteredCount > 0 ? `AI analyzed ${filtered.length} near-miss results, showing ${relevantListings.length} most relevant ${listingTypeLabel}.` : `No exact matches. Showing ${relevantListings.length} closest ${listingTypeLabel} matches.`.trim();
  return {
    searchId,
    matchType,
    note,
    appliedPriceRange: appliedRange,
    appliedRadiusKm: matchType === "exact" ? MATCH_RULES.strictRadiusKm : MATCH_RULES.nearMissRadiusKm,
    listings: responseListings,
    blockedSites
  };
};

// src/routes/search.ts
var router = (0, import_express.Router)();
var searchSchema = import_zod.z.object({
  query: import_zod.z.string().min(3),
  userLocation: import_zod.z.object({
    label: import_zod.z.string().min(2),
    lat: import_zod.z.number(),
    lng: import_zod.z.number(),
    currency: import_zod.z.string().min(3)
  })
});
router.post("/search", async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const request = {
      query: parsed.data.query,
      userLocation: parsed.data.userLocation
    };
    const response = await runSearch(request);
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});
var search_default = router;

// src/routes/report.ts
var import_express2 = require("express");
var import_zod2 = require("zod");

// src/services/reportService.ts
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path3 = __toESM(require("node:path"));
var ensureReportsDir = async () => {
  await import_promises.default.mkdir(APP_CONFIG.reportsDir, { recursive: true });
};
async function generateMultipleListingPdfs(listings) {
  throw new Error("PDF generation is not available in cloud deployment.");
}
async function savePdfToDisk(filename, pdfBuffer) {
  await ensureReportsDir();
  const filePath = import_node_path3.default.join(APP_CONFIG.reportsDir, filename);
  await import_promises.default.writeFile(filePath, pdfBuffer);
  console.log(`[Report] Saved: ${filePath}`);
  return filename;
}

// src/routes/report.ts
var router2 = (0, import_express2.Router)();
var generatePdfsSchema = import_zod2.z.object({
  listings: import_zod2.z.array(import_zod2.z.object({
    id: import_zod2.z.string(),
    title: import_zod2.z.string(),
    priceEur: import_zod2.z.number(),
    displayPrice: import_zod2.z.string(),
    locationLabel: import_zod2.z.string(),
    beds: import_zod2.z.number().optional(),
    baths: import_zod2.z.number().optional(),
    areaSqm: import_zod2.z.number().optional(),
    image: import_zod2.z.string().optional(),
    sourceSite: import_zod2.z.string(),
    sourceUrl: import_zod2.z.string(),
    aiReasoning: import_zod2.z.string().optional(),
    matchScore: import_zod2.z.number().optional(),
    listingType: import_zod2.z.enum(["sale", "rent"]).optional(),
    propertyType: import_zod2.z.string().optional()
  })).min(1)
});
router2.post("/generate", async (req, res) => {
  const parsed = generatePdfsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const listings = parsed.data.listings;
    console.log(`[Report] Generating PDFs for ${listings.length} listings`);
    const pdfResults = await generateMultipleListingPdfs(listings);
    if (pdfResults.length === 0) {
      return res.status(500).json({ error: "Failed to generate any PDFs" });
    }
    const savedFiles = [];
    for (const { filename, pdfBuffer } of pdfResults) {
      await savePdfToDisk(filename, pdfBuffer);
      savedFiles.push({
        filename,
        url: `/reports/${filename}`
      });
    }
    console.log(`[Report] Successfully generated ${savedFiles.length} PDFs`);
    return res.json({
      success: true,
      count: savedFiles.length,
      files: savedFiles
    });
  } catch (error) {
    console.error("[Report] Generation failed:", error);
    return res.status(500).json({ error: String(error) });
  }
});
var report_default = router2;

// src/routes/diagnostics.ts
var import_express3 = require("express");
var router3 = (0, import_express3.Router)();
router3.get("/diagnostics", async (_req, res) => {
  const diagnostics = await Promise.all(
    SITE_POLICIES.map((policy) => diagnoseSite(policy))
  );
  return res.json({ diagnostics });
});
var diagnostics_default = router3;

// src/routes/chat.ts
var import_express4 = require("express");
var import_zod3 = require("zod");

// src/services/agentService.ts
var GROQ_API_KEY3 = process.env.GROQ_API_KEY ?? "";
var GROQ_MODEL2 = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
var ANTHROPIC_API_KEY2 = process.env.ANTHROPIC_API_KEY ?? "";
var CLAUDE_MODEL2 = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
var OLLAMA_URL2 = process.env.OLLAMA_URL ?? "http://localhost:11434";
var OLLAMA_MODEL2 = process.env.OLLAMA_MODEL ?? "llama3.3-thinking-claude";
var AGENT_TOOLS = [
  {
    name: "search_properties",
    description: "Search for properties in Portugal based on criteria like location, price, property type",
    parameters: {
      query: { type: "string", description: "Natural language search query", required: true },
      location: { type: "string", description: "Location name (city/region in Portugal)" },
      maxPrice: { type: "number", description: "Maximum price in EUR" },
      propertyType: { type: "string", description: "Type: land, apartment, house, villa" }
    }
  },
  {
    name: "analyze_listing",
    description: "Get detailed analysis of a specific listing",
    parameters: {
      listingId: { type: "string", description: "The listing ID to analyze", required: true }
    }
  },
  {
    name: "compare_listings",
    description: "Compare multiple listings side by side",
    parameters: {
      listingIds: { type: "array", description: "Array of listing IDs to compare", required: true }
    }
  },
  {
    name: "get_market_info",
    description: "Get market information about a region in Portugal",
    parameters: {
      region: { type: "string", description: "Region name (e.g., Algarve, Lisbon, Porto)", required: true }
    }
  },
  {
    name: "calculate_costs",
    description: "Calculate total costs including taxes and fees for a property purchase",
    parameters: {
      price: { type: "number", description: "Property price in EUR", required: true },
      isResident: { type: "boolean", description: "Whether buyer is Portuguese resident" }
    }
  }
];
var currentSearchResults = null;
var AGENT_SYSTEM_PROMPT = `You are an intelligent property search agent for Portugal. You help users find properties by breaking down their requests and using available tools.

AVAILABLE TOOLS:
${AGENT_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

RESPONSE FORMAT:
You must respond in this exact format for each step:

THOUGHT: [Your reasoning about what to do next]
ACTION: [tool_name]
INPUT: [JSON object with tool parameters]

After receiving observations, continue with more thoughts/actions until you have enough information.
When ready to give final answer:

THOUGHT: [Final reasoning]
FINAL_ANSWER: [Your comprehensive response to the user]

RULES:
1. Always start with a THOUGHT
2. Use tools to gather information before answering
3. Be thorough - use multiple searches if needed
4. Compare options when user asks for recommendations
5. Include specific details (prices, locations, sizes) in final answer
6. Keep final answer conversational and helpful

EXAMPLE:
User: "Find me cheap land near Lisbon for building a house"

THOUGHT: User wants building land near Lisbon at a low price. I should search for urban/building plots in the Lisbon area.
ACTION: search_properties
INPUT: {"query": "building land near Lisbon", "location": "Lisbon", "propertyType": "land"}

[After observation]

THOUGHT: I found some results. Let me analyze the best options and provide recommendations.
FINAL_ANSWER: I found X plots of land near Lisbon suitable for building...`;
async function executeAgentTool(tool, input, userLocation) {
  console.log(`[Agent] Executing tool: ${tool}`, input);
  switch (tool) {
    case "search_properties": {
      const query = String(input.query || "property in Portugal");
      const searchResult = await runSearch({
        query,
        userLocation
      });
      currentSearchResults = searchResult;
      const summary = searchResult.listings.length > 0 ? `Found ${searchResult.listings.length} properties. Top results: ${searchResult.listings.slice(0, 3).map((l) => `${l.title} (\u20AC${l.priceEur.toLocaleString()})`).join(", ")}` : "No properties found matching the criteria.";
      return { success: true, result: searchResult, summary };
    }
    case "analyze_listing": {
      const listingId = String(input.listingId);
      const listing = currentSearchResults?.listings.find((l) => l.id === listingId);
      if (!listing) {
        return { success: false, result: null, summary: `Listing ${listingId} not found in current results` };
      }
      const analysis = `
Listing Analysis for: ${listing.title}
- Price: \u20AC${listing.priceEur.toLocaleString()}
- Location: ${listing.locationLabel}
- Area: ${listing.areaSqm ? `${listing.areaSqm} m\xB2` : "Not specified"}
- Beds: ${listing.beds || "N/A"}, Baths: ${listing.baths || "N/A"}
- Distance: ${listing.distanceKm ? `${listing.distanceKm.toFixed(1)} km from your location` : "N/A"}
- AI Score: ${listing.matchScore}/100
- Source: ${listing.sourceSite}`;
      return { success: true, result: listing, summary: analysis };
    }
    case "compare_listings": {
      const ids = input.listingIds;
      const listings = currentSearchResults?.listings.filter((l) => ids.includes(l.id)) || [];
      if (listings.length === 0) {
        return { success: false, result: null, summary: "No listings found for comparison" };
      }
      const comparison = listings.map(
        (l) => `\u2022 ${l.title}: \u20AC${l.priceEur.toLocaleString()}, ${l.areaSqm || "?"} m\xB2, ${l.locationLabel}`
      ).join("\n");
      return {
        success: true,
        result: listings,
        summary: `Comparing ${listings.length} listings:
${comparison}`
      };
    }
    case "get_market_info": {
      const region = String(input.region || input.location || input.area || "portugal").toLowerCase();
      const marketData = {
        portugal: "Portugal: Growing real estate market. Average prices vary by region: Lisbon \u20AC4,000-6,000/m\xB2, Porto \u20AC2,500-4,000/m\xB2, Algarve \u20AC2,500-4,000/m\xB2, Alentejo \u20AC500-1,500/m\xB2. Foreign buyers welcome. IMT tax 0-8%, Stamp duty 0.8%.",
        algarve: "Algarve: Popular tourist region in southern Portugal. Average property prices \u20AC2,500-4,000/m\xB2. High rental demand. Golden Visa eligible for investments over \u20AC500k.",
        lisbon: "Lisbon: Capital city with strong economy. Average prices \u20AC4,000-6,000/m\xB2 in city center. High demand, competitive market. Good rental yields 4-6%.",
        porto: "Porto: Second largest city, growing tech hub. Average prices \u20AC2,500-4,000/m\xB2. Strong appreciation potential. UNESCO historic center.",
        alentejo: "Alentejo: Rural region, affordable land. Average \u20AC500-1,500/m\xB2. Large plots available. Good for agriculture or rural tourism.",
        "silver coast": "Silver Coast: Beach communities north of Lisbon. \u20AC1,500-3,000/m\xB2. Popular with expats. Good value compared to Algarve.",
        madeira: "Madeira: Atlantic island, subtropical climate. \u20AC2,000-3,500/m\xB2. Limited land availability. Strong tourism sector."
      };
      const info = marketData[region] || `${region}: Contact local agents for market information.`;
      return { success: true, result: { region, info }, summary: info };
    }
    case "calculate_costs": {
      const price = Number(input.price || input.purchase_price || input.property_price || input.amount || 0);
      const isResident = Boolean(input.isResident || input.is_resident);
      if (!price || isNaN(price)) {
        return { success: false, result: null, summary: "Please provide a valid property price" };
      }
      let imtRate = 0;
      if (price <= 97064) imtRate = 0;
      else if (price <= 132774) imtRate = 0.02;
      else if (price <= 181034) imtRate = 0.05;
      else if (price <= 301688) imtRate = 0.07;
      else if (price <= 578598) imtRate = 0.08;
      else imtRate = 0.06;
      const imt = price * imtRate;
      const stampDuty = price * 8e-3;
      const notaryFees = Math.min(price * 0.01, 2e3);
      const registryFees = 250;
      const legalFees = Math.max(price * 0.01, 1500);
      const totalCosts = imt + stampDuty + notaryFees + registryFees + legalFees;
      const totalPrice = price + totalCosts;
      const summary = `
Cost Calculation for \u20AC${price.toLocaleString()} property:
- IMT (Transfer Tax): \u20AC${imt.toLocaleString()} (${(imtRate * 100).toFixed(1)}%)
- Stamp Duty: \u20AC${stampDuty.toLocaleString()} (0.8%)
- Notary Fees: \u20AC${notaryFees.toLocaleString()}
- Registry Fees: \u20AC${registryFees.toLocaleString()}
- Legal Fees (est.): \u20AC${legalFees.toLocaleString()}
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Total Additional Costs: \u20AC${totalCosts.toLocaleString()}
TOTAL PRICE: \u20AC${totalPrice.toLocaleString()}`;
      return {
        success: true,
        result: { price, totalCosts, totalPrice, breakdown: { imt, stampDuty, notaryFees, registryFees, legalFees } },
        summary
      };
    }
    default:
      return { success: false, result: null, summary: `Unknown tool: ${tool}` };
  }
}
function parseAgentResponse(response) {
  const steps = [];
  const thoughtMatch = response.match(/THOUGHT:\s*(.+?)(?=ACTION:|FINAL_ANSWER:|$)/is);
  if (thoughtMatch) {
    steps.push({ type: "thought", content: thoughtMatch[1].trim() });
  }
  const actionMatch = response.match(/ACTION:\s*(\w+)/i);
  const inputMatch = response.match(/INPUT:\s*(\{[\s\S]*?\})/i);
  if (actionMatch) {
    let input = {};
    if (inputMatch) {
      try {
        input = JSON.parse(inputMatch[1]);
      } catch {
        console.log("[Agent] Failed to parse INPUT JSON");
      }
    }
    steps.push({ type: "action", tool: actionMatch[1], input });
  }
  const finalMatch = response.match(/FINAL_ANSWER:\s*([\s\S]+?)$/i);
  if (finalMatch) {
    steps.push({ type: "final_answer", content: finalMatch[1].trim() });
  }
  return steps;
}
async function callAgentAI(messages, backend) {
  if (backend === "groq" && GROQ_API_KEY3) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY3}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL2,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 2048
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          console.log("[Agent] Groq rate limit hit, falling back to Ollama...");
          return callAgentAI(messages, "ollama");
        }
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (error) {
      const errorMsg = error.message;
      if (errorMsg.includes("429") || errorMsg.includes("rate") || errorMsg.includes("limit")) {
        console.log("[Agent] Groq error, falling back to Ollama...");
        return callAgentAI(messages, "ollama");
      }
      throw error;
    }
  }
  if (backend === "ollama") {
    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const otherMsgs = messages.filter((m) => m.role !== "system");
    const response = await fetch(`${OLLAMA_URL2}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL2,
        messages: [
          { role: "system", content: systemMsg },
          ...otherMsgs.map((m) => ({ role: m.role, content: m.content }))
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2048
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    const data = await response.json();
    return data.message?.content || "";
  }
  if (backend === "claude" && ANTHROPIC_API_KEY2) {
    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const otherMsgs = messages.filter((m) => m.role !== "system");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY2,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL2,
        max_tokens: 2048,
        system: systemMsg,
        messages: otherMsgs.map((m) => ({ role: m.role, content: m.content }))
      })
    });
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }
    const data = await response.json();
    return data.content?.[0]?.text || "";
  }
  throw new Error("No AI backend available for agent");
}
async function runAgent(userQuery, userLocation, maxSteps = 5) {
  const health = await checkAIHealth();
  if (!health.available) {
    const searchResult = await runSearch({ query: userQuery, userLocation });
    return {
      steps: [{ type: "thought", content: "AI agent unavailable, performing direct search" }],
      finalAnswer: `Found ${searchResult.listings.length} properties matching your search.`,
      searchResults: searchResult,
      toolsUsed: ["search_properties"],
      reasoning: "Direct search fallback"
    };
  }
  const steps = [];
  const toolsUsed = [];
  let messages = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: userQuery }
  ];
  console.log(`[Agent] Starting multi-step reasoning for: "${userQuery}"`);
  for (let i = 0; i < maxSteps; i++) {
    console.log(`[Agent] Step ${i + 1}/${maxSteps}`);
    const response = await callAgentAI(messages, health.backend);
    console.log(`[Agent] AI response:`, response.slice(0, 200));
    const parsedSteps = parseAgentResponse(response);
    steps.push(...parsedSteps);
    const finalAnswer = parsedSteps.find((s) => s.type === "final_answer");
    if (finalAnswer) {
      console.log(`[Agent] Got final answer after ${i + 1} steps`);
      return {
        steps,
        finalAnswer: finalAnswer.content,
        searchResults: currentSearchResults || void 0,
        toolsUsed,
        reasoning: steps.filter((s) => s.type === "thought").map((s) => s.content).join(" \u2192 ")
      };
    }
    const action = parsedSteps.find((s) => s.type === "action");
    if (action) {
      toolsUsed.push(action.tool);
      const result = await executeAgentTool(action.tool, action.input, userLocation);
      const observation = {
        type: "observation",
        content: result.summary,
        data: result.result
      };
      steps.push(observation);
      messages.push({ role: "assistant", content: response });
      messages.push({ role: "user", content: `OBSERVATION: ${result.summary}` });
    } else {
      console.log("[Agent] No action or final answer found, breaking loop");
      break;
    }
  }
  console.log("[Agent] Max steps reached, generating summary");
  const summaryAnswer = currentSearchResults ? `I found ${currentSearchResults.listings.length} properties. ${currentSearchResults.listings.slice(0, 3).map((l) => `${l.title} at \u20AC${l.priceEur.toLocaleString()}`).join(", ")}.` : "I wasn't able to complete the search. Please try a simpler query.";
  return {
    steps,
    finalAnswer: summaryAnswer,
    searchResults: currentSearchResults || void 0,
    toolsUsed,
    reasoning: steps.filter((s) => s.type === "thought").map((s) => s.content).join(" \u2192 ")
  };
}
function shouldUseAgent(query) {
  const complexPatterns = [
    /compare|versus|vs|better|which/i,
    /recommend|suggest|advice|help me choose/i,
    /best|cheapest|most|least/i,
    /and also|as well as|plus/i,
    /first.+then|after that|also need/i,
    /what.+cost|how much.+total|calculate/i,
    /market|investment|rental yield/i,
    /multiple|several|few|some options/i
  ];
  return complexPatterns.some((pattern) => pattern.test(query));
}

// src/services/threadService.ts
var threads = /* @__PURE__ */ new Map();
function generateThreadId() {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function generateTitle(message) {
  const firstSentence = message.split(/[.!?]/)[0];
  const title = firstSentence.length > 40 ? firstSentence.slice(0, 40) + "..." : firstSentence;
  return title || "New conversation";
}
function createThread(initialMessage) {
  const id = generateThreadId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const thread = {
    id,
    title: initialMessage ? generateTitle(initialMessage) : "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  thread.messages.push({
    role: "assistant",
    content: "\u{1F9D9}\u200D\u2640\uFE0F Hi! I'm your AI Property Witch. Tell me what you're looking for in Portugal and I'll conjure up the listings for you. You can also ask me questions about the results or Portuguese real estate in general.",
    timestamp: now,
    type: "chat"
  });
  threads.set(id, thread);
  console.log(`[Threads] Created new thread: ${id}`);
  return thread;
}
function getThread(threadId) {
  return threads.get(threadId) || null;
}
function getAllThreads() {
  return Array.from(threads.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
function addMessage(threadId, role, content, type, searchContext) {
  const thread = threads.get(threadId);
  if (!thread) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  thread.messages.push({
    role,
    content,
    timestamp: now,
    type,
    searchContext
  });
  thread.updatedAt = now;
  if (role === "user" && thread.messages.filter((m) => m.role === "user").length === 1) {
    thread.title = generateTitle(content);
  }
  if (searchContext) {
    thread.lastSearchContext = searchContext;
  }
  return thread;
}
function getConversationHistory(threadId, limit = 20) {
  const thread = threads.get(threadId);
  if (!thread) return [];
  return thread.messages.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
}
function getLastSearchContext(threadId) {
  const thread = threads.get(threadId);
  return thread?.lastSearchContext || null;
}
function storeSearchResults(threadId, listings) {
  const thread = threads.get(threadId);
  if (thread) {
    thread.lastSearchResults = listings;
    console.log(`[Threads] Stored ${listings.length} listings in thread ${threadId}`);
  }
}
function getLastSearchResults(threadId) {
  const thread = threads.get(threadId);
  return thread?.lastSearchResults || null;
}
function deleteThread(threadId) {
  return threads.delete(threadId);
}
function updateThreadTitle(threadId, title) {
  const thread = threads.get(threadId);
  if (!thread) return null;
  thread.title = title;
  thread.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  return thread;
}
function getThreadCount() {
  return threads.size;
}

// src/routes/chat.ts
var router4 = (0, import_express4.Router)();
function generateRefinementSuggestions(intent, listingsCount, matchType) {
  const suggestions = [];
  const { propertyType, priceMax, priceMin, location } = intent;
  if (listingsCount === 0) {
    if (priceMax) {
      suggestions.push(`Increase budget to \u20AC${Math.round(priceMax * 1.5).toLocaleString()}`);
    }
    if (location) {
      suggestions.push(`Search all of Portugal instead of ${location}`);
    }
    suggestions.push("Show me any available properties");
  } else if (listingsCount < 5) {
    if (priceMax) {
      suggestions.push(`Show options up to \u20AC${Math.round(priceMax * 1.25).toLocaleString()}`);
    }
    if (location) {
      suggestions.push(`Expand search area around ${location}`);
    }
  } else {
    if (!propertyType) {
      suggestions.push("Only show land/plots");
      suggestions.push("Only show houses");
    }
    if (priceMax && priceMax > 5e4) {
      suggestions.push(`Show cheaper options under \u20AC${Math.round(priceMax * 0.7).toLocaleString()}`);
    }
    if (matchType === "near-miss") {
      suggestions.push("Only show exact matches");
    }
  }
  if (listingsCount > 0) {
    suggestions.push("Sort by price (lowest first)");
    suggestions.push("Show on map");
  }
  return suggestions.slice(0, 4);
}
function generateConversationId() {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
var chatSchema = import_zod3.z.object({
  message: import_zod3.z.string().min(1),
  conversationId: import_zod3.z.string().optional(),
  threadId: import_zod3.z.string().optional(),
  // New: thread ID for persistent memory
  userLocation: import_zod3.z.object({
    label: import_zod3.z.string().min(2),
    lat: import_zod3.z.number(),
    lng: import_zod3.z.number(),
    currency: import_zod3.z.string().min(3)
  }),
  mode: import_zod3.z.enum(["search", "chat", "auto"]).optional().default("auto"),
  conversationHistory: import_zod3.z.array(import_zod3.z.object({
    role: import_zod3.z.enum(["user", "assistant"]),
    content: import_zod3.z.string()
  })).optional().default([]),
  lastSearchContext: import_zod3.z.string().optional()
});
router4.post("/chat", async (req, res) => {
  const requestStart = Date.now();
  const timings = {};
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { message, mode, threadId } = parsed.data;
  let { conversationHistory, lastSearchContext } = parsed.data;
  const userLocation = parsed.data.userLocation;
  const conversationId = parsed.data.conversationId || generateConversationId();
  if (threadId) {
    const thread = getThread(threadId);
    if (thread) {
      conversationHistory = getConversationHistory(threadId, 20);
      lastSearchContext = getLastSearchContext(threadId) || lastSearchContext;
      console.log(`[Chat] Using thread ${threadId} with ${conversationHistory.length} messages`);
    }
    addMessage(threadId, "user", message);
  }
  try {
    let t0 = Date.now();
    const health = await checkAIHealth();
    timings.healthCheck = Date.now() - t0;
    const aiHistory = conversationHistory.map((m) => ({
      role: m.role,
      content: m.content
    }));
    let shouldSearch = mode === "search";
    let intentType = "search";
    let confirmationContext;
    if (mode === "auto") {
      t0 = Date.now();
      const hasRecentResults = !!lastSearchContext;
      const intent = await detectIntent(message, aiHistory, hasRecentResults);
      timings.intentDetection = Date.now() - t0;
      intentType = intent.intent;
      confirmationContext = intent.confirmationContext;
      shouldSearch = (intent.isPropertySearch || intent.intent === "search" || intent.intent === "refine_search" || intent.intent === "show_listings") && intent.intent !== "pick_from_results";
    } else if (mode === "chat") {
      shouldSearch = false;
      intentType = "conversation";
    }
    if (intentType === "pick_from_results" && threadId) {
      const storedListings = getLastSearchResults(threadId);
      if (storedListings && storedListings.length > 0) {
        t0 = Date.now();
        const { selectedListings, explanation } = await pickBestListings(message, storedListings);
        timings.pickListings = Date.now() - t0;
        if (selectedListings.length > 0) {
          const aiSummary2 = explanation;
          if (threadId) {
            addMessage(threadId, "assistant", aiSummary2, "search", lastSearchContext || void 0);
          }
          timings.total = Date.now() - requestStart;
          console.log(`[Chat] Picked ${selectedListings.length} listings. Timings:`, timings);
          return res.json({
            type: "search",
            intentDetected: "pick_from_results",
            message: aiSummary2,
            searchResult: {
              listings: selectedListings,
              totalCount: selectedListings.length,
              matchType: "exact",
              appliedPriceRange: {}
            },
            searchContext: lastSearchContext,
            threadId,
            aiAvailable: health.available,
            aiBackend: health.backend,
            _timings: timings
          });
        }
      }
      console.log("[Chat] No stored listings for pick_from_results, falling back to search");
    }
    if (!shouldSearch) {
      t0 = Date.now();
      const response = await chatWithAI(message, aiHistory, lastSearchContext, conversationId);
      timings.chatAI = Date.now() - t0;
      timings.total = Date.now() - requestStart;
      console.log(`[Chat] Timings:`, timings);
      if (threadId) {
        addMessage(threadId, "assistant", response, "chat");
      }
      return res.json({
        type: "chat",
        intentDetected: intentType,
        message: response,
        conversationId,
        threadId,
        aiAvailable: health.available,
        aiBackend: health.backend,
        _timings: timings
      });
    }
    const useAgent = shouldUseAgent(message);
    if (useAgent && health.available) {
      console.log("[Chat] Using agent for complex query:", message);
      t0 = Date.now();
      const agentResult = await runAgent(message, userLocation, 5);
      timings.agent = Date.now() - t0;
      timings.total = Date.now() - requestStart;
      console.log(`[Chat] Timings:`, timings);
      const searchContext2 = `Agent processed: "${message}". Tools used: ${agentResult.toolsUsed.join(", ")}. ${agentResult.reasoning}`;
      if (threadId) {
        addMessage(threadId, "assistant", agentResult.finalAnswer, "agent", searchContext2);
      }
      return res.json({
        type: "agent",
        intentDetected: "agent",
        message: agentResult.finalAnswer,
        reasoning: agentResult.reasoning,
        toolsUsed: agentResult.toolsUsed,
        stepsCount: agentResult.steps.length,
        searchResult: agentResult.searchResults,
        searchContext: searchContext2,
        threadId,
        aiAvailable: health.available,
        aiBackend: health.backend,
        _timings: timings
      });
    }
    let searchQuery = message;
    const isConfirmation = /^(yes|yeah|yep|yup|sure|please|ok|okay|go ahead|do it|definitely|absolutely|of course|please do|yes please)\.?$/i.test(message.trim());
    if ((intentType === "show_listings" || intentType === "refine_search") && lastSearchContext) {
      const originalQueryMatch = lastSearchContext.match(/User searched for: "([^"]+)"/);
      if (originalQueryMatch) {
        const originalQuery = originalQueryMatch[1];
        if (isConfirmation && confirmationContext) {
          const centralMatch = confirmationContext.match(/focus on (central|center|downtown|city cent[re])/i);
          const cheaperMatch = confirmationContext.match(/cheaper|lower price|less expensive/i);
          const largerMatch = confirmationContext.match(/larger|bigger|more space/i);
          if (centralMatch) {
            searchQuery = `${originalQuery} central city center downtown`;
            console.log(`[Chat] Confirmation: User confirmed central location search for "${searchQuery}"`);
          } else if (cheaperMatch) {
            searchQuery = `${originalQuery} cheaper`;
            console.log(`[Chat] Confirmation: User confirmed cheaper search for "${searchQuery}"`);
          } else if (largerMatch) {
            searchQuery = `${originalQuery} larger`;
            console.log(`[Chat] Confirmation: User confirmed larger search for "${searchQuery}"`);
          } else {
            searchQuery = originalQuery;
            console.log(`[Chat] Confirmation: Re-running original search for "${searchQuery}"`);
          }
        } else if (intentType === "show_listings" || isConfirmation) {
          searchQuery = originalQuery;
          console.log(`[Chat] show_listings: Re-running search for "${searchQuery}"`);
        } else {
          searchQuery = `${originalQuery} ${message}`;
          console.log(`[Chat] refine_search: Combined query "${searchQuery}"`);
        }
      }
    }
    t0 = Date.now();
    const aiResponse = await parseQueryWithAI(searchQuery);
    timings.parseQuery = Date.now() - t0;
    t0 = Date.now();
    const searchResult = await runSearch({
      query: searchQuery,
      userLocation
    });
    timings.search = Date.now() - t0;
    const locations = [...new Set(searchResult.listings.map((l) => l.locationLabel))];
    t0 = Date.now();
    let aiSummary;
    if (intentType === "show_listings") {
      aiSummary = await generateResultsResponse(
        `showing listings from previous search`,
        searchResult.matchType,
        searchResult.listings.length,
        searchResult.appliedPriceRange,
        locations
      );
    } else {
      aiSummary = await generateResultsResponse(
        message,
        searchResult.matchType,
        searchResult.listings.length,
        searchResult.appliedPriceRange,
        locations
      );
    }
    timings.generateSummary = Date.now() - t0;
    const suggestions = generateRefinementSuggestions(
      aiResponse.parsedIntent,
      searchResult.listings.length,
      searchResult.matchType
    );
    const searchContext = `User searched for: "${searchQuery}". Found ${searchResult.listings.length} listings (${searchResult.matchType} match). Price range: \u20AC${searchResult.appliedPriceRange.min ?? 0} - \u20AC${searchResult.appliedPriceRange.max ?? "any"}. Locations: ${locations.slice(0, 5).join(", ") || "Various Portugal"}.`;
    if (threadId && searchResult.listings.length > 0) {
      storeSearchResults(threadId, searchResult.listings);
    }
    if (threadId) {
      addMessage(threadId, "assistant", aiSummary, "search", searchContext);
    }
    timings.total = Date.now() - requestStart;
    console.log(`[Chat] Timings:`, timings);
    return res.json({
      type: "search",
      intentDetected: intentType,
      message: aiSummary,
      parsedIntent: aiResponse.parsedIntent,
      searchResult,
      suggestions,
      searchContext,
      threadId,
      aiAvailable: health.available,
      aiBackend: health.backend,
      _timings: timings
    });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router4.get("/ai/health", async (_req, res) => {
  const health = await checkAIHealth();
  const currentInfo = getCurrentBackendInfo();
  return res.json({
    available: health.available,
    backend: health.backend,
    model: currentInfo.model,
    ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
    localAiUrl: process.env.LOCAL_AI_URL ?? "http://localhost:8080"
  });
});
router4.get("/ai/backends", async (_req, res) => {
  try {
    const backends = await getAvailableBackends();
    const currentInfo = getCurrentBackendInfo();
    return res.json({
      backends,
      current: {
        backend: currentInfo.backend,
        model: currentInfo.model
      }
    });
  } catch (error) {
    console.error("Error fetching backends:", error);
    return res.status(500).json({ error: String(error) });
  }
});
var switchBackendSchema = import_zod3.z.object({
  backend: import_zod3.z.enum(["ollama", "groq", "claude", "local"]),
  model: import_zod3.z.string().optional()
});
router4.post("/ai/switch", async (req, res) => {
  try {
    const body = switchBackendSchema.parse(req.body);
    const result = await setActiveBackend(body.backend, body.model);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    const currentInfo = getCurrentBackendInfo();
    return res.json({
      success: true,
      message: result.message,
      current: {
        backend: currentInfo.backend,
        model: currentInfo.model
      }
    });
  } catch (error) {
    if (error instanceof import_zod3.z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Error switching backend:", error);
    return res.status(500).json({ error: String(error) });
  }
});
var chat_default = router4;

// src/routes/rag.ts
var import_express5 = require("express");
var router5 = (0, import_express5.Router)();
router5.get("/rag/status", async (_req, res) => {
  try {
    const stats = getRAGSystemStats();
    const categories = getCategories();
    return res.json({
      status: "ok",
      stats,
      knowledgeCategories: categories
    });
  } catch (error) {
    console.error("RAG status error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router5.post("/rag/initialize", async (_req, res) => {
  try {
    await initializeRAG();
    const stats = getRAGStats();
    return res.json({
      status: "ok",
      message: "RAG system initialized",
      stats
    });
  } catch (error) {
    console.error("RAG initialization error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router5.post("/rag/query", async (req, res) => {
  const { query, topK = 3 } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query is required" });
  }
  try {
    const results = await retrieveKnowledge(query, topK);
    return res.json({
      query,
      results: results.map((r) => ({
        id: r.document.id,
        title: r.document.metadata.title,
        content: r.document.content.slice(0, 500) + "...",
        category: r.document.metadata.category,
        score: r.score.toFixed(3)
      }))
    });
  } catch (error) {
    console.error("RAG query error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router5.get("/rag/knowledge", (_req, res) => {
  try {
    const knowledge = getAllKnowledge();
    return res.json({
      count: knowledge.length,
      categories: getCategories(),
      entries: knowledge.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        tags: doc.tags,
        contentPreview: doc.content.slice(0, 200) + "..."
      }))
    });
  } catch (error) {
    console.error("RAG knowledge error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router5.get("/rag/knowledge/:id", (req, res) => {
  try {
    const { id } = req.params;
    const knowledge = getAllKnowledge();
    const entry = knowledge.find((doc) => doc.id === id);
    if (!entry) {
      return res.status(404).json({ error: "Knowledge entry not found" });
    }
    return res.json(entry);
  } catch (error) {
    console.error("RAG knowledge error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router5.delete("/rag/clear", async (req, res) => {
  const { collection } = req.query;
  try {
    clearRAGData(collection);
    return res.json({
      status: "ok",
      message: collection ? `Cleared collection: ${collection}` : "Cleared all RAG data"
    });
  } catch (error) {
    console.error("RAG clear error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router5.post("/rag/listings/search", async (req, res) => {
  const { query, criteria, limit = 10 } = req.body;
  if (!query && !criteria) {
    return res.status(400).json({ error: "Either query or criteria is required" });
  }
  try {
    const parsedCriteria = criteria || parseSearchQuery(query || "");
    console.log("[RAG Search] Query:", query);
    console.log("[RAG Search] Criteria:", JSON.stringify(parsedCriteria));
    const results = searchListingsByCriteria(parsedCriteria, limit);
    const formattedResults = results.map(({ listing, score }) => ({
      id: listing.id,
      title: listing.metadata.title,
      price: listing.metadata.priceEur,
      priceFormatted: listing.metadata.priceEur ? `\u20AC${listing.metadata.priceEur.toLocaleString()}` : "Price unknown",
      city: listing.metadata.city,
      beds: listing.metadata.beds,
      baths: listing.metadata.baths,
      areaSqm: listing.metadata.areaSqm,
      sourceUrl: listing.metadata.sourceUrl,
      sourceSite: listing.metadata.sourceSite,
      photo: listing.metadata.photo,
      matchScore: score
    }));
    return res.json({
      query,
      parsedCriteria,
      count: results.length,
      results: formattedResults
    });
  } catch (error) {
    console.error("RAG listing search error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router5.get("/rag/listings", async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page, 10);
  const limitNum = Math.min(parseInt(limit, 10), 100);
  try {
    const allResults = searchListingsByCriteria({}, 1e4);
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    const pageResults = allResults.slice(start, end);
    return res.json({
      total: allResults.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(allResults.length / limitNum),
      results: pageResults.map(({ listing }) => ({
        id: listing.id,
        title: listing.metadata.title,
        price: listing.metadata.priceEur,
        city: listing.metadata.city,
        beds: listing.metadata.beds,
        areaSqm: listing.metadata.areaSqm,
        sourceUrl: listing.metadata.sourceUrl
      }))
    });
  } catch (error) {
    console.error("RAG listings error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
var rag_default = router5;

// src/routes/training.ts
var import_express6 = require("express");
var import_zod4 = require("zod");

// src/services/trainingService.ts
var OLX_MAIN_CATEGORY = 16;
var OLX_SUB_CATEGORIES = {
  APARTAMENTOS_VENDA: 4777,
  // Apartments for sale
  APARTAMENTOS_ARRENDAR: 4779,
  // Apartments for rent
  MORADIAS_VENDA: 4781,
  // Houses for sale
  MORADIAS_ARRENDAR: 4783,
  // Houses for rent
  QUARTOS: 4785,
  // Rooms
  TERRENOS: 4795,
  // Land
  LOJAS: 4789,
  // Shops/Commercial
  ESCRITORIOS: 4791,
  // Offices
  ARMAZENS: 4793,
  // Warehouses
  GARAGENS: 4787,
  // Garages
  OUTROS: 5212
  // Other real estate
};
var OLX_REGIONS2 = {
  porto: 13,
  lisboa: 11,
  faro: 8,
  braga: 3,
  coimbra: 6,
  aveiro: 1,
  setubal: 15,
  leiria: 10,
  santarem: 14,
  evora: 7
};
function extractPrice2(params) {
  const priceParam = params.find((p) => p.key === "price");
  return priceParam?.value?.value || 0;
}
function extractArea2(params) {
  const areaKeys = ["m", "area", "area_de_terreno_m2", "area_util"];
  for (const key of areaKeys) {
    const areaParam = params.find((p) => p.key === key);
    if (areaParam?.value?.key) {
      const parsed = parseFloat(areaParam.value.key.replace(/[^\d.]/g, ""));
      if (!isNaN(parsed)) return parsed;
    }
  }
  return void 0;
}
function extractBedrooms2(params) {
  const bedsParam = params.find((p) => p.key === "rooms" || p.key === "quartos" || p.key === "t");
  if (bedsParam?.value?.key) {
    const match = bedsParam.value.key.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return void 0;
}
function extractBathrooms2(params) {
  const bathsParam = params.find((p) => p.key === "bathrooms" || p.key === "casas_banho");
  if (bathsParam?.value?.key) {
    const match = bathsParam.value.key.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return void 0;
}
function buildPhotoUrl2(photo) {
  return photo.link.replace("{width}", "800").replace("{height}", "600");
}
function mapOLXToListing(olx) {
  return {
    id: `olx-${olx.id}`,
    sourceSite: "OLX",
    sourceUrl: olx.url,
    title: olx.title,
    priceEur: extractPrice2(olx.params),
    currency: "EUR",
    beds: extractBedrooms2(olx.params),
    baths: extractBathrooms2(olx.params),
    areaSqm: extractArea2(olx.params),
    address: [olx.location?.city?.name, olx.location?.region?.name].filter(Boolean).join(", "),
    city: olx.location?.city?.name || olx.location?.region?.name || "",
    lat: olx.map?.lat,
    lng: olx.map?.lon,
    propertyType: olx.category?.type,
    description: olx.description?.replace(/<[^>]*>/g, " ").slice(0, 1e3),
    photos: olx.photos.map(buildPhotoUrl2),
    lastSeenAt: olx.last_refresh_time || olx.created_time
  };
}
async function fetchOLXPage(categoryId, regionId, offset = 0, limit = 40) {
  const params = new URLSearchParams({
    category_id: String(categoryId),
    region_id: String(regionId),
    limit: String(limit),
    offset: String(offset)
  });
  const url = `https://www.olx.pt/api/v1/offers?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
  });
  if (!response.ok) {
    throw new Error(`OLX API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
var currentTrainingProgress = null;
function getTrainingProgress() {
  return currentTrainingProgress;
}
async function trainOnOLXListings(city, options = {}) {
  const startTime = Date.now();
  const cityLower = city.toLowerCase();
  const regionId = OLX_REGIONS2[cityLower];
  if (!regionId) {
    return {
      success: false,
      source: "OLX",
      location: city,
      listingsFetched: 0,
      listingsIndexed: 0,
      duration: 0,
      error: `Unknown city: ${city}. Available cities: ${Object.keys(OLX_REGIONS2).join(", ")}`
    };
  }
  const categoriesToFetch = options.categories || ["all"];
  const maxListings = options.maxListings || 1e3;
  const startOffset = options.startOffset || 0;
  const allListings = [];
  let totalFetched = 0;
  const categoryMap = {
    all: [OLX_MAIN_CATEGORY],
    // Main real estate category gets everything
    apartments: [OLX_SUB_CATEGORIES.APARTAMENTOS_VENDA, OLX_SUB_CATEGORIES.APARTAMENTOS_ARRENDAR],
    houses: [OLX_SUB_CATEGORIES.MORADIAS_VENDA, OLX_SUB_CATEGORIES.MORADIAS_ARRENDAR],
    rooms: [OLX_SUB_CATEGORIES.QUARTOS],
    land: [OLX_SUB_CATEGORIES.TERRENOS],
    commercial: [OLX_SUB_CATEGORIES.LOJAS, OLX_SUB_CATEGORIES.ESCRITORIOS, OLX_SUB_CATEGORIES.ARMAZENS],
    garages: [OLX_SUB_CATEGORIES.GARAGENS]
  };
  for (const categoryName of categoriesToFetch) {
    const categoryIds = categoryMap[categoryName.toLowerCase()] || [OLX_MAIN_CATEGORY];
    for (const categoryId of categoryIds) {
      let offset = startOffset;
      let hasMore = true;
      let pageNum = 1;
      const perCategoryMax = Math.ceil(maxListings / categoryIds.length);
      console.log(`[Training] Fetching ${categoryName} (cat ${categoryId}) from OLX ${city} starting at offset ${startOffset}...`);
      while (hasMore && totalFetched < maxListings) {
        try {
          currentTrainingProgress = {
            status: "running",
            source: "OLX",
            location: city,
            category: categoryName,
            totalFetched,
            totalIndexed: 0,
            currentPage: pageNum,
            totalPages: Math.ceil(maxListings / 40)
          };
          options.onProgress?.(currentTrainingProgress);
          const response = await fetchOLXPage(categoryId, regionId, offset, 40);
          const listings = response.data.map(mapOLXToListing);
          allListings.push(...listings);
          totalFetched += listings.length;
          console.log(`[Training] Page ${pageNum}: fetched ${listings.length} listings (total: ${totalFetched})`);
          hasMore = !!response.links.next && listings.length > 0;
          if (response.links.next?.href) {
            const nextUrl = new URL(response.links.next.href);
            const nextOffset = nextUrl.searchParams.get("offset");
            offset = nextOffset ? parseInt(nextOffset, 10) : offset + listings.length;
          } else {
            offset += listings.length;
          }
          pageNum++;
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`[Training] Error fetching page ${pageNum}:`, error);
          hasMore = false;
        }
      }
    }
  }
  const uniqueListings = Array.from(
    new Map(allListings.map((l) => [l.id, l])).values()
  );
  console.log(`[Training] Fetched ${uniqueListings.length} unique listings from OLX ${city}`);
  try {
    currentTrainingProgress = {
      status: "running",
      source: "OLX",
      location: city,
      category: "indexing",
      totalFetched: uniqueListings.length,
      totalIndexed: 0,
      currentPage: 0,
      totalPages: 1
    };
    await indexListings(uniqueListings);
    currentTrainingProgress = {
      status: "completed",
      source: "OLX",
      location: city,
      category: "all",
      totalFetched: uniqueListings.length,
      totalIndexed: uniqueListings.length,
      currentPage: 0,
      totalPages: 0
    };
    const duration = Date.now() - startTime;
    console.log(`[Training] Successfully indexed ${uniqueListings.length} listings in ${duration}ms`);
    return {
      success: true,
      source: "OLX",
      location: city,
      listingsFetched: uniqueListings.length,
      listingsIndexed: uniqueListings.length,
      duration
    };
  } catch (error) {
    currentTrainingProgress = {
      status: "error",
      source: "OLX",
      location: city,
      category: "indexing",
      totalFetched: uniqueListings.length,
      totalIndexed: 0,
      currentPage: 0,
      totalPages: 0,
      error: String(error)
    };
    return {
      success: false,
      source: "OLX",
      location: city,
      listingsFetched: uniqueListings.length,
      listingsIndexed: 0,
      duration: Date.now() - startTime,
      error: String(error)
    };
  }
}
function getAvailableCities() {
  return Object.keys(OLX_REGIONS2);
}
function getAvailableCategories() {
  return ["all", "land", "apartments", "houses", "rooms", "commercial"];
}

// src/routes/training.ts
var router6 = (0, import_express6.Router)();
var trainSchema = import_zod4.z.object({
  city: import_zod4.z.string().min(1),
  categories: import_zod4.z.array(import_zod4.z.string()).optional(),
  maxListings: import_zod4.z.number().min(1).max(2e3).optional(),
  startOffset: import_zod4.z.number().min(0).optional()
  // Continue from a specific offset
});
router6.post("/train/olx", async (req, res) => {
  const parsed = trainSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { city, categories, maxListings, startOffset } = parsed.data;
  console.log(`[Training API] Starting training for OLX ${city} (offset: ${startOffset || 0})...`);
  res.json({
    status: "started",
    message: `Training started for OLX listings in ${city}`,
    city,
    categories: categories || ["all"],
    maxListings: maxListings || 1e3,
    startOffset: startOffset || 0,
    checkProgress: "/api/train/progress"
  });
  try {
    const result = await trainOnOLXListings(city, {
      categories,
      maxListings,
      startOffset
    });
    console.log("[Training API] Training completed:", result);
  } catch (error) {
    console.error("[Training API] Training error:", error);
  }
});
router6.post("/train/olx/sync", async (req, res) => {
  const parsed = trainSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { city, categories, maxListings, startOffset } = parsed.data;
  console.log(`[Training API] Starting sync training for OLX ${city} (offset: ${startOffset || 0})...`);
  try {
    const result = await trainOnOLXListings(city, {
      categories,
      maxListings,
      startOffset
    });
    if (result.success) {
      return res.json({
        status: "completed",
        ...result
      });
    } else {
      return res.status(500).json({
        status: "error",
        ...result
      });
    }
  } catch (error) {
    console.error("[Training API] Training error:", error);
    return res.status(500).json({
      status: "error",
      error: String(error)
    });
  }
});
router6.get("/train/progress", (_req, res) => {
  const progress = getTrainingProgress();
  if (!progress) {
    return res.json({
      status: "idle",
      message: "No training in progress"
    });
  }
  return res.json(progress);
});
router6.get("/train/cities", (_req, res) => {
  const cities = getAvailableCities();
  return res.json({
    cities,
    count: cities.length
  });
});
router6.get("/train/categories", (_req, res) => {
  const categories = getAvailableCategories();
  return res.json({
    categories,
    descriptions: {
      all: "All property types",
      land: "Land and plots (Terrenos)",
      apartments: "Apartments (Apartamentos)",
      houses: "Houses and villas (Moradias)",
      rooms: "Rooms for rent (Quartos)",
      commercial: "Commercial properties (Lojas)"
    }
  });
});
var training_default = router6;

// src/routes/agent.ts
var import_express7 = require("express");
var import_zod5 = require("zod");
var router7 = (0, import_express7.Router)();
var agentSchema = import_zod5.z.object({
  query: import_zod5.z.string().min(1),
  userLocation: import_zod5.z.object({
    label: import_zod5.z.string().min(2),
    lat: import_zod5.z.number(),
    lng: import_zod5.z.number(),
    currency: import_zod5.z.string().min(3)
  }),
  maxSteps: import_zod5.z.number().optional().default(5)
});
router7.post("/agent", async (req, res) => {
  const parsed = agentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { query, maxSteps } = parsed.data;
  const userLocation = parsed.data.userLocation;
  try {
    console.log(`[Agent Route] Processing: "${query}"`);
    const result = await runAgent(query, userLocation, maxSteps);
    return res.json({
      success: true,
      query,
      result: {
        finalAnswer: result.finalAnswer,
        reasoning: result.reasoning,
        toolsUsed: result.toolsUsed,
        stepsCount: result.steps.length,
        steps: result.steps.map((step) => ({
          type: step.type,
          content: step.type === "thought" || step.type === "final_answer" || step.type === "observation" ? step.content : step.type === "action" ? `${step.tool}(${JSON.stringify(step.input)})` : null
        }))
      },
      searchResults: result.searchResults
    });
  } catch (error) {
    console.error("[Agent Route] Error:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router7.post("/agent/check", (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query is required" });
  }
  const useAgent = shouldUseAgent(query);
  return res.json({
    query,
    useAgent,
    reason: useAgent ? "Complex query detected - will use multi-step reasoning" : "Simple query - direct search is sufficient"
  });
});
var agent_default = router7;

// src/routes/index-listings.ts
var import_express8 = require("express");
var import_zod6 = require("zod");
var router8 = (0, import_express8.Router)();
var OLX_REGIONS3 = {
  aveiro: 1,
  beja: 2,
  braga: 3,
  braganca: 4,
  "castelo-branco": 5,
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
  "viana-do-castelo": 16,
  "vila-real": 17,
  viseu: 18,
  acores: 19,
  madeira: 20
};
function extractPrice3(params) {
  const priceParam = params.find((p) => p.key === "price");
  return priceParam?.value?.value || 0;
}
function extractArea3(params) {
  const areaKeys = ["m", "area", "area_de_terreno_m2", "area_util"];
  for (const key of areaKeys) {
    const areaParam = params.find((p) => p.key === key);
    if (areaParam?.value?.key) {
      const parsed = parseFloat(areaParam.value.key.replace(/[^\d.]/g, ""));
      if (!isNaN(parsed)) return parsed;
    }
  }
  return void 0;
}
function extractBedrooms3(params) {
  const bedsParam = params.find((p) => p.key === "rooms" || p.key === "quartos" || p.key === "t");
  if (bedsParam?.value?.key) {
    const match = bedsParam.value.key.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return void 0;
}
function extractBathrooms3(params) {
  const bathsParam = params.find((p) => p.key === "bathrooms" || p.key === "casas_banho");
  if (bathsParam?.value?.key) {
    const match = bathsParam.value.key.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return void 0;
}
function mapOLXToListing2(olx) {
  const cityName = olx.location?.city?.name || "";
  const regionName = olx.location?.region?.name || "";
  return {
    id: `olx-${olx.id}`,
    sourceSite: "OLX",
    sourceUrl: olx.url,
    title: olx.title,
    priceEur: extractPrice3(olx.params),
    currency: "EUR",
    beds: extractBedrooms3(olx.params),
    baths: extractBathrooms3(olx.params),
    areaSqm: extractArea3(olx.params),
    address: [cityName, regionName].filter(Boolean).join(", "),
    city: cityName || regionName,
    lat: olx.map?.lat,
    lng: olx.map?.lon,
    propertyType: olx.category?.type,
    description: olx.description?.replace(/<[^>]*>/g, " ").slice(0, 500),
    photos: olx.photos?.map((p) => p.link.replace("{width}", "800").replace("{height}", "600")) || [],
    lastSeenAt: olx.last_refresh_time || olx.created_time
  };
}
async function fetchOLXPage2(categoryId, regionId, offset, limit = 40, query) {
  const params = new URLSearchParams({
    category_id: String(categoryId),
    region_id: String(regionId),
    limit: String(limit),
    offset: String(offset)
  });
  if (query) {
    params.set("query", query);
  }
  const url = `https://www.olx.pt/api/v1/offers?${params}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; AIPA/1.0)"
    }
  });
  if (!response.ok) {
    throw new Error(`OLX API error: ${response.status}`);
  }
  const data = await response.json();
  return {
    listings: data.data || [],
    hasMore: !!data.links?.next,
    total: data.metadata?.visible_total_count || 0
  };
}
router8.get("/stats", async (_req, res) => {
  try {
    const store2 = getVectorStore();
    const stats = store2.getStats();
    const listingsData = store2.getCollection("listings") || [];
    const cities = /* @__PURE__ */ new Set();
    listingsData.forEach((doc) => {
      if (doc.metadata?.city) cities.add(doc.metadata.city);
    });
    res.json({
      collections: stats,
      totalListings: stats.listings || 0,
      uniqueCities: Array.from(cities),
      availableRegions: Object.keys(OLX_REGIONS3)
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});
var indexSchema = import_zod6.z.object({
  region: import_zod6.z.string().optional().default("porto"),
  categoryId: import_zod6.z.number().optional().default(16),
  // 16 = Imóveis (Real Estate)
  maxListings: import_zod6.z.number().optional().default(500),
  startOffset: import_zod6.z.number().optional().default(0),
  query: import_zod6.z.string().optional()
  // Search query (e.g., "urbano" for urban land)
});
router8.post("/bulk-index", async (req, res) => {
  const parsed = indexSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { region, categoryId, maxListings, startOffset, query } = parsed.data;
  const regionId = OLX_REGIONS3[region.toLowerCase()] || OLX_REGIONS3.porto;
  console.log(`[Index] Starting bulk index for ${region} (region_id: ${regionId})${query ? `, query: "${query}"` : ""}`);
  console.log(`[Index] Max listings: ${maxListings}, start offset: ${startOffset}`);
  try {
    const allListings = [];
    let offset = startOffset;
    const perPage = 40;
    let totalAvailable = 0;
    while (allListings.length < maxListings) {
      console.log(`[Index] Fetching page at offset ${offset}...`);
      const { listings: olxListings, hasMore, total } = await fetchOLXPage2(
        categoryId,
        regionId,
        offset,
        perPage,
        query
      );
      totalAvailable = total;
      if (olxListings.length === 0) {
        console.log(`[Index] No more listings at offset ${offset}`);
        break;
      }
      const mapped = olxListings.map(mapOLXToListing2);
      allListings.push(...mapped);
      console.log(`[Index] Got ${olxListings.length} listings, total collected: ${allListings.length}`);
      if (!hasMore || olxListings.length < perPage) {
        break;
      }
      offset += perPage;
      await new Promise((r) => setTimeout(r, 500));
    }
    const toIndex = allListings.slice(0, maxListings);
    const batchSize = 50;
    let indexed = 0;
    for (let i = 0; i < toIndex.length; i += batchSize) {
      const batch = toIndex.slice(i, i + batchSize);
      await indexListings(batch);
      indexed += batch.length;
      console.log(`[Index] Indexed batch ${Math.floor(i / batchSize) + 1}, total indexed: ${indexed}`);
    }
    const store2 = getVectorStore();
    const stats = store2.getStats();
    res.json({
      success: true,
      region,
      regionId,
      newListingsIndexed: indexed,
      totalListingsNow: stats.listings,
      totalAvailableOnOLX: totalAvailable,
      nextOffset: offset
    });
  } catch (error) {
    console.error("[Index] Bulk indexing failed:", error);
    res.status(500).json({ error: String(error) });
  }
});
var index_listings_default = router8;

// src/routes/threads.ts
var import_express9 = require("express");
var router9 = (0, import_express9.Router)();
router9.get("/threads", (_req, res) => {
  try {
    const threads2 = getAllThreads();
    const summary = threads2.map((t) => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      messageCount: t.messages.length,
      lastMessage: t.messages.length > 0 ? t.messages[t.messages.length - 1].content.slice(0, 100) : null
    }));
    return res.json({ threads: summary, total: threads2.length });
  } catch (error) {
    console.error("Failed to get threads:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router9.post("/threads", (req, res) => {
  try {
    const { initialMessage } = req.body;
    const thread = createThread(initialMessage);
    return res.json({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      messages: thread.messages
    });
  } catch (error) {
    console.error("Failed to create thread:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router9.get("/threads/:threadId", (req, res) => {
  try {
    const { threadId } = req.params;
    const thread = getThread(threadId);
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    return res.json(thread);
  } catch (error) {
    console.error("Failed to get thread:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router9.delete("/threads/:threadId", (req, res) => {
  try {
    const { threadId } = req.params;
    const deleted = deleteThread(threadId);
    if (!deleted) {
      return res.status(404).json({ error: "Thread not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete thread:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router9.patch("/threads/:threadId", (req, res) => {
  try {
    const { threadId } = req.params;
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    const thread = updateThreadTitle(threadId, title);
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    return res.json({
      id: thread.id,
      title: thread.title,
      updatedAt: thread.updatedAt
    });
  } catch (error) {
    console.error("Failed to update thread:", error);
    return res.status(500).json({ error: String(error) });
  }
});
router9.get("/threads-stats", (_req, res) => {
  try {
    const count = getThreadCount();
    const threads2 = getAllThreads();
    const totalMessages = threads2.reduce((sum, t) => sum + t.messages.length, 0);
    return res.json({
      threadCount: count,
      totalMessages
    });
  } catch (error) {
    console.error("Failed to get thread stats:", error);
    return res.status(500).json({ error: String(error) });
  }
});
var threads_default = router9;

// src/routes/indexer.ts
var import_express10 = require("express");

// src/services/scheduledIndexer.ts
var LOCATIONS_TO_INDEX = [
  { name: "Lisbon", lat: 38.7223, lng: -9.1393 },
  { name: "Porto", lat: 41.1579, lng: -8.6291 },
  { name: "Algarve", lat: 37.0179, lng: -7.9304 },
  { name: "Cascais", lat: 38.6979, lng: -9.4215 },
  { name: "Sintra", lat: 38.8029, lng: -9.3817 },
  { name: "Braga", lat: 41.5454, lng: -8.4265 },
  { name: "Coimbra", lat: 40.2033, lng: -8.4103 },
  { name: "\xC9vora", lat: 38.5714, lng: -7.9135 },
  { name: "Faro", lat: 37.0194, lng: -7.9322 },
  { name: "Vila Nova de Gaia", lat: 41.1239, lng: -8.6118 }
];
var SEARCH_QUERIES = [
  "apartments for sale",
  "houses for sale",
  "land for construction",
  "terreno urbano",
  "moradia",
  "apartamento",
  "villa with pool",
  "quinta",
  "property investment"
];
var CONFIG = {
  // Interval between full index runs (in milliseconds)
  indexInterval: 4 * 60 * 60 * 1e3,
  // 4 hours
  // Delay between individual searches to avoid rate limiting
  searchDelay: 5e3,
  // 5 seconds
  // Maximum listings to index per run
  maxListingsPerRun: 500,
  // Maximum age of listings to index (in days)
  maxListingAgeDays: 90,
  // 3 months
  // Price ranges to search
  priceRanges: [
    { min: 0, max: 1e5 },
    { min: 1e5, max: 3e5 },
    { min: 3e5, max: 5e5 },
    { min: 5e5, max: void 0 }
  ]
};
var indexingInProgress = false;
var lastIndexTime = null;
var totalIndexedCount = 0;
var schedulerInterval = null;
async function fetchListings(query, location, priceRange) {
  const allListings = [];
  for (const adapter2 of ADAPTERS) {
    try {
      const listings = await adapter2.searchListings({
        query,
        priceRange,
        userLocation: {
          label: location.name,
          lat: location.lat,
          lng: location.lng,
          currency: "EUR"
        }
      });
      allListings.push(...listings);
    } catch (error) {
      console.error(`[Indexer] Error fetching from ${adapter2.siteId}:`, error);
    }
  }
  return allListings;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isListingRecent(listing) {
  if (!listing.lastSeenAt) return true;
  const listingDate = new Date(listing.lastSeenAt);
  const cutoffDate = /* @__PURE__ */ new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CONFIG.maxListingAgeDays);
  return listingDate >= cutoffDate;
}
async function runIndexingCycle() {
  if (indexingInProgress) {
    return { success: false, indexed: 0, error: "Indexing already in progress" };
  }
  indexingInProgress = true;
  const startTime = Date.now();
  const allListings = [];
  const seenIds = /* @__PURE__ */ new Set();
  console.log("[Indexer] Starting scheduled indexing cycle...");
  try {
    for (const location of LOCATIONS_TO_INDEX) {
      for (const query of SEARCH_QUERIES.slice(0, 3)) {
        for (const priceRange of CONFIG.priceRanges.slice(0, 2)) {
          if (allListings.length >= CONFIG.maxListingsPerRun) {
            console.log(`[Indexer] Reached max listings (${CONFIG.maxListingsPerRun}), stopping`);
            break;
          }
          try {
            console.log(`[Indexer] Fetching: "${query}" in ${location.name} (\u20AC${priceRange.min || 0}-${priceRange.max || "any"})`);
            const listings = await fetchListings(query, location, priceRange);
            let skippedOld = 0;
            for (const listing of listings) {
              if (!seenIds.has(listing.id)) {
                if (isListingRecent(listing)) {
                  seenIds.add(listing.id);
                  allListings.push(listing);
                } else {
                  skippedOld++;
                }
              }
            }
            if (skippedOld > 0) {
              console.log(`[Indexer] Skipped ${skippedOld} listings older than ${CONFIG.maxListingAgeDays} days`);
            }
            console.log(`[Indexer] Found ${listings.length} listings, total unique: ${allListings.length}`);
            await sleep(CONFIG.searchDelay);
          } catch (error) {
            console.error(`[Indexer] Error in search:`, error);
          }
        }
        if (allListings.length >= CONFIG.maxListingsPerRun) break;
      }
      if (allListings.length >= CONFIG.maxListingsPerRun) break;
    }
    if (allListings.length > 0) {
      console.log(`[Indexer] Indexing ${allListings.length} unique listings...`);
      await indexListings(allListings);
      totalIndexedCount += allListings.length;
    }
    lastIndexTime = /* @__PURE__ */ new Date();
    const duration = Math.round((Date.now() - startTime) / 1e3);
    console.log(`[Indexer] Indexing cycle complete. Indexed ${allListings.length} listings in ${duration}s`);
    return { success: true, indexed: allListings.length };
  } catch (error) {
    console.error("[Indexer] Error during indexing cycle:", error);
    return { success: false, indexed: 0, error: String(error) };
  } finally {
    indexingInProgress = false;
  }
}
function startScheduledIndexer() {
  if (schedulerInterval) {
    console.log("[Indexer] Scheduler already running");
    return;
  }
  console.log(`[Indexer] Starting scheduler (interval: ${CONFIG.indexInterval / 1e3 / 60} minutes)`);
  setTimeout(() => {
    console.log("[Indexer] Running initial indexing cycle...");
    runIndexingCycle().catch((err) => console.error("[Indexer] Initial cycle error:", err));
  }, 3e4);
  schedulerInterval = setInterval(() => {
    console.log("[Indexer] Running scheduled indexing cycle...");
    runIndexingCycle().catch((err) => console.error("[Indexer] Scheduled cycle error:", err));
  }, CONFIG.indexInterval);
}
function stopScheduledIndexer() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Indexer] Scheduler stopped");
  }
}
function getIndexerStatus() {
  let nextRunIn = null;
  if (schedulerInterval && lastIndexTime) {
    const nextRun = lastIndexTime.getTime() + CONFIG.indexInterval;
    const msUntilNext = nextRun - Date.now();
    if (msUntilNext > 0) {
      const minutes = Math.floor(msUntilNext / 1e3 / 60);
      const hours = Math.floor(minutes / 60);
      nextRunIn = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
    }
  }
  return {
    running: schedulerInterval !== null,
    indexingInProgress,
    lastIndexTime: lastIndexTime?.toISOString() || null,
    totalIndexed: totalIndexedCount,
    nextRunIn,
    config: CONFIG
  };
}
async function triggerIndexing() {
  return runIndexingCycle();
}

// src/routes/indexer.ts
var router10 = (0, import_express10.Router)();
router10.get("/indexer/status", (_req, res) => {
  const status = getIndexerStatus();
  return res.json(status);
});
router10.post("/indexer/start", (_req, res) => {
  startScheduledIndexer();
  const status = getIndexerStatus();
  return res.json({ message: "Indexer started", ...status });
});
router10.post("/indexer/stop", (_req, res) => {
  stopScheduledIndexer();
  const status = getIndexerStatus();
  return res.json({ message: "Indexer stopped", ...status });
});
router10.post("/indexer/run", async (_req, res) => {
  try {
    const result = await triggerIndexing();
    const status = getIndexerStatus();
    return res.json({ ...result, ...status });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});
var indexer_default = router10;

// src/index.ts
var app = (0, import_express11.default)();
app.use((0, import_cors.default)());
app.use(import_express11.default.json({ limit: "2mb" }));
app.use("/api", search_default);
app.use("/api", report_default);
app.use("/api", diagnostics_default);
app.use("/api", chat_default);
app.use("/api", rag_default);
app.use("/api", training_default);
app.use("/api", agent_default);
app.use("/api", threads_default);
app.use("/api", indexer_default);
app.use("/api/index", index_listings_default);
app.use("/reports", import_express11.default.static(import_node_path4.default.resolve(APP_CONFIG.reportsDir)));
app.get("/", (_req, res) => {
  res.json({ status: "ok", name: "ai-property-assistant-server" });
});
var startServer = async () => {
  try {
    console.log("Initializing RAG system...");
    await initializeRAG();
    console.log("RAG system ready");
    console.log("Starting scheduled OLX indexer...");
    startScheduledIndexer();
    console.log("Scheduled indexer started (runs every 4 hours)");
  } catch (error) {
    console.error("Initialization warning:", error);
  }
  app.listen(APP_CONFIG.port, () => {
    console.log(`Server running on http://localhost:${APP_CONFIG.port}`);
  });
};
startServer();
