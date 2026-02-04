"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const aiService_1 = require("../services/aiService");
const searchService_1 = require("../services/searchService");
const agentService_1 = require("../services/agentService");
const router = (0, express_1.Router)();
/**
 * Generate clickable suggestions to refine search results
 */
function generateRefinementSuggestions(intent, listingsCount, matchType) {
    const suggestions = [];
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
    }
    else if (listingsCount < 5) {
        // Few results - suggest expanding
        if (priceMax) {
            suggestions.push(`Show options up to €${Math.round(priceMax * 1.25).toLocaleString()}`);
        }
        if (location) {
            suggestions.push(`Expand search area around ${location}`);
        }
    }
    else {
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
function generateConversationId() {
    return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
const chatSchema = zod_1.z.object({
    message: zod_1.z.string().min(1),
    conversationId: zod_1.z.string().optional(),
    userLocation: zod_1.z.object({
        label: zod_1.z.string().min(2),
        lat: zod_1.z.number(),
        lng: zod_1.z.number(),
        currency: zod_1.z.string().min(3),
    }),
    mode: zod_1.z.enum(["search", "chat", "auto"]).optional().default("auto"),
    conversationHistory: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.enum(["user", "assistant"]),
        content: zod_1.z.string(),
    })).optional().default([]),
    lastSearchContext: zod_1.z.string().optional(),
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
    const timings = {};
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { message, mode, conversationHistory, lastSearchContext } = parsed.data;
    const userLocation = parsed.data.userLocation;
    // Use provided conversation ID or generate a new one
    const conversationId = parsed.data.conversationId || generateConversationId();
    try {
        // Check AI health
        let t0 = Date.now();
        const health = await (0, aiService_1.checkAIHealth)();
        timings.healthCheck = Date.now() - t0;
        // Convert conversation history to AIMessage format
        const aiHistory = conversationHistory.map(m => ({
            role: m.role,
            content: m.content,
        }));
        // Determine intent - either use specified mode or auto-detect
        let shouldSearch = mode === "search";
        let intentType = "search";
        if (mode === "auto") {
            t0 = Date.now();
            const hasRecentResults = !!lastSearchContext;
            const intent = await (0, aiService_1.detectIntent)(message, aiHistory, hasRecentResults);
            timings.intentDetection = Date.now() - t0;
            intentType = intent.intent;
            // Trigger search for: search, refine_search, OR show_listings intents
            shouldSearch = intent.isPropertySearch || intent.intent === "search" || intent.intent === "refine_search" || intent.intent === "show_listings";
        }
        else if (mode === "chat") {
            shouldSearch = false;
            intentType = "conversation";
        }
        // Handle conversation/follow-up (non-search) intent
        if (!shouldSearch) {
            t0 = Date.now();
            const response = await (0, aiService_1.chatWithAI)(message, aiHistory, lastSearchContext, conversationId);
            timings.chatAI = Date.now() - t0;
            timings.total = Date.now() - requestStart;
            console.log(`[Chat] Timings:`, timings);
            return res.json({
                type: "chat",
                intentDetected: intentType,
                message: response,
                conversationId,
                aiAvailable: health.available,
                aiBackend: health.backend,
                _timings: timings,
            });
        }
        // Check if this is a complex query that should use the agent
        const useAgent = (0, agentService_1.shouldUseAgent)(message);
        if (useAgent && health.available) {
            console.log("[Chat] Using agent for complex query:", message);
            t0 = Date.now();
            const agentResult = await (0, agentService_1.runAgent)(message, userLocation, 5);
            timings.agent = Date.now() - t0;
            timings.total = Date.now() - requestStart;
            console.log(`[Chat] Timings:`, timings);
            return res.json({
                type: "agent",
                intentDetected: "agent",
                message: agentResult.finalAnswer,
                reasoning: agentResult.reasoning,
                toolsUsed: agentResult.toolsUsed,
                stepsCount: agentResult.steps.length,
                searchResult: agentResult.searchResults,
                searchContext: `Agent processed: "${message}". Tools used: ${agentResult.toolsUsed.join(', ')}. ${agentResult.reasoning}`,
                aiAvailable: health.available,
                aiBackend: health.backend,
                _timings: timings,
            });
        }
        // Simple search mode - parse query and perform search
        let searchQuery = message;
        // For show_listings or refine_search intents, extract the original query from context
        if ((intentType === "show_listings" || intentType === "refine_search") && lastSearchContext) {
            // Extract original query from context like: 'User searched for: "gaia porto properties".'
            const originalQueryMatch = lastSearchContext.match(/User searched for: "([^"]+)"/);
            if (originalQueryMatch) {
                const originalQuery = originalQueryMatch[1];
                // Combine original query with refinement
                if (intentType === "show_listings") {
                    // For "show me the best ones", use the original query
                    searchQuery = originalQuery;
                    console.log(`[Chat] show_listings: Re-running search for "${searchQuery}"`);
                }
                else {
                    // For refinements like "cheaper", combine with original
                    searchQuery = `${originalQuery} ${message}`;
                    console.log(`[Chat] refine_search: Combined query "${searchQuery}"`);
                }
            }
        }
        t0 = Date.now();
        const aiResponse = await (0, aiService_1.parseQueryWithAI)(searchQuery);
        timings.parseQuery = Date.now() - t0;
        // Perform search
        t0 = Date.now();
        const searchResult = await (0, searchService_1.runSearch)({
            query: searchQuery,
            userLocation,
        });
        timings.search = Date.now() - t0;
        // Generate response about results
        const locations = [...new Set(searchResult.listings.map((l) => l.locationLabel))];
        // Customize response based on intent type
        t0 = Date.now();
        let aiSummary;
        if (intentType === "show_listings") {
            aiSummary = await (0, aiService_1.generateResultsResponse)(`showing listings from previous search`, searchResult.matchType, searchResult.listings.length, searchResult.appliedPriceRange, locations);
        }
        else {
            aiSummary = await (0, aiService_1.generateResultsResponse)(message, searchResult.matchType, searchResult.listings.length, searchResult.appliedPriceRange, locations);
        }
        timings.generateSummary = Date.now() - t0;
        // Generate refinement suggestions based on results
        const suggestions = generateRefinementSuggestions(aiResponse.parsedIntent, searchResult.listings.length, searchResult.matchType);
        // Build search context for future conversation
        const searchContext = `User searched for: "${searchQuery}". Found ${searchResult.listings.length} listings (${searchResult.matchType} match). ` +
            `Price range: €${searchResult.appliedPriceRange.min ?? 0} - €${searchResult.appliedPriceRange.max ?? 'any'}. ` +
            `Locations: ${locations.slice(0, 5).join(", ") || "Various Portugal"}.`;
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
            aiAvailable: health.available,
            aiBackend: health.backend,
            _timings: timings,
        });
    }
    catch (error) {
        console.error("Chat error:", error);
        return res.status(500).json({ error: String(error) });
    }
});
/**
 * Health check for AI service
 */
