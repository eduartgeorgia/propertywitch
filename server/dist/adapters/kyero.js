"use strict";
/**
 * Kyero Adapter - STUB
 *
 * This adapter is disabled for cloud deployment as it requires Playwright.
 * The OLX adapter (using their public API) is the primary source.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapter = void 0;
exports.adapter = {
    siteId: "kyero",
    siteName: "Kyero",
    searchListings: async (_context) => {
        console.log("[Kyero] Adapter disabled - using OLX public API instead");
        return [];
    },
};
