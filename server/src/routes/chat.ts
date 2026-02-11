import { Router } from "express";
import { z } from "zod";
import {
  chatWithAI,
  checkAIHealth,
  parseQueryWithAI,
  generateResultsResponse,
  ParsedSearchIntent,
  detectIntent,
  AIMessage,
  getAvailableBackends,
  setActiveBackend,
  getCurrentBackendInfo,
  AIBackend,
  pickBestListings,
} from "../services/aiService";
import { runSearch } from "../services/searchService";
import { runAgent, shouldUseAgent } from "../services/agentService";
import type { UserLocation } from "../types/api";
import {
  getThread,
  addMessage,
  getConversationHistory,
  getLastSearchContext as getThreadSearchContext,
  storeSearchResults,
  getLastSearchResults,
  getPreviousSearchResults,
} from "../services/threadService";
import {
  analyzeImage,
  analyzeListingPhotos,
  extractImageFeatureQuery,
  generateFeatureSummary,
  getVisionServiceStatus,
} from "../services/visionService";
import { checkAnonymousSearchLimit, getClientIP, checkUserSearchLimit } from "./auth";

const router = Router();

/**
 * Generate clickable suggestions to refine search results
 */
function generateRefinementSuggestions(
  intent: ParsedSearchIntent,
  listingsCount: number,
  matchType: "exact" | "near-miss"
): string[] {
  const suggestions: string[] = [];
  const { propertyType, priceMax, priceMin, location } = intent;

  if (listingsCount === 0) {
    // No results - suggest expanding search
    if (priceMax) {
      suggestions.push(`Increase budget to €${Math.round(priceMax * 1.5).toLocaleString()}`);
    }
    if (location) {
      suggestions.push(`Search all of Portugal instead of ${location}`);
    }
    suggestions.push("Show me any available properties");
  } else if (listingsCount < 5) {
    // Few results - suggest expanding
    if (priceMax) {
      suggestions.push(`Show options up to €${Math.round(priceMax * 1.25).toLocaleString()}`);
    }
    if (location) {
      suggestions.push(`Expand search area around ${location}`);
    }
  } else {
    // Good results - suggest filtering
    if (!propertyType) {
      suggestions.push("Only show land/plots");
      suggestions.push("Only show houses");
    }
    if (priceMax && priceMax > 50000) {
      suggestions.push(`Show cheaper options under €${Math.round(priceMax * 0.7).toLocaleString()}`);
    }
    if (matchType === "near-miss") {
      suggestions.push("Only show exact matches");
    }
  }

  // Always add some useful options
  if (listingsCount > 0) {
    suggestions.push("Sort by price (lowest first)");
    suggestions.push("Show on map");
  }

  return suggestions.slice(0, 4); // Max 4 suggestions
}

// Generate a simple conversation ID based on timestamp
function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  threadId: z.string().optional(), // New: thread ID for persistent memory
  userLocation: z.object({
    label: z.string().min(2),
    lat: z.number(),
    lng: z.number(),
    currency: z.string().min(3),
  }),
  mode: z.enum(["search", "chat", "auto"]).optional().default("auto"),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
  lastSearchContext: z.string().optional(),
});

/**
 * AI-powered chat endpoint
 * - Detects user intent (search vs conversation)
 * - Maintains conversation context
 * - Parses natural language queries with AI (or regex fallback)
 * - Performs searches based on parsed intent
 * - Returns conversational responses
 */
