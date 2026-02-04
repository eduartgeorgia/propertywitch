/**
 * Stealth Browser Service
 * 
 * Uses Puppeteer with stealth plugin to bypass bot detection.
 * Maintains persistent sessions with cookies to appear as a returning user.
 */

// @ts-ignore - puppeteer-extra has typing issues
import puppeteerExtra from "puppeteer-extra";
// @ts-ignore
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import path from "node:path";
import fs from "node:fs";

// Apply stealth plugin
const puppeteer = puppeteerExtra.default || puppeteerExtra;
puppeteer.use(StealthPlugin());

const USER_DATA_DIR = path.resolve(process.cwd(), "browser-data");

// Ensure clean browser data directory
const ensureCleanUserDataDir = () => {
  // Remove lock files that prevent browser from starting
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  for (const lockFile of lockFiles) {
    const lockPath = path.join(USER_DATA_DIR, lockFile);
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch (e) {
      // Ignore errors
    }
  }
};

let browserInstance: Browser | null = null;
let browserLock: Promise<Browser> | null = null;

/**
 * Random delay to simulate human behavior
 */
export const humanDelay = (min = 500, max = 2000): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

/**
 * Random mouse movement simulation
 */
export const simulateHumanBehavior = async (page: Page): Promise<void> => {
  // Random scroll
  await page.evaluate(() => {
    const scrollAmount = Math.floor(Math.random() * 300) + 100;
    window.scrollBy(0, scrollAmount);
  });
  
  await humanDelay(200, 500);
  
  // Move mouse randomly
  const viewport = page.viewport();
  if (viewport) {
    const x = Math.floor(Math.random() * viewport.width * 0.8) + 50;
    const y = Math.floor(Math.random() * viewport.height * 0.5) + 50;
    await page.mouse.move(x, y, { steps: 10 });
  }
};

/**
 * Get or create browser instance with proper locking for concurrency
 */
export const getBrowser = async (): Promise<Browser> => {
  // If browser exists and is connected, return it
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  // If another request is already launching the browser, wait for it
  if (browserLock) {
    return browserLock;
  }

  // Create a new browser launch promise
  browserLock = (async () => {
    console.log("[Stealth] Launching browser with stealth mode...");
    
    // Clean up any stale lock files
    ensureCleanUserDataDir();
    
    browserInstance = await puppeteer.launch({
      headless: true, // Run invisibly in background
      userDataDir: USER_DATA_DIR, // Persistent cookies/sessions
      executablePath: process.platform === 'darwin' 
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--window-size=1280,900",
        "--disable-dev-shm-usage",
        "--lang=en-US,en",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
      defaultViewport: { width: 1280, height: 900 }, // Set viewport for headless
    });

    browserLock = null;
    return browserInstance;
  })();

  return browserLock;
};

/**
 * Create a new page with human-like settings
 */
export const createStealthPage = async (browser: Browser): Promise<Page> => {
  const page = await browser.newPage();
  
  // Set realistic viewport
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  // Set realistic user agent
  const userAgents = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ];
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
  await page.setUserAgent(ua);

  // Set extra headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9,pt;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
  });

  // Mask webdriver property
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
    
    // Add plugins
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
        { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
        { name: "Native Client", filename: "internal-nacl-plugin" },
      ],
    });
    
    // Add languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en", "pt"],
    });
  });

  return page;
};

/**
 * Handle cookie consent dialogs
 */
export const handleCookieConsent = async (page: Page): Promise<void> => {
  const consentSelectors = [
    'button[id*="accept"]',
    'button[class*="accept"]',
    '#onetrust-accept-btn-handler',
    '[data-testid="cookie-accept"]',
    'button:has-text("Accept")',
    'button:has-text("Aceitar")',
    'button:has-text("Accept All")',
    '.cookie-consent-accept',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  ];

  for (const selector of consentSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await humanDelay(500, 1000);
        await btn.click();
        console.log("[Stealth] Accepted cookie consent");
        await humanDelay(500, 1000);
        return;
      }
    } catch {
      // Try next selector
    }
  }
};

/**
 * Navigate to URL with human-like behavior
 * Waits for user to solve CAPTCHAs if detected
 */
export const navigateHumanLike = async (page: Page, url: string): Promise<boolean> => {
  try {
    console.log(`[Stealth] Navigating to: ${url}`);
    
    // Random delay before navigation (as if thinking/clicking)
    await humanDelay(300, 800);
    
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });
    
    // Wait for page to settle
    await humanDelay(1000, 2000);
    
    // Handle cookie consent
    await handleCookieConsent(page);
    
    // Simulate human behavior
    await simulateHumanBehavior(page);
    
    // Check for challenges/CAPTCHAs and wait for human to solve
    const challengeResolved = await waitForChallengeResolution(page);
    if (!challengeResolved) {
      console.log("[Stealth] Challenge not resolved, returning false");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("[Stealth] Navigation error:", error);
    return false;
  }
};

/**
 * Detect and wait for human to solve CAPTCHAs/challenges
 * Waits up to 60 seconds for user intervention
 */
export const waitForChallengeResolution = async (page: Page, maxWaitMs = 120000): Promise<boolean> => {
  const startTime = Date.now();
  let challengeNotified = false;
  
  while (Date.now() - startTime < maxWaitMs) {
    const content = await page.content();
    const pageUrl = page.url();
    
    // Check for various challenge indicators (Cloudflare, hCaptcha, reCAPTCHA)
    const hasCaptcha = 
      content.includes("cf-challenge") ||
      content.includes("cf-turnstile") ||
      content.includes("Just a moment") ||
      content.includes("Checking your browser") ||
      content.includes("Verify you are human") ||
      content.includes("hCaptcha") ||
      content.includes("h-captcha") ||
      content.includes("recaptcha") ||
      content.includes("g-recaptcha") ||
      content.includes("challenge-running") ||
      content.includes("ray-id"); // Cloudflare ray ID on challenge pages
    
    if (!hasCaptcha) {
      console.log("[Stealth] Page loaded successfully (no challenge detected)");
      return true;
    }
    
    // First time detecting challenge - notify user
    if (!challengeNotified) {
      challengeNotified = true;
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔒 CAPTCHA/CLOUDFLARE CHALLENGE DETECTED!");
      console.log("👆 LOOK FOR THE CHROME BROWSER WINDOW");
      console.log("✋ Please solve the CAPTCHA manually");
      console.log(`⏱️  Waiting up to ${maxWaitMs / 1000} seconds for you...`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      
      // Try to bring browser to front
      try {
        await page.bringToFront();
      } catch (e) {
        // Ignore if can't bring to front
      }
    }
    
    // Wait and check again
    await humanDelay(2000, 3000);
    
    // Log progress every 10 seconds
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed % 10 === 0 && elapsed > 0) {
      console.log(`[Stealth] Still waiting for challenge... ${elapsed}s elapsed`);
    }
  }
  
  console.log("[Stealth] Timeout waiting for challenge resolution");
  return false;
};

/**
 * Close browser (call on server shutdown)
 */
export const closeBrowser = async (): Promise<void> => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};

// Cleanup on process exit
process.on("SIGINT", closeBrowser);
process.on("SIGTERM", closeBrowser);
