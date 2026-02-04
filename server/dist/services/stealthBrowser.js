"use strict";
/**
 * Stealth Browser Service - STUB
 *
 * This is a stub implementation for cloud deployment.
 * The OLX adapter uses their public API, so no browser scraping is needed.
 *
 * If browser scraping is needed in the future, this can be implemented
 * with a headless browser service like Browserless.io
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForChallengeResolution = exports.navigateHumanLike = exports.handleCookieConsent = exports.waitForPage = exports.takeScreenshot = exports.simulateHumanBehavior = exports.closeBrowser = exports.navigateWithRetry = exports.createStealthPage = exports.getBrowser = exports.humanDelay = void 0;
/**
 * Random delay to simulate human behavior
 */
const humanDelay = (min = 500, max = 2000) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
};
exports.humanDelay = humanDelay;
/**
 * Stub: Get or create browser instance
 * Throws error indicating browser is not available
 */
const getBrowser = async () => {
    throw new Error("Browser scraping is not available in cloud deployment. Use OLX public API instead.");
};
exports.getBrowser = getBrowser;
/**
 * Stub: Create a new page
 */
const createStealthPage = async (_browser) => {
    throw new Error("Browser scraping is not available in cloud deployment.");
};
exports.createStealthPage = createStealthPage;
/**
 * Stub: Navigate to URL
 */
const navigateWithRetry = async (_page, _url, _maxRetries = 3) => {
    throw new Error("Browser scraping is not available in cloud deployment.");
};
exports.navigateWithRetry = navigateWithRetry;
/**
 * Stub: Close browser
 */
const closeBrowser = async () => {
    // No-op - no browser to close
};
exports.closeBrowser = closeBrowser;
/**
 * Stub: Simulate human behavior
 */
const simulateHumanBehavior = async (_page) => {
    // No-op
};
exports.simulateHumanBehavior = simulateHumanBehavior;
/**
 * Stub: Take screenshot
 */
const takeScreenshot = async (_page, _name) => {
    // No-op
};
exports.takeScreenshot = takeScreenshot;
/**
 * Stub: Wait for page
 */
const waitForPage = async (_page, _options) => {
    // No-op
};
exports.waitForPage = waitForPage;
/**
 * Stub: Handle cookie consent
 */
const handleCookieConsent = async (_page) => {
    // No-op
};
exports.handleCookieConsent = handleCookieConsent;
/**
 * Stub: Navigate human-like
 */
const navigateHumanLike = async (_page, _url) => {
    return false;
};
exports.navigateHumanLike = navigateHumanLike;
/**
 * Stub: Wait for challenge resolution
 */
const waitForChallengeResolution = async (_page, _maxWaitMs) => {
    return false;
};
exports.waitForChallengeResolution = waitForChallengeResolution;
