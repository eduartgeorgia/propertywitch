import { Router } from "express";
import { z } from "zod";
import { getSearch } from "../storage/searchStore";
import { 
  generateMultipleListingPdfs, 
  savePdfToDisk, 
  ReportListing 
} from "../services/reportService";

const router = Router();

// Schema for the PDF generation endpoint
const generatePdfsSchema = z.object({
  listings: z.array(z.object({
    id: z.string(),
    title: z.string(),
    priceEur: z.number(),
    displayPrice: z.string(),
    locationLabel: z.string(),
    beds: z.number().optional(),
    baths: z.number().optional(),
    areaSqm: z.number().optional(),
    image: z.string().optional(),
    sourceSite: z.string(),
    sourceUrl: z.string(),
    aiReasoning: z.string().optional(),
    matchScore: z.number().optional(),
    listingType: z.enum(['sale', 'rent']).optional(),
    propertyType: z.string().optional(),
  })).min(1),
});

// Generate PDFs for listings (downloads each listing page as PDF)
router.post("/generate", async (req, res) => {
  const parsed = generatePdfsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const listings = parsed.data.listings as ReportListing[];
    console.log(`[Report] Generating PDFs for ${listings.length} listings`);
    
    // Generate PDFs for all listings
    const pdfResults = await generateMultipleListingPdfs(listings);
    
    if (pdfResults.length === 0) {
      return res.status(500).json({ error: "Failed to generate any PDFs" });
    }
    
    // Save all PDFs to disk and return their URLs
    const savedFiles: { filename: string; url: string }[] = [];
    
    for (const { filename, pdfBuffer } of pdfResults) {
      await savePdfToDisk(filename, pdfBuffer);
      savedFiles.push({
        filename,
        url: `/reports/${filename}`,
      });
    }
    
    console.log(`[Report] Successfully generated ${savedFiles.length} PDFs`);
    
    return res.json({
      success: true,
      count: savedFiles.length,
      files: savedFiles,
    });
  } catch (error) {
    console.error("[Report] Generation failed:", error);
    return res.status(500).json({ error: String(error) });
  }
});

export default router;
