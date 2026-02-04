import { Router } from "express";
import { z } from "zod";
import { runSearch } from "../services/searchService";

const router = Router();

const searchSchema = z.object({
  query: z.string().optional(),
  userLocation: z.object({
    label: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    currency: z.string().optional(),
  }).optional(),
});

router.post("/search", async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const response = await runSearch(parsed.data);
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

export default router;