router.get("/ai/health", async (_req, res) => {
    const health = await (0, aiService_1.checkAIHealth)();
    const currentInfo = (0, aiService_1.getCurrentBackendInfo)();
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
        const backends = await (0, aiService_1.getAvailableBackends)();
        const currentInfo = (0, aiService_1.getCurrentBackendInfo)();
        return res.json({
            backends,
            current: {
                backend: currentInfo.backend,
                model: currentInfo.model,
            },
        });
    }
    catch (error) {
        console.error("Error fetching backends:", error);
        return res.status(500).json({ error: String(error) });
    }
});
/**
 * Switch AI backend
 */
const switchBackendSchema = zod_1.z.object({
    backend: zod_1.z.enum(["ollama", "groq", "claude", "local"]),
    model: zod_1.z.string().optional(),
});
router.post("/ai/switch", async (req, res) => {
    try {
        const body = switchBackendSchema.parse(req.body);
        const result = await (0, aiService_1.setActiveBackend)(body.backend, body.model);
        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }
        const currentInfo = (0, aiService_1.getCurrentBackendInfo)();
        return res.json({
            success: true,
            message: result.message,
            current: {
                backend: currentInfo.backend,
                model: currentInfo.model,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        console.error("Error switching backend:", error);
        return res.status(500).json({ error: String(error) });
    }
});
exports.default = router;
