/**
 * RAG API Routes - Manage RAG system
 */

import { Router } from "express";
import {
  initializeRAG,
  getRAGStats,
  clearRAGData,
  retrieveKnowledge,
  getAllKnowledge,
  getCategories,
  searchListingsByCriteria,
  parseSearchQuery,
  type ListingSearchCriteria,
} from "../services/rag/index";
import { getRAGSystemStats } from "../services/aiService";

const router = Router();

/**
 * Get RAG system status and statistics
 */
router.get("/rag/status", async (_req, res) => {
  try {
    const stats = getRAGSystemStats();
    const categories = getCategories();
    
    return res.json({
      status: "ok",
      stats,
      knowledgeCategories: categories,
    });
  } catch (error) {
    console.error("RAG status error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Initialize/reinitialize RAG system
 */
router.post("/rag/initialize", async (_req, res) => {
  try {
    await initializeRAG();
    const stats = getRAGStats();
    
    return res.json({
      status: "ok",
      message: "RAG system initialized",
      stats,
    });
  } catch (error) {
    console.error("RAG initialization error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Test RAG retrieval with a query
 */
router.post("/rag/query", async (req, res) => {
  const { query, topK = 3 } = req.body;
  
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query is required" });
  }
  
  try {
    const results = await retrieveKnowledge(query, topK);
    
    return res.json({
      query,
      results: results.map(r => ({
        id: r.document.id,
        title: r.document.metadata.title,
        content: r.document.content.slice(0, 500) + "...",
        category: r.document.metadata.category,
        score: r.score.toFixed(3),
      })),
    });
  } catch (error) {
    console.error("RAG query error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Get all knowledge base entries
 */
router.get("/rag/knowledge", (_req, res) => {
  try {
    const knowledge = getAllKnowledge();
    
    return res.json({
      count: knowledge.length,
      categories: getCategories(),
      entries: knowledge.map(doc => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        tags: doc.tags,
        contentPreview: doc.content.slice(0, 200) + "...",
      })),
    });
  } catch (error) {
    console.error("RAG knowledge error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Get specific knowledge entry by ID
 */
router.get("/rag/knowledge/:id", (req, res) => {
  try {
    const { id } = req.params;
    const knowledge = getAllKnowledge();
    const entry = knowledge.find(doc => doc.id === id);
    
    if (!entry) {
      return res.status(404).json({ error: "Knowledge entry not found" });
    }
    
    return res.json(entry);
  } catch (error) {
    console.error("RAG knowledge error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Clear RAG data (for testing)
 */
router.delete("/rag/clear", async (req, res) => {
  const { collection } = req.query;
  
  try {
    clearRAGData(collection as string | undefined);
    
    return res.json({
      status: "ok",
      message: collection ? `Cleared collection: ${collection}` : "Cleared all RAG data",
    });
  } catch (error) {
    console.error("RAG clear error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Search indexed listings with natural language query or specific criteria
 */
router.post("/rag/listings/search", async (req, res) => {
  const { query, criteria, limit = 10 } = req.body;
  
  if (!query && !criteria) {
    return res.status(400).json({ error: "Either query or criteria is required" });
  }
  
  try {
    // Parse query to extract criteria if query provided
    const parsedCriteria: ListingSearchCriteria = criteria || parseSearchQuery(query || "");
    
    // Log the parsed criteria for debugging
    console.log("[RAG Search] Query:", query);
    console.log("[RAG Search] Criteria:", JSON.stringify(parsedCriteria));
    
    // Search with filters
    const results = searchListingsByCriteria(parsedCriteria, limit);
    
    // Format results
    const formattedResults = results.map(({ listing, score }) => ({
      id: listing.id,
      title: listing.metadata.title,
      price: listing.metadata.priceEur,
      priceFormatted: listing.metadata.priceEur 
        ? `€${(listing.metadata.priceEur as number).toLocaleString()}` 
        : "Price unknown",
      city: listing.metadata.city,
      beds: listing.metadata.beds,
      baths: listing.metadata.baths,
      areaSqm: listing.metadata.areaSqm,
      sourceUrl: listing.metadata.sourceUrl,
      sourceSite: listing.metadata.sourceSite,
      photo: listing.metadata.photo,
      matchScore: score,
    }));
    
    return res.json({
      query,
      parsedCriteria,
      count: results.length,
      results: formattedResults,
    });
  } catch (error) {
    console.error("RAG listing search error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Get all indexed listings (paginated)
 */
router.get("/rag/listings", async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);
  
  try {
    // Get all listings with empty criteria
    const allResults = searchListingsByCriteria({}, 10000);
    
    // Paginate
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    const pageResults = allResults.slice(start, end);
    
    return res.json({
      total: allResults.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(allResults.length / limitNum),
      results: pageResults.map(({ listing }) => ({
        id: listing.id,
        title: listing.metadata.title,
        price: listing.metadata.priceEur,
        city: listing.metadata.city,
        beds: listing.metadata.beds,
        areaSqm: listing.metadata.areaSqm,
        sourceUrl: listing.metadata.sourceUrl,
      })),
    });
  } catch (error) {
    console.error("RAG listings error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

export default router;
