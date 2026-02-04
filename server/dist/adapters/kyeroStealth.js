"use strict";
/**
 * Kyero Adapter - Interactive form-filling search like a human
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapter = exports.kyeroStealthAdapter = void 0;
const stealthBrowser_1 = require("../services/stealthBrowser");
const KYERO_BASE = "https://www.kyero.com";
const extractLocation = (query) => {
    const lower = query.toLowerCase();
    const locationMap = {
        "lisbon": "Lisbon", "lisboa": "Lisbon", "porto": "Porto",
        "algarve": "Algarve", "faro": "Faro", "sintra": "Sintra",
        "cascais": "Cascais", "coimbra": "Coimbra", "braga": "Braga",
        "madeira": "Madeira", "portugal": "Portugal",
    };
    for (const [key, value] of Object.entries(locationMap)) {
        if (lower.includes(key))
            return value;
    }
    return "Portugal";
};
const handleCookieConsent = async (page) => {
    const selectors = ['#onetrust-accept-btn-handler', 'button[aria-label*="Accept"]', '.cookie-accept'];
    for (const sel of selectors) {
        try {
            const btn = await page.$(sel);
            if (btn) {
                await btn.click();
                await (0, stealthBrowser_1.humanDelay)(1000, 1500);
                return;
            }
        }
        catch (e) { }
    }
};
const performInteractiveSearch = async (page, context) => {
    const location = extractLocation(context.query);
    console.log(`[Kyero] Search: "${context.query}" -> Location: ${location}`);
    const success = await (0, stealthBrowser_1.navigateHumanLike)(page, KYERO_BASE);
    if (!success)
        return false;
    await (0, stealthBrowser_1.humanDelay)(2000, 3500);
    await (0, stealthBrowser_1.simulateHumanBehavior)(page);
    await handleCookieConsent(page);
    const searchSelectors = ['input[name="search"]', 'input[placeholder*="Search"]', 'input[type="search"]', '.search-input'];
    let searchInput = null;
    for (const sel of searchSelectors) {
        try {
            searchInput = await page.$(sel);
            if (searchInput)
                break;
        }
        catch (e) { }
    }
    if (searchInput) {
        await searchInput.click();
        await (0, stealthBrowser_1.humanDelay)(300, 500);
        await searchInput.type(location, { delay: 80 + Math.random() * 60 });
        await (0, stealthBrowser_1.humanDelay)(1500, 2500);
        const suggestionSelectors = ['.autocomplete-item', '.suggestion', '[role="option"]', 'li.search-result'];
        for (const sel of suggestionSelectors) {
            try {
                await page.waitForSelector(sel, { timeout: 3000 });
                const suggestion = await page.$(sel);
                if (suggestion) {
                    await suggestion.click();
                    await (0, stealthBrowser_1.humanDelay)(1000, 1500);
                    break;
                }
            }
            catch (e) { }
        }
    }
    const btnSelectors = ['button[type="submit"]', '.search-button', '.btn-search'];
    for (const sel of btnSelectors) {
        try {
            const btn = await page.$(sel);
            if (btn) {
                await btn.click();
                await (0, stealthBrowser_1.humanDelay)(3000, 5000);
                break;
            }
        }
        catch (e) { }
    }
    await page.screenshot({ path: "/tmp/kyero-results.png", fullPage: false });
    return true;
};
const parseListings = async (page) => {
    const listings = [];
    try {
        await (0, stealthBrowser_1.humanDelay)(2000, 3000);
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 500));
            await (0, stealthBrowser_1.humanDelay)(400, 700);
        }
        const rawListings = await page.evaluate(() => {
            const results = [];
            const cards = document.querySelectorAll('article[class*="property"], .property-card, article');
            cards.forEach((card, index) => {
                if (index >= 20)
                    return;
                try {
                    const titleEl = card.querySelector("h2, h3, .title");
                    const priceEl = card.querySelector(".price, [class*='price']");
                    const linkEl = card.querySelector("a[href*='/property/']");
                    const imgEl = card.querySelector("img");
                    const locationEl = card.querySelector(".location, address");
                    const title = titleEl?.textContent?.trim() ?? "";
                    const priceText = priceEl?.textContent?.trim() ?? "";
                    const href = linkEl?.href ?? "";
                    const imgSrc = imgEl?.src ?? "";
                    const location = locationEl?.textContent?.trim() ?? "";
                    const priceMatch = priceText.replace(/[^\d]/g, "");
                    const price = priceMatch ? parseInt(priceMatch, 10) : 0;
                    if (title && price > 0)
                        results.push({ title, price, href, imgSrc, location });
                }
                catch (e) { }
            });
            return results;
        });
        console.log(`[Kyero] Found ${rawListings.length} listings`);
        for (const item of rawListings) {
            const id = item.href.split("/").pop() ?? `${Date.now()}`;
            listings.push({
                id: `kyero-${id}`, sourceSite: "kyero",
                sourceUrl: item.href.startsWith("http") ? item.href : `${KYERO_BASE}${item.href}`,
                title: item.title, priceEur: item.price, currency: "EUR",
                city: item.location.split(",")[0]?.trim(), address: item.location,
                propertyType: "land", photos: item.imgSrc ? [item.imgSrc] : [],
                lastSeenAt: new Date().toISOString(),
            });
        }
    }
    catch (error) {
        console.error("[Kyero] Parse error:", error);
    }
    return listings;
};
exports.kyeroStealthAdapter = {
    siteId: "kyero",
    siteName: "Kyero",
    searchListings: async (context) => {
        console.log(`[Kyero] ========== Interactive Search ==========`);
        let page;
        try {
            const browser = await (0, stealthBrowser_1.getBrowser)();
            page = await (0, stealthBrowser_1.createStealthPage)(browser);
            const searchSuccess = await performInteractiveSearch(page, context);
            if (!searchSuccess)
                return [];
            await (0, stealthBrowser_1.humanDelay)(2000, 3000);
            const listings = await parseListings(page);
            return listings.map((l) => ({ ...l, propertyType: context.propertyType ?? l.propertyType }));
        }
        catch (error) {
            console.error("[Kyero] Search failed:", error);
            return [];
        }
        finally {
            if (page) {
                try {
                    await page.close();
                }
                catch (e) { }
            }
        }
    },
};
exports.adapter = exports.kyeroStealthAdapter;
