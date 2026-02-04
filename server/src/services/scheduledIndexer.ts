/**
 * Scheduled Indexer Service
 * Periodically fetches and indexes OLX listings for popular Portuguese locations
 */

import { indexListings } from "./rag/index";
import { ADAPTERS } from "../adapters/registry";
import type { Listing } from "../domain/listing";
import type { PriceRange } from "../types/api";

// Popular Portuguese locations to index
const LOCATIONS_TO_INDEX = [
  { name: "Lisbon", lat: 38.7223, lng: -9.1393 },
  { name: "Porto", lat: 41.1579, lng: -8.6291 },
  { name: "Algarve", lat: 37.0179, lng: -7.9304 },
  { name: "Cascais", lat: 38.6979, lng: -9.4215 },
  { name: "Sintra", lat: 38.8029, lng: -9.3817 },
  { name: "Braga", lat: 41.5454, lng: -8.4265 },
  { name: "Coimbra", lat: 40.2033, lng: -8.4103 },
  { name: "Évora", lat: 38.5714, lng: -7.9135 },
  { name: "Faro", lat: 37.0194, lng: -7.9322 },
  { name: "Vila Nova de Gaia", lat: 41.1239, lng: -8.6118 },
];

// Search queries to index
const SEARCH_QUERIES = [
  "apartments for sale",
  "houses for sale", 
  "land for construction",
  "terreno urbano",
  "moradia",
  "apartamento",
  "villa with pool",
  "quinta",
  "property investment",
];

// Indexing configuration
const CONFIG = {
  // Interval between full index runs (in milliseconds)
  indexInterval: 4 * 60 * 60 * 1000, // 4 hours
  
  // Delay between individual searches to avoid rate limiting
  searchDelay: 5000, // 5 seconds
  
  // Maximum listings to index per run
  maxListingsPerRun: 500,
  
  // Price ranges to search
  priceRanges: [
    { min: 0, max: 100000 },
    { min: 100000, max: 300000 },
    { min: 300000, max: 500000 },
    { min: 500000, max: undefined },
  ] as PriceRange[],
};

let indexingInProgress = false;
let lastIndexTime: Date | null = null;
let totalIndexedCount = 0;
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Fetch listings from OLX for a specific query and location
 */
async function fetchListings(
  query: string,
  location: typeof LOCATIONS_TO_INDEX[0],
  priceRange: PriceRange
): Promise<Listing[]> {
  const allListings: Listing[] = [];
  
  for (const adapter of ADAPTERS) {
    try {
      const listings = await adapter.searchListings({
        query,
        priceRange,
        userLocation: {
          label: location.name,
          lat: location.lat,
          lng: location.lng,
          currency: "EUR",
        },
      });
      allListings.push(...listings);
    } catch (error) {
      console.error(`[Indexer] Error fetching from ${adapter.siteId}:`, error);
    }
  }
  
  return allListings;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a single indexing cycle
 */
export async function runIndexingCycle(): Promise<{ success: boolean; indexed: number; error?: string }> {
  if (indexingInProgress) {
    return { success: false, indexed: 0, error: "Indexing already in progress" };
  }
  
  indexingInProgress = true;
  const startTime = Date.now();
  const allListings: Listing[] = [];
  const seenIds = new Set<string>();
  
  console.log("[Indexer] Starting scheduled indexing cycle...");
  
  try {
    // Iterate through locations and queries
    for (const location of LOCATIONS_TO_INDEX) {
      for (const query of SEARCH_QUERIES.slice(0, 3)) { // Limit queries per location
        for (const priceRange of CONFIG.priceRanges.slice(0, 2)) { // Limit price ranges
          if (allListings.length >= CONFIG.maxListingsPerRun) {
            console.log(`[Indexer] Reached max listings (${CONFIG.maxListingsPerRun}), stopping`);
            break;
          }
          
          try {
            console.log(`[Indexer] Fetching: "${query}" in ${location.name} (€${priceRange.min || 0}-${priceRange.max || 'any'})`);
            const listings = await fetchListings(query, location, priceRange);
            
            // Deduplicate
            for (const listing of listings) {
              if (!seenIds.has(listing.id)) {
                seenIds.add(listing.id);
                allListings.push(listing);
              }
            }
            
            console.log(`[Indexer] Found ${listings.length} listings, total unique: ${allListings.length}`);
            
            // Rate limiting delay
            await sleep(CONFIG.searchDelay);
          } catch (error) {
            console.error(`[Indexer] Error in search:`, error);
          }
        }
        
        if (allListings.length >= CONFIG.maxListingsPerRun) break;
      }
      
      if (allListings.length >= CONFIG.maxListingsPerRun) break;
    }
    
    // Index collected listings
    if (allListings.length > 0) {
      console.log(`[Indexer] Indexing ${allListings.length} unique listings...`);
      await indexListings(allListings);
      totalIndexedCount += allListings.length;
    }
    
    lastIndexTime = new Date();
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Indexer] Indexing cycle complete. Indexed ${allListings.length} listings in ${duration}s`);
    
    return { success: true, indexed: allListings.length };
  } catch (error) {
    console.error("[Indexer] Error during indexing cycle:", error);
    return { success: false, indexed: 0, error: String(error) };
  } finally {
    indexingInProgress = false;
  }
}

/**
 * Start the scheduled indexer
 */
export function startScheduledIndexer(): void {
  if (schedulerInterval) {
    console.log("[Indexer] Scheduler already running");
    return;
  }
  
  console.log(`[Indexer] Starting scheduler (interval: ${CONFIG.indexInterval / 1000 / 60} minutes)`);
  
  // Run initial indexing after a short delay (let server start first)
  setTimeout(() => {
    console.log("[Indexer] Running initial indexing cycle...");
    runIndexingCycle().catch(err => console.error("[Indexer] Initial cycle error:", err));
  }, 30000); // 30 seconds after startup
  
  // Schedule periodic indexing
  schedulerInterval = setInterval(() => {
    console.log("[Indexer] Running scheduled indexing cycle...");
    runIndexingCycle().catch(err => console.error("[Indexer] Scheduled cycle error:", err));
  }, CONFIG.indexInterval);
}

/**
 * Stop the scheduled indexer
 */
export function stopScheduledIndexer(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Indexer] Scheduler stopped");
  }
}

/**
 * Get indexer status
 */
export function getIndexerStatus(): {
  running: boolean;
  indexingInProgress: boolean;
  lastIndexTime: string | null;
  totalIndexed: number;
  nextRunIn: string | null;
  config: typeof CONFIG;
} {
  let nextRunIn: string | null = null;
  if (schedulerInterval && lastIndexTime) {
    const nextRun = lastIndexTime.getTime() + CONFIG.indexInterval;
    const msUntilNext = nextRun - Date.now();
    if (msUntilNext > 0) {
      const minutes = Math.floor(msUntilNext / 1000 / 60);
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
    config: CONFIG,
  };
}

/**
 * Manually trigger an indexing run
 */
export async function triggerIndexing(): Promise<{ success: boolean; indexed: number; error?: string }> {
  return runIndexingCycle();
}
