"use strict";
/**
 * Training API Routes - Train AI on property listings
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const trainingService_1 = require("../services/trainingService");
const router = (0, express_1.Router)();
const trainSchema = zod_1.z.object({
    city: zod_1.z.string().min(1),
    categories: zod_1.z.array(zod_1.z.string()).optional(),
    maxListings: zod_1.z.number().min(1).max(2000).optional(),
    startOffset: zod_1.z.number().min(0).optional(), // Continue from a specific offset
});
/**
 * Start training on OLX listings for a city
 */
router.post("/train/olx", async (req, res) => {
    const parsed = trainSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { city, categories, maxListings, startOffset } = parsed.data;
    // Start training in background
    console.log(`[Training API] Starting training for OLX ${city} (offset: ${startOffset || 0})...`);
    // Return immediately with acknowledgment
    res.json({
        status: "started",
        message: `Training started for OLX listings in ${city}`,
        city,
        categories: categories || ["all"],
        maxListings: maxListings || 1000,
        startOffset: startOffset || 0,
        checkProgress: "/api/train/progress",
    });
    // Run training in background
    try {
        const result = await (0, trainingService_1.trainOnOLXListings)(city, {
            categories,
            maxListings,
            startOffset,
        });
        console.log("[Training API] Training completed:", result);
    }
    catch (error) {
        console.error("[Training API] Training error:", error);
    }
});
/**
 * Start training synchronously (waits for completion)
 */
router.post("/train/olx/sync", async (req, res) => {
    const parsed = trainSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { city, categories, maxListings, startOffset } = parsed.data;
    console.log(`[Training API] Starting sync training for OLX ${city} (offset: ${startOffset || 0})...`);
    try {
        const result = await (0, trainingService_1.trainOnOLXListings)(city, {
            categories,
            maxListings,
            startOffset,
        });
        if (result.success) {
            return res.json({
                status: "completed",
                ...result,
            });
        }
        else {
            return res.status(500).json({
                status: "error",
                ...result,
            });
        }
    }
    catch (error) {
        console.error("[Training API] Training error:", error);
        return res.status(500).json({
            status: "error",
            error: String(error),
        });
    }
});
/**
 * Get training progress
 */
router.get("/train/progress", (_req, res) => {
    const progress = (0, trainingService_1.getTrainingProgress)();
    if (!progress) {
        return res.json({
            status: "idle",
            message: "No training in progress",
        });
    }
    return res.json(progress);
});
/**
 * Get available cities for training
 */
router.get("/train/cities", (_req, res) => {
    const cities = (0, trainingService_1.getAvailableCities)();
    return res.json({
        cities,
        count: cities.length,
    });
});
/**
 * Get available categories for training
 */
router.get("/train/categories", (_req, res) => {
    const categories = (0, trainingService_1.getAvailableCategories)();
    return res.json({
        categories,
        descriptions: {
            all: "All property types",
            land: "Land and plots (Terrenos)",
            apartments: "Apartments (Apartamentos)",
            houses: "Houses and villas (Moradias)",
            rooms: "Rooms for rent (Quartos)",
            commercial: "Commercial properties (Lojas)",
        },
    });
});
exports.default = router;
