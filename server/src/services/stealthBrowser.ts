/**
 * Stealth Browser Service - STUB VERSION FOR CLOUD DEPLOYMENT
 * 
 * Browser automation is disabled in cloud deployment.
 * This stub provides no-op implementations to prevent import errors.
 */

// Stub types
type Browser = any;
type Page = any;

/**
 * Random delay to simulate human behavior
 */
export const humanDelay = (min = 500, max = 2000): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

/**
 * Stub - browser not available in cloud
 */
export const simulateHumanBehavior = async (page: Page): Promise<void> => {
  // No-op in cloud deployment
};

/**
 * Stub - browser not available in cloud
 */
export const getBrowser = async (): Promise<Browser> => {
  throw new Error("Browser automation not available in cloud deployment");
};

/**
 * Stub - browser not available in cloud
 */
export const createStealthPage = async (browser: Browser): Promise<Page> => {
  throw new Error("Browser automation not available in cloud deployment");
};

/**
 * Stub - browser not available in cloud
 */
export const closeBrowser = async (): Promise<void> => {
  // No-op
};

/**
 * Stub - browser not available in cloud
 */
export const navigateWithRetry = async (
  page: Page,
  url: string,
  maxRetries = 3
): Promise<boolean> => {
  throw new Error("Browser automation not available in cloud deployment");
};

/**
 * Stub - browser not available in cloud
 */
export const extractWithStealth = async (
  url: string,
  extractFn: (page: Page) => Promise<any>
): Promise<any> => {
  throw new Error("Browser automation not available in cloud deployment");
};

/**
 * Stub - browser not available in cloud
 */
export const takeScreenshot = async (
  page: Page,
  name: string
): Promise<string | null> => {
  return null;
};
export const navigateHumanLike = async (page: any, url: string): Promise<boolean> => {
  throw new Error("Browser automation not available in cloud deployment");
};
