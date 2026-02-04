import fs from "node:fs/promises";
import path from "node:path";
import { APP_CONFIG } from "../config";
import { slugify } from "../utils/slug";
import { getBrowser, createStealthPage, humanDelay, closeBrowser } from "./stealthBrowser";

// Extended listing type with AI analysis for reports
export type ReportListing = {
  id: string;
  title: string;
  priceEur: number;
  displayPrice: string;
  locationLabel: string;
  beds?: number;
  baths?: number;
  areaSqm?: number;
  image?: string;
  sourceSite: string;
  sourceUrl: string;
  aiReasoning?: string;
  matchScore?: number;
  listingType?: 'sale' | 'rent';
  propertyType?: string;
};

const ensureReportsDir = async () => {
  await fs.mkdir(APP_CONFIG.reportsDir, { recursive: true });
};

export const buildPdfFilename = (title: string, index: number): string => {
  const safeTitle = slugify(title).slice(0, 50);
  const timestamp = Date.now();
  return `property-${index + 1}-${safeTitle}-${timestamp}.pdf`;
};

// Generate PDF directly from a listing page URL using Puppeteer
export async function generateListingPagePdf(
  url: string, 
  title: string, 
  index: number
): Promise<{ filename: string; pdfBuffer: Buffer }> {
  const browser = await getBrowser();
  const page = await createStealthPage(browser);
  
  try {
    console.log(`[Report] Generating PDF for: ${title}`);
    console.log(`[Report] URL: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 45000 
    });
    
    await humanDelay(2000, 3000);
    
    // Handle cookie consent popups
    const cookieSelectors = [
      '#onetrust-accept-btn-handler',
      'button[aria-label*="Accept"]',
      '.cookie-accept',
      '[data-testid="cookie-accept"]',
      '.accept-cookies',
      '#acceptCookies',
      '#CybotCookiebotDialogBodyButtonAccept',
      '.cookie-consent-accept',
      '[class*="cookie"] button[class*="accept"]'
    ];
    
    for (const sel of cookieSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          await humanDelay(500, 1000);
          console.log(`[Report] Clicked cookie consent: ${sel}`);
          break;
        }
      } catch (e) {}
    }
    
    // Scroll down to load lazy images
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 300));
      }
      // Scroll back to top
      window.scrollTo(0, 0);
    });
    
    await humanDelay(1000, 1500);
    
    // Generate PDF of the page
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      preferCSSPageSize: false,
    });
    
    const filename = buildPdfFilename(title, index);
    
    console.log(`[Report] Generated PDF: ${filename} (${pdfBuffer.length} bytes)`);
    
    return { 
      filename, 
      pdfBuffer: Buffer.from(pdfBuffer) 
    };
    
  } catch (error) {
    console.error(`[Report] Failed to generate PDF for ${url}:`, error);
    throw error;
  } finally {
    try { 
      await page.close(); 
    } catch (e) {}
  }
}

// Generate PDFs for multiple listings
export async function generateMultipleListingPdfs(
  listings: ReportListing[]
): Promise<{ filename: string; pdfBuffer: Buffer }[]> {
  await ensureReportsDir();
  
  const results: { filename: string; pdfBuffer: Buffer }[] = [];
  
  try {
    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];
      console.log(`[Report] Processing ${i + 1}/${listings.length}: ${listing.title}`);
      
      try {
        const result = await generateListingPagePdf(
          listing.sourceUrl, 
          listing.title, 
          i
        );
        results.push(result);
      } catch (error) {
        console.error(`[Report] Skipping listing due to error:`, error);
        // Continue with other listings
      }
    }
  } finally {
    // Close browser after all PDFs are generated
    console.log(`[Report] Closing browser...`);
    await closeBrowser();
  }
  
  return results;
}

// Save PDF to disk and return the filename
export async function savePdfToDisk(
  filename: string, 
  pdfBuffer: Buffer
): Promise<string> {
  await ensureReportsDir();
  const filePath = path.join(APP_CONFIG.reportsDir, filename);
  await fs.writeFile(filePath, pdfBuffer);
  console.log(`[Report] Saved: ${filePath}`);
  return filename;
}
