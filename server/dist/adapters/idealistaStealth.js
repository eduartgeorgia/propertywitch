"use strict";
/**
 * Idealista Adapter - Interactive form-filling search like a human
 *
 * This adapter navigates to the website and performs searches by
 * interacting with the UI elements just like a human would.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.idealistaStealthAdapter = void 0;
const stealthBrowser_1 = require("../services/stealthBrowser");
const IDEALISTA_BASE = "https://www.idealista.pt";
/**
 * Extract location from user's natural language query
 */
const extractLocation = (query) => {
    const lower = query.toLowerCase();
    // Map English names to Portuguese
    const locationMap = {
        "lisbon": "Lisboa",
        "lisboa": "Lisboa",
        "porto": "Porto",
        "algarve": "Algarve",
        "faro": "Faro",
        "sintra": "Sintra",
        "cascais": "Cascais",
        "setubal": "Setúbal",
        "coimbra": "Coimbra",
        "braga": "Braga",
        "evora": "Évora",
        "aveiro": "Aveiro",
        "leiria": "Leiria",
        "santarem": "Santarém",
        "madeira": "Madeira",
        "azores": "Açores",
        "portugal": "Portugal",
    };
    for (const [key, value] of Object.entries(locationMap)) {
        if (lower.includes(key)) {
            return value;
        }
    }
    return "Portugal"; // Default
};
/**
 * Extract property type from user's query
 */
const extractPropertyType = (query) => {
    const lower = query.toLowerCase();
    if (lower.includes("land") || lower.includes("plot") || lower.includes("terrain") || lower.includes("terreno")) {
        return "Terrenos";
    }
    if (lower.includes("house") || lower.includes("villa") || lower.includes("moradia")) {
        return "Moradias";
    }
    if (lower.includes("apartment") || lower.includes("flat") || lower.includes("apartamento")) {
        return "Apartamentos";
    }
    if (lower.includes("commercial") || lower.includes("comercial")) {
        return "Comercial";
    }
    return ""; // Let user choose or search all
};
/**
 * Handle cookie consent dialogs
 */
const handleCookieConsent = async (page) => {
    console.log("[Idealista] Checking for cookie consent...");
    const cookieSelectors = [
        '#didomi-notice-agree-button',
        'button[aria-label*="Accept"]',
        'button[aria-label*="Aceitar"]',
        '.didomi-popup-notice-buttons button',
        '[data-testid="notice-accept-button"]',
        '#onetrust-accept-btn-handler',
    ];
    for (const sel of cookieSelectors) {
        try {
            const btn = await page.$(sel);
            if (btn) {
                await btn.click();
                console.log("[Idealista] Accepted cookies");
                await (0, stealthBrowser_1.humanDelay)(1000, 2000);
                return;
            }
        }
        catch (e) {
            // Continue trying other selectors
        }
    }
};
/**
 * Perform interactive search by filling forms like a human
 */
