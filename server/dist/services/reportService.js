"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPdfFilename = void 0;
exports.generateListingPagePdf = generateListingPagePdf;
exports.generateMultipleListingPdfs = generateMultipleListingPdfs;
exports.savePdfToDisk = savePdfToDisk;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("../config");
const slug_1 = require("../utils/slug");
const ensureReportsDir = async () => {
    await promises_1.default.mkdir(config_1.APP_CONFIG.reportsDir, { recursive: true });
};
const buildPdfFilename = (title, index) => {
    const safeTitle = (0, slug_1.slugify)(title).slice(0, 50);
    const timestamp = Date.now();
    return `property-${index + 1}-${safeTitle}-${timestamp}.pdf`;
};
exports.buildPdfFilename = buildPdfFilename;
// Generate PDF directly from a listing page URL using Puppeteer
// DISABLED for cloud deployment - browser not available
async function generateListingPagePdf(url, title, index) {
    throw new Error("PDF generation is not available in cloud deployment. Browser scraping is disabled.");
    /*
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
    */
}
// Stub for closeBrowser
const closeBrowser = async () => { };
// Generate PDFs for multiple listings
// DISABLED for cloud deployment
async function generateMultipleListingPdfs(listings) {
    throw new Error("PDF generation is not available in cloud deployment.");
    /*
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
    */
}
// Save PDF to disk and return the filename
async function savePdfToDisk(filename, pdfBuffer) {
    await ensureReportsDir();
    const filePath = node_path_1.default.join(config_1.APP_CONFIG.reportsDir, filename);
    await promises_1.default.writeFile(filePath, pdfBuffer);
    console.log(`[Report] Saved: ${filePath}`);
    return filename;
}
