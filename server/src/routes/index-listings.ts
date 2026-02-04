import { Router } from "express";
import { z } from "zod";
import { indexListings } from "../services/rag/ragService";
import { getVectorStore } from "../services/rag/vectorStore";
import type { Listing } from "../domain/listing";

const router = Router();

// OLX Region IDs
const OLX_REGIONS: Record<string, number> = {
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
  madeira: 20,
};

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
    city?: { id: number; name: string; normalized_name: string };
    region?: { id: number; name: string; normalized_name: string };
  };
  map?: { lat: number; lon: number };
  photos: Array<{ id: number; filename: string; link: string }>;
  category: { id: number; type: string };
}

function extractPrice(params: OLXListing["params"]): number {
  const priceParam = params.find((p) => p.key === "price");
  return priceParam?.value?.value || 0;
}

function extractArea(params: OLXListing["params"]): number | undefined {
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

function mapOLXToListing(olx: OLXListing): Listing {
  const cityName = olx.location?.city?.name || "";
  const regionName = olx.location?.region?.name || "";
  
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
    address: [cityName, regionName].filter(Boolean).join(", "),
    city: cityName || regionName,
    lat: olx.map?.lat,
    lng: olx.map?.lon,
    propertyType: olx.category?.type,
    description: olx.description?.replace(/<[^>]*>/g, " ").slice(0, 500),
    photos: olx.photos?.map((p) => p.link.replace("{width}", "800").replace("{height}", "600")) || [],
    lastSeenAt: olx.last_refresh_time || olx.created_time,
  };
}

async function fetchOLXPage(
  categoryId: number,
  regionId: number,
  offset: number,
  limit: number = 40,
  query?: string
): Promise<{ listings: OLXListing[]; hasMore: boolean; total: number }> {
  const params = new URLSearchParams({
    category_id: String(categoryId),
    region_id: String(regionId),
    limit: String(limit),
    offset: String(offset),
  });
  
  if (query) {
    params.set("query", query);
  }
  
  const url = `https://www.olx.pt/api/v1/offers?${params}`;
  
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; AIPA/1.0)",
    },
  });
  
  if (!response.ok) {
    throw new Error(`OLX API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    listings: data.data || [],
    hasMore: !!data.links?.next,
    total: data.metadata?.visible_total_count || 0,
  };
}

// Get indexing stats
router.get("/stats", async (_req, res) => {
  try {
    const store = getVectorStore();
    const stats = store.getStats();
    
    // Get unique cities from indexed listings
    const listingsData = store.getCollection("listings") || [];
    const cities = new Set<string>();
    listingsData.forEach((doc: any) => {
      if (doc.metadata?.city) cities.add(doc.metadata.city);
    });
    
    res.json({
      collections: stats,
      totalListings: stats.listings || 0,
      uniqueCities: Array.from(cities),
      availableRegions: Object.keys(OLX_REGIONS),
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Bulk index listings from OLX
const indexSchema = z.object({
  region: z.string().optional().default("porto"),
  categoryId: z.number().optional().default(16), // 16 = Imóveis (Real Estate)
  maxListings: z.number().optional().default(500),
  startOffset: z.number().optional().default(0),
  query: z.string().optional(), // Search query (e.g., "urbano" for urban land)
});

router.post("/bulk-index", async (req, res) => {
  const parsed = indexSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  
  const { region, categoryId, maxListings, startOffset, query } = parsed.data;
  const regionId = OLX_REGIONS[region.toLowerCase()] || OLX_REGIONS.porto;
  
  console.log(`[Index] Starting bulk index for ${region} (region_id: ${regionId})${query ? `, query: "${query}"` : ''}`);
  console.log(`[Index] Max listings: ${maxListings}, start offset: ${startOffset}`);
  
  try {
    const allListings: Listing[] = [];
    let offset = startOffset;
    const perPage = 40;
    let totalAvailable = 0;
    
    while (allListings.length < maxListings) {
      console.log(`[Index] Fetching page at offset ${offset}...`);
      
      const { listings: olxListings, hasMore, total } = await fetchOLXPage(
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
      
      const mapped = olxListings.map(mapOLXToListing);
      allListings.push(...mapped);
      
      console.log(`[Index] Got ${olxListings.length} listings, total collected: ${allListings.length}`);
      
      if (!hasMore || olxListings.length < perPage) {
        break;
      }
      
      offset += perPage;
      
      // Rate limiting - wait between requests
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Trim to max if we got more
    const toIndex = allListings.slice(0, maxListings);
    
    // Index in batches of 50 to avoid memory issues
    const batchSize = 50;
    let indexed = 0;
    
    for (let i = 0; i < toIndex.length; i += batchSize) {
      const batch = toIndex.slice(i, i + batchSize);
      await indexListings(batch);
      indexed += batch.length;
      console.log(`[Index] Indexed batch ${Math.floor(i / batchSize) + 1}, total indexed: ${indexed}`);
    }
    
    // Get updated stats
    const store = getVectorStore();
    const stats = store.getStats();
    
    res.json({
      success: true,
      region,
      regionId,
      newListingsIndexed: indexed,
      totalListingsNow: stats.listings,
      totalAvailableOnOLX: totalAvailable,
      nextOffset: offset,
    });
    
  } catch (error) {
    console.error("[Index] Bulk indexing failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
