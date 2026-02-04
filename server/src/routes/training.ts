/**
 * Training API Routes - Train AI on property listings
 */

import { Router } from "express";
import { z } from "zod";
import {
  trainOnOLXListings,
  getTrainingProgress,
  getAvailableCities,
  getAvailableCategories,
} from "../services/trainingService";

const router = Router();

const trainSchema = z.object({
  city: z.string().min(1),
  categories: z.array(z.string()).optional(),
  maxListings: z.number().min(1).max(2000).optional(),
  startOffset: z.number().min(0).optional(), // Continue from a specific offset
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
    const result = await trainOnOLXListings(city, {
      categories,
      maxListings,
      startOffset,
    });
    console.log("[Training API] Training completed:", result);
  } catch (error) {
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
    const result = await trainOnOLXListings(city, {
      categories,
      maxListings,
      startOffset,
    });

    if (result.success) {
      return res.json({
        status: "completed",
        ...result,
      });
    } else {
      return res.status(500).json({
        status: "error",
        ...result,
      });
    }
  } catch (error) {
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
  const progress = getTrainingProgress();

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
  const cities = getAvailableCities();
  return res.json({
    cities,
    count: cities.length,
  });
});

/**
 * Get available categories for training
 */
router.get("/train/categories", (_req, res) => {
  const categories = getAvailableCategories();
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

export default router;
