/**
 * Stealth Browser Service - STUB
 * 
 * This is a stub implementation for cloud deployment.
 * The OLX adapter uses their public API, so no browser scraping is needed.
 * 
 * If browser scraping is needed in the future, this can be implemented
 * with a headless browser service like Browserless.io
 */

// Stub types to match original interface
export type Browser = {
  connected: boolean;
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
};

export type Page = {
  goto: (url: string, options?: unknown) => Promise<unknown>;
  content: () => Promise<string>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  close: () => Promise<void>;
  setViewport: (viewport: unknown) => Promise<void>;
  setUserAgent: (ua: string) => Promise<void>;
  setExtraHTTPHeaders: (headers: Record<string, string>) => Promise<void>;
  mouse: { move: (x: number, y: number, options?: unknown) => Promise<void> };
  viewport: () => { width: number; height: number } | null;
  evaluateOnNewDocument: (fn: () => void) => Promise<void>;
  waitForTimeout: (ms: number) => Promise<void>;
  waitForSelector: (selector: string, options?: unknown) => Promise<unknown>;
  $: (selector: string) => Promise<unknown>;
  $$: (selector: string) => Promise<unknown[]>;
  click: (selector: string, options?: unknown) => Promise<void>;
  type: (selector: string, text: string, options?: unknown) => Promise<void>;
};

/**
 * Random delay to simulate human behavior
 */
export const humanDelay = (min = 500, max = 2000): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

/**
 * Stub: Get or create browser instance
 * Throws error indicating browser is not available
 */
export const getBrowser = async (): Promise<Browser> => {
  throw new Error("Browser scraping is not available in cloud deployment. Use OLX public API instead.");
};

/**
 * Stub: Create a new page
 */
export const createStealthPage = async (_browser: Browser): Promise<Page> => {
  throw new Error("Browser scraping is not available in cloud deployment.");
};

/**
 * Stub: Navigate to URL
 */
export const navigateWithRetry = async (
  _page: Page,
  _url: string,
  _maxRetries = 3
): Promise<string> => {
  throw new Error("Browser scraping is not available in cloud deployment.");
};

/**
 * Stub: Close browser
 */
export const closeBrowser = async (): Promise<void> => {
  // No-op - no browser to close
};

/**
 * Stub: Simulate human behavior
 */
export const simulateHumanBehavior = async (_page: Page): Promise<void> => {
  // No-op
};

/**
 * Stub: Take screenshot
 */
export const takeScreenshot = async (_page: Page, _name: string): Promise<void> => {
  // No-op
};

/**
 * Stub: Wait for page
 */
export const waitForPage = async (_page: Page, _options?: unknown): Promise<void> => {
  // No-op
};

/**
 * Stub: Handle cookie consent
 */
export const handleCookieConsent = async (_page: Page): Promise<void> => {
  // No-op
};

/**
 * Stub: Navigate human-like
 */
export const navigateHumanLike = async (_page: Page, _url: string): Promise<boolean> => {
  return false;
};

/**
 * Stub: Wait for challenge resolution
 */
export const waitForChallengeResolution = async (_page: Page, _maxWaitMs?: number): Promise<boolean> => {
  return false;
};