router.post("/chat", async (req, res) => {
  const requestStart = Date.now();
  const timings: Record<string, number> = {};
  
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { message, mode, threadId } = parsed.data;
  let { conversationHistory, lastSearchContext } = parsed.data;
  const userLocation = parsed.data.userLocation as UserLocation;
  
  // Check for auth token and validate search limits
  const authHeader = req.headers.authorization;
  const hasAuthToken = authHeader?.startsWith("Bearer ");
  
  if (hasAuthToken) {
    // Authenticated user - check their subscription limits
    const token = authHeader!.substring(7);
    const userLimitCheck = checkUserSearchLimit(token);
    
    if (!userLimitCheck.valid) {
      console.log(`[Chat] Invalid token`);
      // Fall through to anonymous check
    } else if (!userLimitCheck.allowed) {
      console.log(`[Chat] User search limit reached for plan: ${userLimitCheck.plan}`);
      return res.status(429).json({
        type: "limit_reached",
        message: userLimitCheck.message,
        remaining: userLimitCheck.remaining,
        total: userLimitCheck.total,
        plan: userLimitCheck.plan,
        aiAvailable: true,
      });
    } else {
      // User is authenticated and has searches remaining
      const remaining = userLimitCheck.remaining === -1 ? 'unlimited' : userLimitCheck.remaining;
      console.log(`[Chat] Authenticated user (${userLimitCheck.plan}) - ${remaining} searches remaining`);
    }
  } else {
    // Anonymous user - check IP-based limits
    const fingerprint = (req.body as any).fingerprint;
    const limitCheck = checkAnonymousSearchLimit(req, fingerprint);
    
    if (!limitCheck.allowed) {
      console.log(`[Chat] Anonymous search limit reached for IP: ${getClientIP(req).substring(0, 8)}...`);
      return res.status(429).json({
        type: "limit_reached",
        message: limitCheck.message,
        remaining: limitCheck.remaining,
        total: limitCheck.total,
        aiAvailable: true,
      });
    }
    
    console.log(`[Chat] Anonymous search ${limitCheck.total - limitCheck.remaining}/${limitCheck.total} for IP: ${getClientIP(req).substring(0, 8)}...`);
  }
  
  // Use provided conversation ID or generate a new one
  const conversationId = parsed.data.conversationId || generateConversationId();

  // If threadId is provided, use thread-based memory
  if (threadId) {
    const thread = getThread(threadId);
    if (thread) {
      // Override with thread's conversation history (last 20 messages)
      conversationHistory = getConversationHistory(threadId, 20);
      // Override with thread's last search context
      lastSearchContext = getThreadSearchContext(threadId) || lastSearchContext;
      console.log(`[Chat] Using thread ${threadId} with ${conversationHistory.length} messages`);
    }
    
    // Store the user message in the thread
    addMessage(threadId, "user", message);
  }

  try {
    // Check AI health
    let t0 = Date.now();
    const health = await checkAIHealth();
    timings.healthCheck = Date.now() - t0;
    
    // Convert conversation history to AIMessage format
    const aiHistory: AIMessage[] = conversationHistory.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Determine intent - either use specified mode or auto-detect
    let shouldSearch = mode === "search";
    let intentType: "search" | "conversation" | "follow_up" | "refine_search" | "show_listings" | "pick_from_results" = "search";
    let confirmationContext: string | undefined;
    
    // Variables to store AI-extracted filters
    let extractedFilters: {
      location?: string;
      propertyType?: string;
      priceMin?: number;
      priceMax?: number;
      areaMin?: number;
      areaMax?: number;
      bedrooms?: number;
      keywords?: string[];
    } | undefined;
    let selectionCriteria: string | undefined;
    
    if (mode === "auto") {
      t0 = Date.now();
      const hasRecentResults = !!lastSearchContext;
      const intent = await detectIntent(message, aiHistory, hasRecentResults);
      timings.intentDetection = Date.now() - t0;
      intentType = intent.intent;
      confirmationContext = intent.confirmationContext;
      extractedFilters = intent.extractedFilters;
      selectionCriteria = intent.selectionCriteria;
      
      console.log(`[Chat] AI Intent: ${intentType} (${intent.confidence}) - ${intent.reason}`);
      if (extractedFilters) {
        console.log(`[Chat] Extracted filters:`, extractedFilters);
      }
      
      // Trigger search for: search, refine_search, OR show_listings intents (but NOT pick_from_results - handled separately)
      shouldSearch = (intent.isPropertySearch || intent.intent === "search" || intent.intent === "refine_search" || intent.intent === "show_listings") && intent.intent !== "pick_from_results";
    } else if (mode === "chat") {
      shouldSearch = false;
      intentType = "conversation";
    }

    // Handle "pick X from results" intent - select from stored listings
    if (intentType === "pick_from_results" && threadId) {
      const storedListings = getLastSearchResults(threadId);
      if (storedListings && storedListings.length > 0) {
        t0 = Date.now();
        // Pass both the user message and AI-extracted selection criteria
        const filterCriteria = selectionCriteria || message;
        const { selectedListings, explanation } = await pickBestListings(filterCriteria, storedListings);
        timings.pickListings = Date.now() - t0;
        
        if (selectedListings.length > 0) {
          const aiSummary = explanation;
          
          // Store response in thread
          if (threadId) {
            addMessage(threadId, "assistant", aiSummary, "search", lastSearchContext || undefined);
          }
          
          timings.total = Date.now() - requestStart;
          console.log(`[Chat] Picked ${selectedListings.length} listings. Timings:`, timings);
          
          return res.json({
            type: "search",
            intentDetected: "pick_from_results",
            message: aiSummary,
            searchResult: {
              listings: selectedListings,
              totalCount: selectedListings.length,
              matchType: "exact",
              appliedPriceRange: {},
            },
            searchContext: lastSearchContext,
            threadId,
            aiAvailable: health.available,
            aiBackend: health.backend,
            _timings: timings,
          });
        }
      }
      // If no stored listings, fall through to regular search
      console.log("[Chat] No stored listings for pick_from_results, falling back to search");
    }

    // Handle "previous results" / "go back" intent - return the last search before current
    const previousResultsPatterns = /\b(previous|last|before|go\s*back|back\s*to|earlier|prior)\s*(search|results?|listings?|properties?)|\b(show|get|bring)\s*(back|up)\s*(the\s*)?(previous|last|earlier)\b/i;
    if (previousResultsPatterns.test(message) && threadId) {
      const { listings: previousListings, context: previousContext } = getPreviousSearchResults(threadId);
      
      if (previousListings && previousListings.length > 0) {
        const aiSummary = `📋 Here are your **previous search results** (${previousListings.length} listings):\n\n${previousContext ? `_Original search: ${previousContext.match(/User searched for: "([^"]+)"/)?.[1] || 'your previous query'}_` : ''}`;
        
        // Store response in thread
        if (threadId) {
          addMessage(threadId, "assistant", aiSummary, "search", previousContext || undefined);
        }
        
        timings.total = Date.now() - requestStart;
        console.log(`[Chat] Returned ${previousListings.length} previous listings. Timings:`, timings);
        
        return res.json({
          type: "search",
          intentDetected: "previous_results",
          message: aiSummary,
          searchResult: {
            listings: previousListings,
            totalCount: previousListings.length,
            matchType: "exact",
            appliedPriceRange: {},
          },
          searchContext: previousContext,
          threadId,
          aiAvailable: health.available,
          aiBackend: health.backend,
          _timings: timings,
        });
      } else {
        // No previous results available
        const noResultsMsg = "I don't have any previous search results saved. Each conversation only remembers one search back. Try a new search!";
        
        if (threadId) {
          addMessage(threadId, "assistant", noResultsMsg, "chat");
        }
        
        timings.total = Date.now() - requestStart;
        return res.json({
          type: "chat",
          intentDetected: "previous_results",
          message: noResultsMsg,
          threadId,
          aiAvailable: health.available,
          aiBackend: health.backend,
          _timings: timings,
        });
      }
    }

    // Handle conversation/follow-up (non-search) intent
    if (!shouldSearch) {
      t0 = Date.now();
      const response = await chatWithAI(message, aiHistory, lastSearchContext, conversationId);
      timings.chatAI = Date.now() - t0;
      timings.total = Date.now() - requestStart;
      console.log(`[Chat] Timings:`, timings);
      
      // Store assistant response in thread
      if (threadId) {
        addMessage(threadId, "assistant", response, "chat");
      }
      
      return res.json({
        type: "chat",
        intentDetected: intentType,
        message: response,
        conversationId,
        threadId,
        aiAvailable: health.available,
        aiBackend: health.backend,
        _timings: timings,
      });
    }

    // Check if this is a complex query that should use the agent
    const useAgent = shouldUseAgent(message);
    
    if (useAgent && health.available) {
      console.log("[Chat] Using agent for complex query:", message);
      t0 = Date.now();
      const agentResult = await runAgent(message, userLocation, 5);
      timings.agent = Date.now() - t0;
      timings.total = Date.now() - requestStart;
      console.log(`[Chat] Timings:`, timings);
      
      const searchContext = `Agent processed: "${message}". Tools used: ${agentResult.toolsUsed.join(', ')}. ${agentResult.reasoning}`;
      
      // Store agent response in thread
      if (threadId) {
        addMessage(threadId, "assistant", agentResult.finalAnswer, "agent", searchContext);
      }
      
      return res.json({
        type: "agent",
        intentDetected: "agent",
        message: agentResult.finalAnswer,
        reasoning: agentResult.reasoning,
        toolsUsed: agentResult.toolsUsed,
        stepsCount: agentResult.steps.length,
        searchResult: agentResult.searchResults,
        searchContext,
        threadId,
        aiAvailable: health.available,
        aiBackend: health.backend,
        _timings: timings,
      });
    }

    // Simple search mode - parse query and perform search
    let searchQuery = message;
    
    // Check if this is a confirmation response (yes, sure, etc.)
    const isConfirmation = /^(yes|yeah|yep|yup|sure|please|ok|okay|go ahead|do it|definitely|absolutely|of course|please do|yes please)\.?$/i.test(message.trim());
    
    // For show_listings or refine_search intents, extract the original query from context
    if ((intentType === "show_listings" || intentType === "refine_search") && lastSearchContext) {
      // Extract original query from context like: 'User searched for: "gaia porto properties".'
      const originalQueryMatch = lastSearchContext.match(/User searched for: "([^"]+)"/);
      if (originalQueryMatch) {
        const originalQuery = originalQueryMatch[1];
        
        if (isConfirmation && confirmationContext) {
          // User confirmed a refinement suggestion - extract what they were asked
          // e.g., "Would you like me to try searching again with a focus on central locations?"
          const centralMatch = confirmationContext.match(/focus on (central|center|downtown|city cent[re])/i);
          const cheaperMatch = confirmationContext.match(/cheaper|lower price|less expensive/i);
          const largerMatch = confirmationContext.match(/larger|bigger|more space/i);
          
          if (centralMatch) {
            searchQuery = `${originalQuery} central city center downtown`;
            console.log(`[Chat] Confirmation: User confirmed central location search for "${searchQuery}"`);
          } else if (cheaperMatch) {
            searchQuery = `${originalQuery} cheaper`;
            console.log(`[Chat] Confirmation: User confirmed cheaper search for "${searchQuery}"`);
          } else if (largerMatch) {
            searchQuery = `${originalQuery} larger`;
            console.log(`[Chat] Confirmation: User confirmed larger search for "${searchQuery}"`);
          } else {
            // Generic refinement - just re-run the original query
            searchQuery = originalQuery;
            console.log(`[Chat] Confirmation: Re-running original search for "${searchQuery}"`);
          }
        } else if (intentType === "show_listings" || isConfirmation) {
          // For "show me the best ones" or plain confirmation, use the original query
          searchQuery = originalQuery;
          console.log(`[Chat] show_listings: Re-running search for "${searchQuery}"`);
        } else {
          // For refinements like "cheaper", combine with original (but not "yes")
          searchQuery = `${originalQuery} ${message}`;
          console.log(`[Chat] refine_search: Combined query "${searchQuery}"`);
        }
      }
    }
    
    t0 = Date.now();
    const aiResponse = await parseQueryWithAI(searchQuery);
    timings.parseQuery = Date.now() - t0;

    // Perform search
    t0 = Date.now();
    const searchResult = await runSearch({
      query: searchQuery,
      userLocation,
    });
    timings.search = Date.now() - t0;

    // Generate response about results
    const locations = [...new Set(searchResult.listings.map((l) => l.locationLabel))];
    
    // Customize response based on intent type
    t0 = Date.now();
    let aiSummary: string;
    if (intentType === "show_listings") {
      aiSummary = await generateResultsResponse(
        `showing listings from previous search`,
        searchResult.matchType,
        searchResult.listings.length,
        searchResult.appliedPriceRange,
        locations
      );
    } else {
      aiSummary = await generateResultsResponse(
        message,
        searchResult.matchType,
        searchResult.listings.length,
        searchResult.appliedPriceRange,
        locations
      );
    }
    timings.generateSummary = Date.now() - t0;

    // Generate refinement suggestions based on results
    const suggestions = generateRefinementSuggestions(
      aiResponse.parsedIntent,
      searchResult.listings.length,
      searchResult.matchType
    );

    // Build search context for future conversation
    const searchContext = `User searched for: "${searchQuery}". Found ${searchResult.listings.length} listings (${searchResult.matchType} match). ` +
      `Price range: €${searchResult.appliedPriceRange.min ?? 0} - €${searchResult.appliedPriceRange.max ?? 'any'}. ` +
      `Locations: ${locations.slice(0, 5).join(", ") || "Various Portugal"}.`;

    // Store search results in thread for future "pick X" queries AND "previous results" feature
    if (threadId && searchResult.listings.length > 0) {
      storeSearchResults(threadId, searchResult.listings, searchContext);
    }

    // Store search response in thread
    if (threadId) {
      addMessage(threadId, "assistant", aiSummary, "search", searchContext);
    }

    timings.total = Date.now() - requestStart;
    console.log(`[Chat] Timings:`, timings);

    return res.json({
      type: "search",
      intentDetected: intentType,
      message: aiSummary,
      parsedIntent: aiResponse.parsedIntent,
      searchResult,
      suggestions,
      searchContext,
      threadId,
      aiAvailable: health.available,
      aiBackend: health.backend,
      _timings: timings,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Health check for AI service
 */
router.get("/ai/health", async (_req, res) => {
  const health = await checkAIHealth();
  const currentInfo = getCurrentBackendInfo();
  
  return res.json({
    available: health.available,
    backend: health.backend,
    model: currentInfo.model,
    ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
    localAiUrl: process.env.LOCAL_AI_URL ?? "http://localhost:8080",
  });
});

/**
 * Get all available AI backends
 */
router.get("/ai/backends", async (_req, res) => {
  try {
    const backends = await getAvailableBackends();
    const currentInfo = getCurrentBackendInfo();
    
    return res.json({
      backends,
      current: {
        backend: currentInfo.backend,
        model: currentInfo.model,
      },
    });
  } catch (error) {
    console.error("Error fetching backends:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Switch AI backend
 */
const switchBackendSchema = z.object({
  backend: z.enum(["ollama", "groq", "claude", "local"]),
  model: z.string().optional(),
});

router.post("/ai/switch", async (req, res) => {
  try {
    const body = switchBackendSchema.parse(req.body);
    const result = await setActiveBackend(body.backend as AIBackend, body.model);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    const currentInfo = getCurrentBackendInfo();
    return res.json({
      success: true,
      message: result.message,
      current: {
        backend: currentInfo.backend,
        model: currentInfo.model,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Error switching backend:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Vision AI - Get service status
 */
router.get("/vision/status", async (_req, res) => {
  const status = getVisionServiceStatus();
  return res.json(status);
});

/**
 * Vision AI - Analyze a single image URL
 */
const analyzeImageSchema = z.object({
  imageUrl: z.string().url(),
});

router.post("/vision/analyze-image", async (req, res) => {
  try {
    const body = analyzeImageSchema.parse(req.body);
    const result = await analyzeImage(body.imageUrl);
    
    if (!result) {
      return res.status(500).json({ error: "Failed to analyze image" });
    }
    
    return res.json({
      success: true,
      analysis: result,
      summary: generateFeatureSummary(result.features),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Error analyzing image:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Vision AI - Analyze multiple photos for a listing
 */
const analyzeListingSchema = z.object({
  listingId: z.string(),
  photoUrls: z.array(z.string().url()),
  maxPhotos: z.number().min(1).max(5).optional(),
});

router.post("/vision/analyze-listing", async (req, res) => {
  try {
    const body = analyzeListingSchema.parse(req.body);
    const result = await analyzeListingPhotos(
      body.listingId,
      body.photoUrls,
      body.maxPhotos || 3
    );
    
    if (!result) {
      return res.status(500).json({ error: "Failed to analyze listing photos" });
    }
    
    return res.json({
      success: true,
      analysis: result,
      featureSummary: generateFeatureSummary(result.combinedFeatures),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Error analyzing listing:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Vision AI - Extract image feature keywords from a query
 */
const extractFeaturesSchema = z.object({
  query: z.string(),
});

router.post("/vision/extract-features", async (req, res) => {
  try {
    const body = extractFeaturesSchema.parse(req.body);
    const features = extractImageFeatureQuery(body.query);
    
    return res.json({
      query: body.query,
      detectedFeatures: features,
      count: features.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Error extracting features:", error);
    return res.status(500).json({ error: String(error) });
  }
});

export default router;
