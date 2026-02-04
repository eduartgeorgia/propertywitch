import type { Listing } from "../domain/listing";
import type { SearchContext, SiteAdapter } from "./base";

/**
 * Realistic mock listings for Portugal property search
 * These simulate real search results when actual sites have anti-bot protection
 */
const mockListings: Listing[] = [
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
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "mock-kyero-002",
    sourceSite: "kyero",
    sourceUrl: "https://www.kyero.com/en/property/mock-002",
    title: "Agricultural land in Loures",
    priceEur: 22000,
    currency: "EUR",
    areaSqm: 2500,
    address: "Loures, Lisbon District",
    city: "Loures",
    lat: 38.8309,
    lng: -9.1685,
    propertyType: "land",
    description: "Flat agricultural land with water access. 30 min from Lisbon center.",
    photos: ["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800"],
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "mock-supercasa-003",
    sourceSite: "supercasa",
    sourceUrl: "https://supercasa.pt/mock-003",
    title: "Building plot in Torres Vedras",
    priceEur: 35000,
    currency: "EUR",
    areaSqm: 800,
    address: "Torres Vedras, Lisbon District",
    city: "Torres Vedras",
    lat: 39.0914,
    lng: -9.2586,
    propertyType: "land",
    description: "Urban land with building permit approved. All utilities connected.",
    photos: ["https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?w=800"],
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "mock-idealista-004",
    sourceSite: "idealista",
    sourceUrl: "https://www.idealista.pt/imovel/mock-004",
    title: "Vineyard land in Alentejo",
    priceEur: 45000,
    currency: "EUR",
    areaSqm: 15000,
    address: "Évora, Alentejo",
    city: "Évora",
    lat: 38.5667,
    lng: -7.9,
    propertyType: "land",
    description: "Large plot with existing vineyard. Ideal for wine production or agritourism project.",
    photos: ["https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800"],
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "mock-kyero-005",
    sourceSite: "kyero",
    sourceUrl: "https://www.kyero.com/en/property/mock-005",
    title: "Coastal plot near Setúbal",
    priceEur: 48000,
    currency: "EUR",
    areaSqm: 3200,
    address: "Setúbal, Setúbal District",
    city: "Setúbal",
    lat: 38.5244,
    lng: -8.8926,
    propertyType: "land",
    description: "Sea views, 10 min from beach. Electricity at boundary.",
    photos: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"],
    lastSeenAt: new Date().toISOString(),
  },
  // Houses
  {
    id: "mock-supercasa-006",
    sourceSite: "supercasa",
    sourceUrl: "https://supercasa.pt/mock-006",
    title: "Traditional stone house to renovate in Mafra",
    priceEur: 55000,
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
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "mock-idealista-007",
    sourceSite: "idealista",
    sourceUrl: "https://www.idealista.pt/imovel/mock-007",
    title: "Rural house with land in Alenquer",
    priceEur: 72000,
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
    lastSeenAt: new Date().toISOString(),
  },
  // Apartments
  {
    id: "mock-imovirtual-008",
    sourceSite: "imovirtual",
    sourceUrl: "https://www.imovirtual.com/mock-008",
    title: "Studio apartment in Porto center",
    priceEur: 89000,
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
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "mock-olx-009",
    sourceSite: "olx",
    sourceUrl: "https://www.olx.pt/mock-009",
    title: "1-bed apartment in Coimbra",
    priceEur: 65000,
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
    lastSeenAt: new Date().toISOString(),
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
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "mock-kyero-011",
    sourceSite: "kyero",
    sourceUrl: "https://www.kyero.com/en/property/mock-011",
    title: "Rustic land in Trás-os-Montes",
    priceEur: 12000,
    currency: "EUR",
    areaSqm: 4000,
    address: "Bragança",
    city: "Bragança",
    lat: 41.8061,
    lng: -6.7589,
    propertyType: "land",
    description: "Large rural plot with spring water. Remote but beautiful location.",
    photos: ["https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800"],
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "mock-supercasa-012",
    sourceSite: "supercasa",
    sourceUrl: "https://supercasa.pt/mock-012",
    title: "Olive grove land in Algarve",
    priceEur: 29000,
    currency: "EUR",
    areaSqm: 8000,
    address: "Tavira, Algarve",
    city: "Tavira",
    lat: 37.1271,
    lng: -7.6506,
    propertyType: "land",
    description: "Established olive grove with 50+ trees. Potential for rural tourism.",
    photos: ["https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800"],
    lastSeenAt: new Date().toISOString(),
  },
];

/**
 * Filter listings based on search context
 */
const filterByContext = (listings: Listing[], context: SearchContext): Listing[] => {
  const query = context.query.toLowerCase();
  
  return listings.filter((listing) => {
    // Property type filter
    if (context.propertyType) {
      const type = context.propertyType.toLowerCase();
      const listingType = listing.propertyType?.toLowerCase() ?? '';
      
      if (type === 'land' || type === 'plot' || type === 'terrain') {
        if (listingType !== 'land') return false;
      } else if (type === 'house' || type === 'villa' || type === 'cottage') {
        if (listingType !== 'house') return false;
      } else if (type === 'apartment' || type === 'flat') {
        if (listingType !== 'apartment') return false;
      }
    } else {
      // Infer from query
      if (query.includes('land') || query.includes('plot') || query.includes('terrain')) {
        if (listing.propertyType !== 'land') return false;
      } else if (query.includes('house') || query.includes('villa') || query.includes('cottage')) {
        if (listing.propertyType !== 'house') return false;
      } else if (query.includes('apartment') || query.includes('flat')) {
        if (listing.propertyType !== 'apartment') return false;
      }
    }
    
    // Price filter
    if (context.priceRange.min && listing.priceEur < context.priceRange.min) return false;
    if (context.priceRange.max && listing.priceEur > context.priceRange.max) return false;
    
    return true;
  });
};

export const mockAdapter: SiteAdapter = {
  siteId: "mock",
  siteName: "Mock Listings",
  searchListings: async (context: SearchContext) => {
    console.log(`[Mock] Searching with price range: ${context.priceRange.min ?? 0} - ${context.priceRange.max ?? 'unlimited'}`);
    
    const filtered = filterByContext(mockListings, context);
    console.log(`[Mock] Found ${filtered.length} matching listings`);
    
    return filtered;
  },
};