const performInteractiveSearch = async (page, context) => {
    const location = extractLocation(context.query);
    const propertyType = extractPropertyType(context.query);
    console.log(`[Idealista] Interactive search for: "${context.query}"`);
    console.log(`[Idealista] Extracted location: ${location}`);
    console.log(`[Idealista] Extracted property type: ${propertyType || "any"}`);
    console.log(`[Idealista] Price range: ${context.priceRange.min ?? 0} - ${context.priceRange.max ?? "unlimited"} EUR`);
    // Navigate to homepage
    const success = await (0, stealthBrowser_1.navigateHumanLike)(page, IDEALISTA_BASE);
    if (!success) {
        console.log("[Idealista] Failed to load homepage");
        return false;
    }
    await (0, stealthBrowser_1.humanDelay)(2000, 3500);
    await (0, stealthBrowser_1.simulateHumanBehavior)(page);
    // Handle cookie consent first
    await handleCookieConsent(page);
    await (0, stealthBrowser_1.humanDelay)(1000, 1500);
    // Take screenshot of homepage
    await page.screenshot({ path: "/tmp/idealista-home.png", fullPage: false });
    console.log("[Idealista] Homepage loaded");
    // Look for the main search input
    const searchInputSelectors = [
        '#campoBus',
        '#location-input',
        'input[name="locationSearched"]',
        'input[placeholder*="localização"]',
        'input[placeholder*="location"]',
        'input[placeholder*="zona"]',
        'input[type="search"]',
        '.location-autocomplete input',
        'input.search-location',
        '#search-box input',
    ];
    let searchInput = null;
    for (const sel of searchInputSelectors) {
        try {
            searchInput = await page.$(sel);
            if (searchInput) {
                console.log(`[Idealista] Found search input: ${sel}`);
                break;
            }
        }
        catch (e) {
            // Continue
        }
    }
    if (searchInput) {
        // Click and type the location
        await searchInput.click();
        await (0, stealthBrowser_1.humanDelay)(300, 600);
        // Clear any existing text
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await (0, stealthBrowser_1.humanDelay)(100, 200);
        // Type the location with human-like delays
        console.log(`[Idealista] Typing location: ${location}`);
        await searchInput.type(location, { delay: 80 + Math.random() * 70 });
        await (0, stealthBrowser_1.humanDelay)(1500, 2500);
        // Wait for and click autocomplete suggestion
        const suggestionSelectors = [
            '.autocomplete-item',
            '.location-item',
            '.suggestion-item',
            'li[data-location]',
            '.pac-item',
            '.suggestions li',
            '[role="option"]',
            '.dropdown-item',
        ];
        for (const sel of suggestionSelectors) {
            try {
                await page.waitForSelector(sel, { timeout: 3000 });
                const suggestion = await page.$(sel);
                if (suggestion) {
                    await (0, stealthBrowser_1.humanDelay)(500, 800);
                    await suggestion.click();
                    console.log("[Idealista] Clicked location suggestion");
                    await (0, stealthBrowser_1.humanDelay)(1000, 1500);
                    break;
                }
            }
            catch (e) {
                // Continue trying other selectors
            }
        }
    }
    // Try to select property type if available
    if (propertyType) {
        const typeSelectors = [
            `button:has-text("${propertyType}")`,
            `a:has-text("${propertyType}")`,
            `[data-type="${propertyType.toLowerCase()}"]`,
        ];
        for (const sel of typeSelectors) {
            try {
                const typeBtn = await page.$(sel);
                if (typeBtn) {
                    await typeBtn.click();
                    console.log(`[Idealista] Selected property type: ${propertyType}`);
                    await (0, stealthBrowser_1.humanDelay)(500, 1000);
                    break;
                }
            }
            catch (e) {
                // Continue
            }
        }
    }
    // Click search button
    const searchBtnSelectors = [
        '#main-search-submit',
        'button[type="submit"]',
        '.search-button',
        '.submit-button',
        'button[aria-label*="Pesquisar"]',
        'button[aria-label*="Search"]',
        'input[type="submit"]',
        '.btn-search',
    ];
    for (const sel of searchBtnSelectors) {
        try {
            const searchBtn = await page.$(sel);
            if (searchBtn) {
                await (0, stealthBrowser_1.humanDelay)(500, 800);
                await searchBtn.click();
                console.log(`[Idealista] Clicked search button`);
                await (0, stealthBrowser_1.humanDelay)(3000, 5000);
                break;
            }
        }
        catch (e) {
            // Continue
        }
    }
    // Take screenshot after search
    await page.screenshot({ path: "/tmp/idealista-after-search.png", fullPage: false });
    console.log("[Idealista] Search submitted, on results page");
    // Apply price filters if we have them
    if (context.priceRange.max || context.priceRange.min) {
        await applyPriceFilters(page, context);
    }
    return true;
};
/**
 * Apply price filters on the results page
 */
