import { Router } from "express";
import { z } from "zod";
import { runSearch } from "../services/searchService";
import type { SearchRequest, UserLocation } from "../types/api";

const router = Router();

const searchSchema = z.object({
  query: z.string().min(3),
  userLocation: z.object({
    label: z.string().min(2),
    lat: z.number(),
    lng: z.number(),
    currency: z.string().min(3),
  }),
});

router.post("/search", async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const request: SearchRequest = {
      query: parsed.data.query,
      userLocation: parsed.data.userLocation as UserLocation,
    };
    const response = await runSearch(request);
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

export default router;
