import type { Listing } from "../domain/listing";
import type { SearchContext, SiteAdapter } from "./base";
import { chromium } from "playwright";

const KYERO_BASE = "https://www.kyero.com";

/**
 * Build Kyero search URL based on search context
 */
const buildSearchUrl = (context: SearchContext): string => {
  const params = new URLSearchParams();
  
  // Property type mapping
  const typeMap: Record<string, string> = {
    land: "land",
    plot: "land",
    house: "houses",
    villa: "villas",
    apartment: "apartments",
    flat: "apartments",
  };
  
  const propertyType = context.propertyType?.toLowerCase();
  const kyeroType = propertyType ? (typeMap[propertyType] ?? "property") : "property";
  
  // Price filters
  if (context.priceRange.max) {
    params.set("price_to", String(context.priceRange.max));
  }
  if (context.priceRange.min) {
    params.set("price_from", String(context.priceRange.min));
  }

  // Build URL - Kyero uses path-based location filtering
  const baseSearchUrl = `${KYERO_BASE}/en/portugal-${kyeroType}-for-sale`;
  
  const queryString = params.toString();
  return queryString ? `${baseSearchUrl}?${queryString}` : baseSearchUrl;
};

/**
 * Parse listing data from Kyero search results page
 */
const parseListings = async (page: any): Promise<Listing[]> => {
  const listings: Listing[] = [];
  
  try {
    // Wait for listings to load
    await page.waitForSelector('[data-testid="property-card"], .property-card, article', { timeout: 10000 });
    
    // Extract listing data
    const cards = await page.$$('[data-testid="property-card"], .property-card, article.listing');
    
    for (const card of cards.slice(0, 20)) { // Limit to 20 results
      try {
        const title = await card.$eval('h2, h3, .title', (el: Element) => el.textContent?.trim() ?? '');
        const priceText = await card.$eval('.price, [data-testid="price"]', (el: Element) => el.textContent?.trim() ?? '');
        const linkEl = await card.$('a[href*="/property/"]');
        const href = linkEl ? await linkEl.getAttribute('href') : null;
        const imgEl = await card.$('img');
        const imgSrc = imgEl ? await imgEl.getAttribute('src') : null;
        const locationEl = await card.$('.location, [data-testid="location"]');
        const location = locationEl ? await locationEl.evaluate((el: Element) => el.textContent?.trim() ?? '') : '';
        
        // Parse price (remove currency symbols and convert)
        const priceMatch = priceText.match(/[\d,]+/);
        const priceEur = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ''), 10) : 0;
        
        if (title && priceEur > 0 && href) {
          listings.push({
            id: `kyero-${href.split('/').pop() ?? Date.now()}`,
            sourceSite: "kyero",
            sourceUrl: href.startsWith('http') ? href : `${KYERO_BASE}${href}`,
            title,
            priceEur,
            currency: "EUR",
            city: location.split(',')[0]?.trim(),
            address: location,
            propertyType: "land",
            photos: imgSrc ? [imgSrc] : [],
            lastSeenAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        // Skip individual card errors
        console.log("Error parsing card:", e);
      }
    }
  } catch (e) {
    console.error("Error parsing Kyero listings:", e);
  }
  
  return listings;
};

export const adapter: SiteAdapter = {
  siteId: "kyero",
  siteName: "Kyero",
  searchListings: async (context: SearchContext): Promise<Listing[]> => {
    const url = buildSearchUrl(context);
    console.log(`[Kyero] Searching: ${url}`);
    
    let browser;
    try {
      browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      // Set realistic headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });
      
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      
      // Handle cookie consent if present
      try {
        const consentBtn = await page.$('button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler');
        if (consentBtn) await consentBtn.click();
        await page.waitForTimeout(500);
      } catch {
        // No consent dialog
      }
      
      // Debug: save screenshot
      await page.screenshot({ path: '/tmp/kyero-debug.png', fullPage: true });
      console.log('[Kyero] Screenshot saved to /tmp/kyero-debug.png');
      
      // Get page HTML for debugging
      const html = await page.content();
      console.log('[Kyero] Page title:', await page.title());
      console.log('[Kyero] HTML length:', html.length);
      
      const listings = await parseListings(page);
      console.log(`[Kyero] Found ${listings.length} listings`);
      
      return listings;
    } catch (error) {
      console.error("[Kyero] Search failed:", error);
      return [];
    } finally {
      if (browser) await browser.close();
    }
  },
};