const applyPriceFilters = async (page, context) => {
    console.log("[Idealista] Applying price filters...");
    try {
        // Look for price filter button/dropdown
        const priceFilterSelectors = [
            'button[data-filter="price"]',
            '.filter-price',
            '[aria-label*="preço"]',
            '[aria-label*="price"]',
            '.price-filter',
            'button:has-text("Preço")',
            'button:has-text("Price")',
        ];
        for (const sel of priceFilterSelectors) {
            try {
                const filterBtn = await page.$(sel);
                if (filterBtn) {
                    await filterBtn.click();
                    console.log("[Idealista] Opened price filter");
                    await (0, stealthBrowser_1.humanDelay)(500, 1000);
                    break;
                }
            }
            catch (e) {
                // Continue
            }
        }
        // Set max price if provided
        if (context.priceRange.max) {
            const maxPriceSelectors = [
                'input[name="maxPrice"]',
                'input[name="priceTo"]',
                '#priceTo',
                'input[placeholder*="máximo"]',
                'input[placeholder*="max"]',
                '.price-max input',
            ];
            for (const sel of maxPriceSelectors) {
                try {
                    const maxInput = await page.$(sel);
                    if (maxInput) {
                        await maxInput.click();
                        await maxInput.type(String(Math.round(context.priceRange.max)), { delay: 50 });
                        console.log(`[Idealista] Set max price: ${context.priceRange.max}`);
                        await (0, stealthBrowser_1.humanDelay)(500, 800);
                        break;
                    }
                }
                catch (e) {
                    // Continue
                }
            }
        }
        // Set min price if provided
        if (context.priceRange.min) {
            const minPriceSelectors = [
                'input[name="minPrice"]',
                'input[name="priceFrom"]',
                '#priceFrom',
                'input[placeholder*="mínimo"]',
                'input[placeholder*="min"]',
                '.price-min input',
            ];
            for (const sel of minPriceSelectors) {
                try {
                    const minInput = await page.$(sel);
                    if (minInput) {
                        await minInput.click();
                        await minInput.type(String(Math.round(context.priceRange.min)), { delay: 50 });
                        console.log(`[Idealista] Set min price: ${context.priceRange.min}`);
                        await (0, stealthBrowser_1.humanDelay)(500, 800);
                        break;
                    }
                }
                catch (e) {
                    // Continue
                }
            }
        }
        // Apply filters
        const applySelectors = [
            '.apply-filter',
            'button[type="submit"]',
            '.filter-submit',
            'button:has-text("Aplicar")',
            'button:has-text("Apply")',
        ];
        for (const sel of applySelectors) {
            try {
                const applyBtn = await page.$(sel);
                if (applyBtn) {
                    await applyBtn.click();
                    console.log("[Idealista] Applied price filters");
                    await (0, stealthBrowser_1.humanDelay)(2000, 3000);
                    break;
                }
            }
            catch (e) {
                // Continue
            }
        }
    }
    catch (error) {
        console.log("[Idealista] Price filter application error:", error);
    }
};
/**
 * Parse listings from the results page
 */
