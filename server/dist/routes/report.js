"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const reportService_1 = require("../services/reportService");
const router = (0, express_1.Router)();
// Schema for the PDF generation endpoint
const generatePdfsSchema = zod_1.z.object({
    listings: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        title: zod_1.z.string(),
        priceEur: zod_1.z.number(),
        displayPrice: zod_1.z.string(),
        locationLabel: zod_1.z.string(),
        beds: zod_1.z.number().optional(),
        baths: zod_1.z.number().optional(),
        areaSqm: zod_1.z.number().optional(),
        image: zod_1.z.string().optional(),
        sourceSite: zod_1.z.string(),
        sourceUrl: zod_1.z.string(),
        aiReasoning: zod_1.z.string().optional(),
        matchScore: zod_1.z.number().optional(),
        listingType: zod_1.z.enum(['sale', 'rent']).optional(),
        propertyType: zod_1.z.string().optional(),
    })).min(1),
});
// Generate PDFs for listings (downloads each listing page as PDF)
router.post("/generate", async (req, res) => {
    const parsed = generatePdfsSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const listings = parsed.data.listings;
        console.log(`[Report] Generating PDFs for ${listings.length} listings`);
        // Generate PDFs for all listings
        const pdfResults = await (0, reportService_1.generateMultipleListingPdfs)(listings);
        if (pdfResults.length === 0) {
            return res.status(500).json({ error: "Failed to generate any PDFs" });
        }
        // Save all PDFs to disk and return their URLs
        const savedFiles = [];
        for (const { filename, pdfBuffer } of pdfResults) {
            await (0, reportService_1.savePdfToDisk)(filename, pdfBuffer);
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
    }
    catch (error) {
        console.error("[Report] Generation failed:", error);
        return res.status(500).json({ error: String(error) });
    }
});
exports.default = router;
