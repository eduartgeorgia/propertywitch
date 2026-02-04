/**
 * Indexer Routes - API endpoints for managing the scheduled indexer
 */

import { Router } from "express";
import {
  startScheduledIndexer,
  stopScheduledIndexer,
  getIndexerStatus,
  triggerIndexing,
} from "../services/scheduledIndexer";

const router = Router();

/**
 * Get indexer status
 */
router.get("/indexer/status", (_req, res) => {
  const status = getIndexerStatus();
  return res.json(status);
});

/**
 * Start the scheduled indexer
 */
router.post("/indexer/start", (_req, res) => {
  startScheduledIndexer();
  const status = getIndexerStatus();
  return res.json({ message: "Indexer started", ...status });
});

/**
 * Stop the scheduled indexer
 */
router.post("/indexer/stop", (_req, res) => {
  stopScheduledIndexer();
  const status = getIndexerStatus();
  return res.json({ message: "Indexer stopped", ...status });
});

/**
 * Manually trigger an indexing run
 */
router.post("/indexer/run", async (_req, res) => {
  try {
    const result = await triggerIndexing();
    const status = getIndexerStatus();
    return res.json({ ...result, ...status });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
});

export default router;