const parseListings = async (page) => {
    const listings = [];
    try {
        const currentUrl = await page.url();
        console.log("[Idealista] Parsing results from:", currentUrl);
        // Wait for content to fully load
        await (0, stealthBrowser_1.humanDelay)(2000, 3000);
        // Scroll to trigger lazy loading
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 500));
            await (0, stealthBrowser_1.humanDelay)(400, 700);
        }
        // Save screenshot for debugging
        await page.screenshot({ path: "/tmp/idealista-results.png", fullPage: false });
        // Extract listings from page
        const rawListings = await page.evaluate(() => {
            const results = [];
            const itemSelectors = [
                "article.item",
                ".item-info-container",
                ".listing-item",
                ".items-container article",
                "[data-element='list-item-card']",
                ".item",
            ];
            let items = null;
            for (const sel of itemSelectors) {
                items = document.querySelectorAll(sel);
                if (items.length > 0) {
                    console.log(`Found ${items.length} items with: ${sel}`);
                    break;
                }
            }
            if (!items || items.length === 0) {
                console.log("No listing items found on page");
                return results;
            }
            items.forEach((item, index) => {
                if (index >= 20)
                    return; // Limit results
                try {
                    const titleEl = item.querySelector(".item-link, a.item-link, .item-title, a[title], h3 a, .item-description a");
                    const priceEl = item.querySelector(".item-price, .price-row, [class*='price'], .price");
                    const linkEl = item.querySelector("a.item-link, a[href*='/imovel/'], a[href*='/terreno/'], h3 a");
                    const imgEl = item.querySelector("img, picture img, [data-ondemand-img]");
                    const detailsEl = item.querySelector(".item-detail, .item-details, .detail");
                    const locationEl = item.querySelector(".item-detail-char, [class*='location'], .item-location");
                    const title = titleEl?.textContent?.trim() || titleEl?.getAttribute("title") || "";
                    const priceText = priceEl?.textContent?.trim() ?? "";
                    const href = linkEl?.href ?? linkEl?.getAttribute("href") ?? "";
                    const imgSrc = imgEl?.src ?? imgEl?.dataset?.src ?? imgEl?.dataset?.ondemandImg ?? "";
                    const details = detailsEl?.textContent?.trim() ?? "";
                    const location = locationEl?.textContent?.trim() ?? "";
                    // Parse price
                    const priceMatch = priceText.replace(/[^\d]/g, "");
                    const price = priceMatch ? parseInt(priceMatch, 10) : 0;
                    // Parse area
                    const areaMatch = details.match(/(\d[\d.,]*)\s*m[²2]/);
                    const area = areaMatch ? parseInt(areaMatch[1].replace(/[.,]/g, ""), 10) : undefined;
                    // Parse beds
                    const bedsMatch = details.match(/(\d+)\s*(?:hab|quarto|T\d)/i);
                    const beds = bedsMatch ? parseInt(bedsMatch[1], 10) : undefined;
                    if (title || price > 0) {
                        results.push({
                            title: title || "Untitled Property",
                            price,
                            href,
                            imgSrc,
                            location,
                            area,
                            beds
                        });
                    }
                }
                catch (e) {
                    // Skip this item on error
                }
            });
            return results;
        });
        console.log(`[Idealista] Found ${rawListings.length} listings on page`);
        // Convert to Listing format
        for (const item of rawListings) {
            const idMatch = item.href.match(/\/(\d+)\/?$/);
            const id = idMatch?.[1] ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            listings.push({
                id: `idealista-${id}`,
                sourceSite: "idealista",
                sourceUrl: item.href.startsWith("http") ? item.href : `${IDEALISTA_BASE}${item.href}`,
                title: item.title,
                priceEur: item.price,
                currency: "EUR",
                beds: item.beds,
                areaSqm: item.area,
                city: item.location.split(",")[0]?.trim(),
                address: item.location,
                propertyType: "land",
                photos: item.imgSrc ? [item.imgSrc] : [],
                lastSeenAt: new Date().toISOString(),
            });
        }
        console.log(`[Idealista] Parsed ${listings.length} valid listings`);
    }
    catch (error) {
        console.error("[Idealista] Parse error:", error);
    }
    return listings;
};
exports.idealistaStealthAdapter = {
    siteId: "idealista",
    siteName: "Idealista",
    searchListings: async (context) => {
        console.log(`\n[Idealista] ========== Starting Interactive Search ==========`);
        console.log(`[Idealista] User query: "${context.query}"`);
        let page;
        try {
            const browser = await (0, stealthBrowser_1.getBrowser)();
            page = await (0, stealthBrowser_1.createStealthPage)(browser);
            // Perform the interactive search
            const searchSuccess = await performInteractiveSearch(page, context);
            if (!searchSuccess) {
                console.log("[Idealista] Interactive search failed");
                return [];
            }
            // Give page time to fully load results
            await (0, stealthBrowser_1.humanDelay)(2000, 3000);
            // Parse and return the listings
            const listings = await parseListings(page);
            return listings.map((l) => ({
                ...l,
                propertyType: context.propertyType ?? l.propertyType,
            }));
        }
        catch (error) {
            console.error("[Idealista] Search failed:", error);
            return [];
        }
        finally {
            if (page) {
                try {
                    await page.close();
                }
                catch (e) {
                    // Ignore close errors
                }
            }
        }
    },
};
