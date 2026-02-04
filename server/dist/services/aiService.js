"use strict";
/**
 * AI Service - Multi-backend AI support for property search
 * Supports: Groq (cloud), Ollama with Llama3.3-Thinking-Claude (local), Claude API (optional)
 * Local-first architecture with cloud fallback
 * Now with RAG (Retrieval-Augmented Generation) support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexListings = exports.getRAGSystemStats = exports.getRelevantListings = exports.filterListingsByRelevance = exports.chatWithAI = exports.detectIntent = exports.generateResultsResponse = exports.parseQueryWithAI = exports.checkAIHealth = exports.getCurrentBackendInfo = exports.setActiveBackend = exports.getAvailableBackends = exports.detectBackend = void 0;
const index_1 = require("./rag/index");
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const LOCAL_AI_URL = process.env.LOCAL_AI_URL ?? "http://localhost:8080";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.3-thinking-claude";
// Initialize RAG on module load
let ragInitialized = false;
const ensureRAGInitialized = async () => {
    if (!ragInitialized) {
        await (0, index_1.initializeRAG)();
        ragInitialized = true;
    }
};
let activeBackend = "none";
let activeOllamaModel = process.env.OLLAMA_MODEL ?? "llama3.3-thinking-claude";
let backendChecked = false;
const PROPERTY_SYSTEM_PROMPT = `You are an AI property search assistant for Portugal. Parse the user's query and extract search parameters.

IMPORTANT RULES:
- ALWAYS set clarificationNeeded to false - never ask for clarification
- Extract as much info as possible, use sensible defaults for missing info
- For "under X" queries, set priceMax to X
- For "around X" queries, set priceTarget to X
- Always extract the numeric price value

Respond with ONLY valid JSON in this format:
{
  "parsedIntent": {
    "propertyType": "land|apartment|house|villa|commercial|null",
    "priceMin": null,
    "priceMax": 50000,
    "priceTarget": null,
    "priceIntent": "under|over|between|exact|around|none",
    "currency": "EUR",
    "location": "Lisbon",
    "rawQuery": "original query"
  },
  "clarificationNeeded": false,
  "responseMessage": "Searching for land near Lisbon under €50,000..."
}`;
const CONVERSATIONAL_SYSTEM_PROMPT = `You are a magical AI Property Witch for Portugal. You help users find properties, understand the real estate market, and answer questions about buying, renting, and investing in Portugal.

IMPORTANT RULES:
- Be conversational and helpful
- Remember context from the conversation
- If the user asks a follow-up question about previous results, answer based on context
- If the user is making small talk, respond naturally
- Only suggest searching when the user clearly wants to find new properties
- Keep responses concise but helpful (2-4 sentences usually)
- If asked about specific listings from previous results, discuss them
- Be knowledgeable about Portuguese real estate, regions, costs, and processes
- USE THE PROVIDED KNOWLEDGE CONTEXT to give accurate, factual answers
- If the knowledge context contains relevant information, incorporate it into your response
- Cite specific details like tax rates, visa requirements, etc. from the provided context`;
const RAG_ENHANCED_SYSTEM_PROMPT = `You are a magical AI Property Witch for Portugal with deep knowledge about Portuguese real estate.

You have access to a knowledge base about:
- Buying process and legal requirements (NIF, lawyers, notaries)
- Taxes (IMT, Stamp Duty, IMI, NHR regime)
- Regions of Portugal (Algarve, Lisbon, Porto, Alentejo, Silver Coast)
- Property types (land, ruins, villas, apartments)
- Visas and residency (Golden Visa, D7 visa)
- Financing and mortgages
- Rental income and regulations

IMPORTANT RULES:
- Use the KNOWLEDGE CONTEXT provided to answer accurately
- Cite specific figures, percentages, and requirements from the context
- If information isn't in the context, say you're not certain
- Be helpful and conversational
- Keep responses focused and informative`;
const INTENT_DETECTION_PROMPT = `Analyze this message in the context of the conversation and determine the user's intent.

Respond with ONLY valid JSON:
{
  "intent": "search" | "conversation" | "follow_up" | "refine_search",
  "reason": "brief explanation",
  "isPropertySearch": true/false
}

Intent types:
- "search": User wants to search for NEW properties (mentions specific criteria like price, location, property type)
- "conversation": General chat, questions about Portugal, real estate advice, greetings, etc.
- "follow_up": User is asking about or referring to previous search results
- "refine_search": User wants to adjust the previous search (cheaper, different area, etc.)`;
/**
 * Check which AI backend is available
 * Priority: Groq (cloud - fast) > Ollama (local) > Claude (cloud) > Local LLaMA
 */
const detectBackend = async () => {
    // Check Groq first (cloud - fast & primary)
    if (GROQ_API_KEY && GROQ_API_KEY.startsWith("gsk_")) {
        console.log("AI Backend: Groq API (cloud) - PRIMARY");
        activeBackend = "groq";
        return "groq";
    }
    // Check Ollama second (local fallback)
    try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`, {
            method: "GET",
            signal: AbortSignal.timeout(2000),
        });
        if (ollamaRes.ok) {
            const data = await ollamaRes.json();
            if (data.models && data.models.length > 0) {
                const modelNames = data.models.map((m) => m.name);
                console.log("AI Backend: Ollama (local) - FALLBACK, models:", modelNames);
                const hasThinkingClaude = modelNames.some((n) => n.includes('thinking-claude') || n.includes('llama3.3'));
                if (hasThinkingClaude) {
                    console.log("  → Using Llama3.3-Thinking-Claude (high-reasoning model)");
                }
                activeBackend = "ollama";
                return "ollama";
            }
        }
    }
    catch {
        // Ollama not available
    }
    // Check local LLaMA server last
    try {
        const localRes = await fetch(`${LOCAL_AI_URL}/tools`, {
            method: "GET",
            signal: AbortSignal.timeout(2000),
        });
        if (localRes.ok) {
            console.log("AI Backend: Local LLaMA server at", LOCAL_AI_URL, "- FALLBACK");
            activeBackend = "local";
            return "local";
        }
    }
    catch {
        // Local AI not available
    }
    console.log("AI Backend: None (using regex fallback)");
    activeBackend = "none";
    return "none";
};
exports.detectBackend = detectBackend;
/**
 * Get all available AI backends with their status
 */
const getAvailableBackends = async () => {
    const backends = [];
    // Check Ollama
    try {
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`, {
            method: "GET",
            signal: AbortSignal.timeout(2000),
        });
        if (ollamaRes.ok) {
            const data = await ollamaRes.json();
            const models = data.models?.map((m) => m.name) || [];
            backends.push({
                id: "ollama",
                name: "Ollama (Local)",
                available: models.length > 0,
                models,
                isCloud: false,
            });
        }
        else {
            backends.push({ id: "ollama", name: "Ollama (Local)", available: false, isCloud: false });
        }
    }
    catch {
        backends.push({ id: "ollama", name: "Ollama (Local)", available: false, isCloud: false });
    }
    // Check Groq
    backends.push({
        id: "groq",
        name: "Groq Cloud",
        available: !!(GROQ_API_KEY && GROQ_API_KEY.startsWith("gsk_")),
        models: GROQ_API_KEY ? [GROQ_MODEL] : undefined,
        isCloud: true,
    });
    // Check Claude
    backends.push({
        id: "claude",
        name: "Claude (Anthropic)",
        available: !!(ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.startsWith("sk-ant-")),
        models: ANTHROPIC_API_KEY ? [CLAUDE_MODEL] : undefined,
        isCloud: true,
    });
    // Check Local AI
    try {
        const localRes = await fetch(`${LOCAL_AI_URL}/tools`, {
            method: "GET",
            signal: AbortSignal.timeout(2000),
        });
        backends.push({
            id: "local",
            name: "Local LLaMA",
            available: localRes.ok,
            isCloud: false,
        });
    }
    catch {
        backends.push({ id: "local", name: "Local LLaMA", available: false, isCloud: false });
    }
    return backends;
};
exports.getAvailableBackends = getAvailableBackends;
/**
 * Manually set the active AI backend
 */
const setActiveBackend = async (backend, model) => {
    const backends = await (0, exports.getAvailableBackends)();
    const target = backends.find((b) => b.id === backend);
    if (!target) {
        return { success: false, message: `Unknown backend: ${backend}` };
    }
    if (!target.available) {
        return { success: false, message: `Backend ${backend} is not available` };
    }
    // For Ollama, validate the model if specified
    if (backend === "ollama" && model) {
        if (!target.models?.includes(model)) {
            // Try with :latest suffix
            const modelWithLatest = model.includes(":") ? model : `${model}:latest`;
            if (!target.models?.some((m) => m === modelWithLatest || m.startsWith(model))) {
                return {
                    success: false,
                    message: `Model ${model} not found. Available: ${target.models?.join(", ")}`,
                };
            }
        }
        activeOllamaModel = model;
    }
    activeBackend = backend;
    backendChecked = true;
    console.log(`AI Backend manually switched to: ${backend}${model ? ` (model: ${model})` : ""}`);
    return {
        success: true,
        message: `Switched to ${target.name}${model ? ` with model ${model}` : ""}`,
    };
};
exports.setActiveBackend = setActiveBackend;
/**
 * Get current backend info
 */
const getCurrentBackendInfo = () => {
    let model = "unknown";
    if (activeBackend === "ollama") {
        model = activeOllamaModel;
    }
    else if (activeBackend === "groq") {
        model = GROQ_MODEL;
    }
    else if (activeBackend === "claude") {
        model = CLAUDE_MODEL;
    }
    else if (activeBackend === "local") {
        model = "local-llm";
    }
    return { backend: activeBackend, model };
};
exports.getCurrentBackendInfo = getCurrentBackendInfo;
/**
 * Check if AI is available
 */
const checkAIHealth = async () => {
    if (!backendChecked) {
        await (0, exports.detectBackend)();
        backendChecked = true;
    }
    return {
        available: activeBackend !== "none",
        backend: activeBackend,
    };
};
exports.checkAIHealth = checkAIHealth;
/**
 * Call Groq API (fast inference) with retry logic
 */
async function callGroq(prompt, system, conversationHistory) {
    const messages = [
        { role: "system", content: system || "You are a helpful assistant." },
    ];
    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory.map(m => ({ role: m.role, content: m.content })));
    }
    // Add current prompt as user message
    messages.push({ role: "user", content: prompt });
    // Retry logic for transient network errors
    const maxRetries = 3;
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages,
                    temperature: 0.7,
                    max_tokens: 1024,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Groq API error: ${response.status} - ${error}`);
            }
            const data = await response.json();
            return data.choices?.[0]?.message?.content || "";
        }
        catch (error) {
            lastError = error;
            const isRetryable = lastError.name === 'AbortError' ||
                lastError.message.includes('network') ||
                lastError.message.includes('ECONNREFUSED') ||
                lastError.message.includes('ETIMEDOUT') ||
                (lastError.message.includes('Groq API error: 5') && attempt < maxRetries - 1); // 5xx errors
            if (!isRetryable || attempt === maxRetries - 1) {
                throw lastError;
            }
            console.log(`Groq API attempt ${attempt + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
    }
    throw lastError || new Error('Groq API call failed after retries');
}
/**
 * Call Groq with Ollama fallback for rate limits/errors
 */
async function callGroqWithFallback(prompt, system, conversationHistory) {
    try {
        return await callGroq(prompt, system, conversationHistory);
    }
    catch (error) {
        const errorMsg = error.message;
        // Check for rate limit errors (429), quota exceeded, or other recoverable errors
        if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('limit') || errorMsg.includes('quota') || errorMsg.includes('500') || errorMsg.includes('503')) {
            console.log("[AI] Groq error, trying Ollama fallback...");
            return await tryFallbackChain(prompt, system, conversationHistory, error);
        }
        throw error;
    }
}
/**
 * Try fallback AI providers in order: Ollama (local) -> Claude (cloud)
 */
async function tryFallbackChain(prompt, system, conversationHistory, originalError) {
    // Try Ollama (local Llama3.3-Thinking-Claude) as primary fallback
    console.log("[AI] Trying Ollama (Llama3.3-Thinking-Claude) as fallback...");
    try {
        return await callOllama(prompt, system, conversationHistory);
    }
    catch (ollamaError) {
        console.log("[AI] Ollama fallback failed:", ollamaError.message.substring(0, 100));
    }
    // Try Claude as final fallback if available
    if (ANTHROPIC_API_KEY) {
        console.log("[AI] Trying Claude API as final fallback...");
        try {
            return await callClaude(prompt, system, conversationHistory);
        }
        catch (claudeError) {
            console.log("[AI] Claude failed:", claudeError.message.substring(0, 100));
        }
    }
    throw originalError || new Error("All AI providers failed");
}
/**
 * Call AI with automatic fallback - unified function for all backends
 * Priority: Groq (cloud - fast) -> Ollama (local) -> Claude (cloud)
 */
async function callAIWithFallback(prompt, system, conversationHistory) {
    const health = await (0, exports.checkAIHealth)();
    const tryProvider = async (provider) => {
        switch (provider) {
            case "groq":
                return await callGroq(prompt, system, conversationHistory);
            case "claude":
                return await callClaude(prompt, system, conversationHistory);
            case "ollama":
                return await callOllama(prompt, system, conversationHistory);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    };
    // Priority order: Groq first (fast), then Ollama (local)
    const providers = ["groq", "ollama"];
    // If user manually switched backend, use that first but still allow fallback
    if (health.backend && health.backend !== "local" && health.backend !== "none") {
        const startIdx = providers.indexOf(health.backend);
        if (startIdx > 0) {
            providers.splice(startIdx, 1);
            providers.unshift(health.backend);
        }
    }
    let lastError = null;
    for (const provider of providers) {
        try {
            console.log(`[AI] Trying ${provider}...`);
            return await tryProvider(provider);
        }
        catch (error) {
            const errMsg = error.message;
            console.log(`[AI] ${provider} failed: ${errMsg.substring(0, 100)}`);
            lastError = error;
            // If it's a rate limit error, definitely try next provider
            if (errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('Rate limit')) {
                console.log(`[AI] Rate limit hit on ${provider}, trying fallback...`);
            }
            // Continue to next provider
        }
    }
    throw lastError || new Error("All AI providers failed");
}
/**
 * Call Claude API (Anthropic)
 */
async function callClaude(prompt, system, conversationHistory) {
    const messages = [];
    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory.map(m => ({ role: m.role, content: m.content })));
    }
    // Add current prompt as user message
    messages.push({ role: "user", content: prompt });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 1024,
            system: system || "You are a helpful assistant.",
            messages,
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
    }
    const data = await response.json();
    return data.content?.[0]?.text || "";
}
/**
 * Call Ollama API
 */
async function callOllama(prompt, system, conversationHistory) {
    // Build context from conversation history
    let contextualPrompt = prompt;
    if (conversationHistory && conversationHistory.length > 0) {
        const historyText = conversationHistory
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');
        contextualPrompt = `Previous conversation:\n${historyText}\n\nUser: ${prompt}`;
    }
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: activeOllamaModel,
            prompt: contextualPrompt,
            system,
            stream: false,
        }),
    });
    if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
    }
    const data = await response.json();
    return data.response || "";
}
/**
 * Call local LLaMA server
 */
async function callLocalAI(message) {
    const response = await fetch(`${LOCAL_AI_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    });
    if (!response.ok) {
        throw new Error(`Local AI error: ${response.status}`);
    }
    // Parse SSE stream
    const reader = response.body?.getReader();
    if (!reader)
        return "";
    const decoder = new TextDecoder();
    let result = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.token) {
                            result += data.token;
                        }
                    }
                    catch {
                        // Not JSON
                    }
                }
            }
        }
    }
    finally {
        reader.releaseLock();
    }
    return result;
}
/**
 * Parse a user query using AI
 */
const parseQueryWithAI = async (query) => {
    const health = await (0, exports.checkAIHealth)();
    if (!health.available) {
        return fallbackParse(query);
    }
    try {
        const response = await callAIWithFallback(`Parse this property search query and respond with JSON only:\n\n"${query}"`, PROPERTY_SYSTEM_PROMPT);
        return extractJSONFromResponse(response, query);
    }
    catch (error) {
        console.error("AI parsing failed:", error);
        return fallbackParse(query);
    }
};
exports.parseQueryWithAI = parseQueryWithAI;
/**
 * Generate a conversational response about search results
 */
const generateResultsResponse = async (query, matchType, listingsCount, priceRange, locations) => {
    const health = await (0, exports.checkAIHealth)();
    // Generate simple response if no AI
    if (!health.available) {
        return matchType === "exact"
            ? `Found ${listingsCount} listings matching your search.`
            : `No exact matches at that price. Found ${listingsCount} alternatives within the acceptable range and 50km radius.`;
    }
    try {
        const prompt = `User searched for: "${query}"
Results: ${listingsCount} listings (${matchType} match)
Price range: ${priceRange.min ?? "any"} - ${priceRange.max ?? "any"} EUR
Locations: ${locations.join(", ") || "Various Portugal"}

Write a brief, helpful response (2-3 sentences) about these results. Be conversational.`;
        const response = await callAIWithFallback(prompt, "You are a helpful property search assistant. Keep responses brief and friendly.");
        return cleanResponse(response);
    }
    catch (error) {
        console.error("AI response failed:", error);
        return matchType === "exact"
            ? `Found ${listingsCount} listings matching your search.`
            : `No exact matches at that price. Found ${listingsCount} alternatives within the acceptable range.`;
    }
};
exports.generateResultsResponse = generateResultsResponse;
const detectIntent = async (message, conversationHistory, hasRecentResults) => {
    const health = await (0, exports.checkAIHealth)();
    const lower = message.toLowerCase();
    // Quick regex-based detection for obvious cases
    const searchIndicators = [
        /(?:find|show|search|looking for|want|need)\s+(?:me\s+)?(?:a\s+)?(?:land|house|apartment|villa|property|properties|flat)/i,
        /(?:under|below|around|about)\s+[\d€$£]+/i,
        /(?:in|near|around)\s+[A-Z][a-z]+.*(?:for|under|around)/i,
        /^(?:land|house|apartment|properties?)\s+(?:in|near|under|for)/i,
    ];
    const conversationIndicators = [
        /^(?:hi|hello|hey|thanks|thank you|ok|okay|great|nice|good|how|what|why|when|who|where|can you|could you|tell me|explain)/i,
        /\?$/,
        /(?:about|advice|recommend|suggest|help me understand|what do you think)/i,
    ];
    // Patterns that indicate user wants to SEE/DISPLAY listings (not just chat about them)
    const showListingsPatterns = [
        /(?:show|display|list|see|view)\s+(?:me\s+)?(?:the|those|these|all|some)?\s*(?:listing|listings|properties|options|results)/i,
        /(?:show|give|display)\s+(?:me\s+)?(?:the|those|these)?\s*(?:best|top|cheapest|most expensive)/i,
        /(?:best|top|cheapest)\s+(?:one|ones|listing|listings|properties|options)/i,
        /(?:for sale|to buy|available)/i,
        /^show\s+(?:me\s+)?(?:them|those|these|the\s+listings?)/i,
    ];
    // Check for obvious search intent
    for (const pattern of searchIndicators) {
        if (pattern.test(message)) {
            return { intent: "search", isPropertySearch: true };
        }
    }
    // Check if user wants to see/display listings (triggers re-search with context)
    if (hasRecentResults) {
        for (const pattern of showListingsPatterns) {
            if (pattern.test(message)) {
                // This should trigger a re-search/show the listings, not just chat
                return { intent: "show_listings", isPropertySearch: true };
            }
        }
    }
    // Check for follow-up/refinement on recent results
    if (hasRecentResults) {
        const followUpPatterns = [
            /(?:cheaper|more expensive|different|another|other)\s+(?:one|ones|option|options|listing|listings)?/i,
            /(?:first|second|third|last)\s+(?:one|listing|property)/i,
            /^(?:and|also|what about|how about)/i,
        ];
        for (const pattern of followUpPatterns) {
            if (pattern.test(message)) {
                // "cheaper" or "more expensive" should refine search; others are follow-up questions
                if (lower.includes("cheaper") || lower.includes("expensive") || lower.includes("different") || lower.includes("another")) {
                    return { intent: "refine_search", isPropertySearch: true };
                }
                return { intent: "follow_up", isPropertySearch: false };
            }
        }
    }
    // Check for conversation indicators
    for (const pattern of conversationIndicators) {
        if (pattern.test(message) && !searchIndicators.some(p => p.test(message))) {
            return { intent: "conversation", isPropertySearch: false };
        }
    }
    // Use AI for ambiguous cases
    if (health.available) {
        try {
            const contextInfo = conversationHistory && conversationHistory.length > 0
                ? `\nRecent conversation:\n${conversationHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}\n`
                : '';
            const prompt = `${contextInfo}\nUser message: "${message}"\n\nDetermine the intent.`;
            const response = await callAIWithFallback(prompt, INTENT_DETECTION_PROMPT);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    intent: parsed.intent || "search",
                    isPropertySearch: parsed.isPropertySearch ?? true,
                };
            }
        }
        catch (error) {
            console.error("Intent detection failed:", error);
        }
    }
    // Default to search if we can't determine
    return { intent: "search", isPropertySearch: true };
};
exports.detectIntent = detectIntent;
/**
 * Chat with AI for general questions (with conversation history and RAG)
 */
const chatWithAI = async (message, conversationHistory, searchContext, conversationId) => {
    const health = await (0, exports.checkAIHealth)();
    if (!health.available) {
        return "AI is currently unavailable. Please try your search - I can still find listings using the search system.";
    }
    // Ensure RAG is initialized
    await ensureRAGInitialized();
    // Build RAG context for knowledge-enhanced responses
    const ragContext = await (0, index_1.buildRAGContext)(message, {
        includeKnowledge: true,
        includeListings: false,
        includeConversations: !!conversationId,
        conversationId,
        maxTokens: 1500,
    });
    // Build context-aware prompt with RAG
    let contextualPrompt = message;
    const contextParts = [];
    if (ragContext) {
        contextParts.push(`KNOWLEDGE CONTEXT:\n${ragContext}`);
    }
    if (searchContext) {
        contextParts.push(`RECENT SEARCH RESULTS:\n${searchContext}`);
    }
    if (contextParts.length > 0) {
        contextualPrompt = `${contextParts.join("\n\n")}\n\nUSER QUESTION: ${message}`;
    }
    try {
        const response = await callAIWithFallback(contextualPrompt, RAG_ENHANCED_SYSTEM_PROMPT, conversationHistory);
        // Store conversation for future RAG retrieval
        if (conversationId) {
            try {
                await (0, index_1.storeConversation)(conversationId, message, response, searchContext);
            }
            catch (err) {
                console.error("[RAG] Failed to store conversation:", err);
            }
        }
        return response;
    }
    catch (error) {
        console.error("AI chat failed:", error);
        return "I'm having trouble connecting to the AI. Please try again.";
    }
};
exports.chatWithAI = chatWithAI;
// Helper: Extract JSON from AI response
function extractJSONFromResponse(text, originalQuery) {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*"parsedIntent"[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                parsedIntent: {
                    ...parsed.parsedIntent,
                    rawQuery: originalQuery,
                },
                clarificationNeeded: parsed.clarificationNeeded ?? false,
                clarificationQuestion: parsed.clarificationQuestion,
                responseMessage: parsed.responseMessage ?? "Let me search for that...",
            };
        }
        catch {
            // JSON parse failed
        }
    }
    return fallbackParse(originalQuery);
}
// Helper: Regex-based fallback parser
function fallbackParse(query) {
    const lower = query.toLowerCase();
    // Property type
    let propertyType;
    if (/(land|plot|terrain|lote|terreno)/.test(lower))
        propertyType = "land";
    else if (/(apartment|apartamento|apt|flat)/.test(lower))
        propertyType = "apartment";
    else if (/(house|villa|casa|moradia|home)/.test(lower))
        propertyType = "house";
    // Price parsing
    let priceTarget;
    let priceMin;
    let priceMax;
    let priceIntent = "none";
    const betweenMatch = lower.match(/between\s+([\d.,]+)\s*(?:k|thousand|mil)?\s*(?:and|to|-)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
    const underMatch = lower.match(/(?:under|below|max|up to|less than|<)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
    const overMatch = lower.match(/(?:over|above|min|at least|more than|>)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
    const forMatch = lower.match(/(?:for|at|around|about|~)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
    const plainMatch = query.match(/([\d.,]+)\s*(?:k|thousand|mil)?/i);
    const parseNumber = (str, suffix) => {
        let num = parseFloat(str.replace(/[,]/g, ""));
        const hasK = suffix?.toLowerCase().includes("k") || suffix?.toLowerCase().includes("thousand");
        const hasMil = suffix?.toLowerCase().includes("mil");
        if (hasK)
            num *= 1000;
        if (hasMil)
            num *= 1000000;
        return num;
    };
    if (betweenMatch) {
        priceMin = parseNumber(betweenMatch[1]);
        priceMax = parseNumber(betweenMatch[2]);
        priceIntent = "between";
    }
    else if (underMatch) {
        priceMax = parseNumber(underMatch[1]);
        priceIntent = "under";
    }
    else if (overMatch) {
        priceMin = parseNumber(overMatch[1]);
        priceIntent = "over";
    }
    else if (forMatch) {
        priceTarget = parseNumber(forMatch[1]);
        priceIntent = "around";
    }
    else if (plainMatch) {
        priceTarget = parseNumber(plainMatch[1]);
        priceIntent = "around";
    }
    // Currency
    let currency;
    if (lower.includes("usd") || lower.includes("$") || lower.includes("dollar"))
        currency = "USD";
    else if (lower.includes("eur") || lower.includes("€") || lower.includes("euro"))
        currency = "EUR";
    else if (lower.includes("gbp") || lower.includes("£") || lower.includes("pound"))
        currency = "GBP";
    // Location
    let location;
    const locationPatterns = [
        /(?:in|near|around|at|close to)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i,
    ];
    for (const pattern of locationPatterns) {
        const match = query.match(pattern);
        if (match && !["portugal", "pt"].includes(match[1].toLowerCase())) {
            location = match[1];
            break;
        }
    }
    // Build response message
    let responseMessage = "Searching for ";
    if (propertyType)
        responseMessage += `${propertyType} `;
    else
        responseMessage += "properties ";
    if (location)
        responseMessage += `near ${location} `;
    if (priceTarget)
        responseMessage += `around ${currency === "USD" ? "$" : "€"}${priceTarget.toLocaleString()}`;
    else if (priceMax)
        responseMessage += `under ${currency === "USD" ? "$" : "€"}${priceMax.toLocaleString()}`;
    else if (priceMin)
        responseMessage += `over ${currency === "USD" ? "$" : "€"}${priceMin.toLocaleString()}`;
    responseMessage += "...";
    return {
        parsedIntent: {
            propertyType,
            priceMin,
            priceMax,
            priceTarget,
            priceIntent,
            currency,
            location,
            rawQuery: query,
        },
        clarificationNeeded: false,
        responseMessage,
    };
}
// Helper: Clean AI response
function cleanResponse(text) {
    return text
        .replace(/```json[\s\S]*?```/g, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\{[\s\S]*?\}/g, "")
        .trim()
        .slice(0, 500); // Limit length
}
const LISTING_ANALYSIS_PROMPT = `You are an expert real estate analyst helping users find exactly what they're looking for in Portugal.

CRITICAL: First, understand EXACTLY what the user wants:
- Parse their query to identify: property type, specific features, location preferences, intended use
- "land for farming" = agricultural/rural land with good soil, water access
- "building plot" = urban land with construction permits
- "land with sea view" = coastal property with ocean visibility
- "vineyard" = agricultural land suitable for wine production
- "investment property" = something with rental/resale potential

For EACH listing, analyze:
1. TITLE: What does the Portuguese title tell us? (terreno=land, rústico=rural, urbano=urban, quinta=farm estate)
2. DESCRIPTION: Read the full description carefully. Look for keywords about:
   - Land type (agrícola=agricultural, construção=building, rústico=rustic)
   - Features (água=water, eletricidade=electricity, estrada=road access, vista=view)
   - Permits (licença=license, projeto=project approved)
   - Condition (para recuperar=needs work, pronto=ready)
3. SIZE & PRICE: Does the area make sense for the user's purpose?
4. LOCATION: Is it in the right region for what they want?

SCORING GUIDE:
- 90-100: Perfect match - exactly what user asked for
- 70-89: Good match - mostly fits with minor differences
- 50-69: Partial match - could work but not ideal
- Below 50: Not relevant - mark as isRelevant: false

BE STRICT: If user wants "land" don't show houses. If they want "farming land" don't show building plots.

Respond with ONLY a valid JSON array:
[
  {
    "id": "listing-id",
    "isRelevant": true/false,
    "relevanceScore": 0-100,
    "reasoning": "2-3 sentence explanation in English of why this listing matches or doesn't match the user's specific needs"
  }
]`;
// Configuration for AI analysis behavior
const AI_ANALYSIS_CONFIG = {
    // Skip AI analysis if more than this many listings (use local analysis instead)
    maxListingsForAI: 20,
    // Timeout for AI analysis in milliseconds (increased for Ollama fallback)
    analysisTimeoutMs: 60000,
    // Enable/disable AI listing analysis (set to false for faster searches)
    enableAIAnalysis: true,
};
const filterListingsByRelevance = async (userQuery, listings, options) => {
    const skipAI = options?.skipAI ?? !AI_ANALYSIS_CONFIG.enableAIAnalysis;
    const timeout = options?.timeout ?? AI_ANALYSIS_CONFIG.analysisTimeoutMs;
    // Fast path: skip AI analysis entirely if disabled or too many listings
    if (skipAI || listings.length > AI_ANALYSIS_CONFIG.maxListingsForAI) {
        console.log(`[AI Analysis] Using fast local analysis (skipAI=${skipAI}, listings=${listings.length})`);
        return analyzeListingsLocally(userQuery, listings);
    }
    const health = await (0, exports.checkAIHealth)();
    // If no AI available, return all as relevant with neutral score
    if (!health.available || listings.length === 0) {
        return listings.map(l => ({
            id: l.id,
            isRelevant: true,
            relevanceScore: 50,
            reasoning: "AI unavailable - showing all results",
        }));
    }
    // Build listing summaries for analysis
    const listingSummaries = listings.map((l, idx) => {
        const photoInfo = l.photos.length > 0
            ? `Photos: ${l.photos.length} image(s)`
            : 'No photos';
        // Clean description - remove HTML tags and limit length
        const cleanDesc = l.description
            ? l.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)
            : 'No description available';
        return `
LISTING ${idx + 1} (ID: ${l.id}):
Title: "${l.title}"
Price: €${l.priceEur.toLocaleString()}
Area: ${l.areaSqm ? `${l.areaSqm.toLocaleString()} m²` : 'Not specified'}
Property Type: ${l.propertyType || 'Not specified'}
Location: ${l.city || l.locationLabel || 'Portugal'}
Description: "${cleanDesc}"
${photoInfo}`;
    }).join('\n' + '='.repeat(50));
    const prompt = `USER SEARCH QUERY: "${userQuery}"

IMPORTANT: Understand what the user REALLY wants. Parse their query for:
- Property type (land, house, apartment, farm, etc.)
- Specific features they mentioned
- Their apparent purpose (farming, building, investment, living, etc.)

Now analyze these ${listings.length} listings from Portugal:
${listingSummaries}

For EACH listing, determine if it genuinely matches what the user is looking for.
Return a JSON array with your analysis.`;
    try {
        console.log(`[AI Analysis] Analyzing ${listings.length} listings with ${health.backend} backend (timeout: ${timeout}ms)...`);
        // Add timeout wrapper for AI call
        const aiCallPromise = callAIWithFallback(prompt, LISTING_ANALYSIS_PROMPT);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI analysis timeout')), timeout));
        const response = await Promise.race([aiCallPromise, timeoutPromise]);
        console.log(`[AI Analysis] Got response (${response.length} chars)`);
        // Extract JSON array from response - try multiple patterns
        let jsonStr = null;
        // Pattern 1: JSON in code blocks
        const codeBlockMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1];
        }
        // Pattern 2: Find balanced JSON array
        if (!jsonStr) {
            const startIdx = response.indexOf('[');
            if (startIdx !== -1) {
                let depth = 0;
                let endIdx = startIdx;
                for (let i = startIdx; i < response.length; i++) {
                    if (response[i] === '[')
                        depth++;
                    else if (response[i] === ']') {
                        depth--;
                        if (depth === 0) {
                            endIdx = i + 1;
                            break;
                        }
                    }
                }
                if (depth === 0 && endIdx > startIdx) {
                    jsonStr = response.slice(startIdx, endIdx);
                }
            }
        }
        if (jsonStr) {
            try {
                const rawResults = JSON.parse(jsonStr);
                // Normalize and validate results - be lenient with types
                const results = rawResults.map((r) => ({
                    id: String(r.id || ''),
                    isRelevant: r.isRelevant === true || r.isRelevant === 'true' || r.relevant === true,
                    relevanceScore: typeof r.relevanceScore === 'number' ? r.relevanceScore :
                        typeof r.relevanceScore === 'string' ? parseInt(r.relevanceScore, 10) :
                            typeof r.score === 'number' ? r.score : 50,
                    reasoning: String(r.reasoning || r.reason || r.explanation || 'Analyzed by AI'),
                }));
                // Filter to valid entries (must have an ID)
                const validResults = results.filter(r => r.id && r.id.length > 0);
                console.log(`[AI Analysis] Parsed ${validResults.length} valid results from ${rawResults.length} total`);
                // If we got valid results, use them
                if (validResults.length > 0) {
                    // Ensure all listings have a result (merge with defaults for missing)
                    const resultMap = new Map(validResults.map(r => [r.id, r]));
                    return listings.map(l => {
                        const aiResult = resultMap.get(l.id);
                        if (aiResult) {
                            return aiResult;
                        }
                        // Check if AI analyzed this listing but under a different ID format
                        const altResult = validResults.find(r => r.id.includes(l.id) || l.id.includes(r.id) ||
                            r.reasoning?.toLowerCase().includes(l.title?.toLowerCase().slice(0, 20)));
                        if (altResult) {
                            return { ...altResult, id: l.id };
                        }
                        return {
                            id: l.id,
                            isRelevant: true,
                            relevanceScore: 60,
                            reasoning: "Included based on search criteria",
                        };
                    });
                }
            }
            catch (parseError) {
                console.error("[AI Analysis] JSON parse error:", parseError);
                console.log("[AI Analysis] Raw JSON attempt:", jsonStr?.slice(0, 500));
            }
        }
        else {
            console.log("[AI Analysis] No JSON array found in response");
            console.log("[AI Analysis] Response preview:", response.slice(0, 500));
        }
    }
    catch (error) {
        console.error("[AI Analysis] Failed:", error);
    }
    // Smart fallback: analyze listings locally without AI
    console.log("[AI Analysis] Using smart local fallback");
    return analyzeListingsLocally(userQuery, listings);
};
exports.filterListingsByRelevance = filterListingsByRelevance;
/**
 * Local analysis fallback when AI is unavailable
 * Provides meaningful analysis based on keyword matching and property attributes
 */
function analyzeListingsLocally(userQuery, listings) {
    const query = userQuery.toLowerCase();
    // Extract search intent from query
    const wantsApartment = /apartment|apartamento|apt|flat/.test(query) && !/house|moradia|villa/.test(query);
    const wantsHouse = /house|casa|moradia|villa|vivenda|quinta/.test(query);
    const wantsLand = /land|terreno|plot|lote|terrain/.test(query);
    const wantsRoom = /room|quarto|bedroom/.test(query);
    const wantsForSale = /sale|buy|compra|venda|purchase|\d{5,}/.test(query);
    const wantsForRent = /rent|arrendar|alugar|aluguer/.test(query);
    // Location keywords from query
    const locationWords = query.match(/(?:in|near|around)\s+(\w+)/i)?.[1]?.toLowerCase();
    return listings.map(l => {
        const title = l.title.toLowerCase();
        const desc = (l.description || '').toLowerCase();
        const city = (l.city || '').toLowerCase();
        const combined = `${title} ${desc}`;
        let score = 50; // Base score
        let reasons = [];
        let isRelevant = true;
        // Property type detection - order matters (more specific first)
        const isRoom = /quarto(?!\s+de\s+banho)|room\b|single room/.test(combined) && !/apartamento|moradia|t[1-4]/.test(title);
        const isApartment = /apartamento|apartment|flat|\bt[0-4]\b/.test(combined) && !isRoom && !/moradia|house|villa/.test(title);
        const isHouse = /moradia|house|villa|vivenda|quinta/.test(combined) && !isApartment;
        const isLand = /terreno|land|lote|plot|rústico/.test(combined);
        const isCommercial = /comercial|loja|armazém|pavilh|escritório|office/.test(combined);
        const isMobileHome = /mobil\s*home|caravana|rulote/.test(combined);
        // Determine property type label
        const propertyType = isRoom ? 'Room' :
            isApartment ? 'Apartment' :
                isHouse ? 'House/Villa' :
                    isLand ? 'Land' :
                        isCommercial ? 'Commercial' :
                            isMobileHome ? 'Mobile Home' : 'Property';
        // Check if listing type matches query
        if (wantsApartment) {
            if (isApartment) {
                score += 35;
                reasons.push(`${propertyType} in ${l.city || 'the area'}`);
            }
            else if (isRoom) {
                score -= 25;
                reasons.push(`This is a room rental, not a full apartment`);
                isRelevant = false;
            }
            else if (isHouse) {
                score += 10;
                reasons.push(`${propertyType} - you searched for apartments`);
            }
            else if (isCommercial) {
                score -= 30;
                reasons.push(`Commercial property, not residential`);
                isRelevant = false;
            }
            else if (isMobileHome) {
                score -= 10;
                reasons.push(`Mobile home listing`);
            }
        }
        else if (wantsHouse) {
            if (isHouse) {
                score += 35;
                reasons.push(`${propertyType} matches your search`);
            }
            else if (isApartment) {
                score += 5;
                reasons.push(`${propertyType} - you searched for houses`);
            }
        }
        else if (wantsLand && isLand) {
            score += 30;
            reasons.push(`Land plot matches your search`);
        }
        else if (wantsRoom && isRoom) {
            score += 25;
            reasons.push(`Room rental matches your search`);
        }
        else if (wantsApartment && isCommercial) {
            score -= 30;
            reasons.push(`Commercial property, not residential`);
            isRelevant = false;
        }
        else if (!wantsApartment && !wantsHouse && !wantsLand && !wantsRoom) {
            // Generic search - just describe what it is
            if (isApartment || isHouse) {
                score += 20;
                reasons.push(`${propertyType} in ${l.city || 'the area'}`);
            }
        }
        // Location matching
        if (locationWords && city.includes(locationWords)) {
            score += 15;
            if (reasons.length === 0) {
                reasons.push(`Located in ${l.city}`);
            }
        }
        // Sale vs Rent detection
        const forRent = /arrendar|alugar|aluguer|rent|mês|month|mensal/.test(combined) ||
            (l.priceEur < 3000 && l.priceEur > 100);
        const forSale = /venda|vender|sale|compra/.test(combined) || l.priceEur > 30000;
        if (wantsForSale && forRent && !forSale) {
            score -= 20;
            reasons.push(`Rental listing (€${l.priceEur}/month)`);
            isRelevant = l.priceEur > 10000; // Keep if price suggests it might be sale
        }
        else if (wantsForRent && forSale && !forRent) {
            score -= 15;
            reasons.push(`For sale at €${l.priceEur.toLocaleString()}`);
        }
        else if (forSale && l.priceEur > 0) {
            reasons.push(`€${l.priceEur.toLocaleString()}`);
        }
        // Size info
        if (l.areaSqm && l.areaSqm > 0) {
            const sizeInfo = `${l.areaSqm}m²`;
            if (!reasons.some(r => r.includes('m²'))) {
                reasons.push(sizeInfo);
            }
        }
        // Clamp score
        score = Math.max(10, Math.min(95, score));
        // Build reasoning string - make it descriptive
        let reasoning;
        if (reasons.length > 0) {
            reasoning = reasons.slice(0, 2).join('. ');
            if (!reasoning.endsWith('.'))
                reasoning += '.';
        }
        else {
            reasoning = `${propertyType} in ${l.city || 'Portugal'} at €${l.priceEur.toLocaleString()}.`;
        }
        return {
            id: l.id,
            isRelevant,
            relevanceScore: score,
            reasoning,
        };
    });
}
/**
 * Filter and rank listings by AI-determined relevance
 */
const getRelevantListings = async (userQuery, listings) => {
    if (listings.length === 0)
        return [];
    // Get AI relevance analysis
    const relevanceResults = await (0, exports.filterListingsByRelevance)(userQuery, listings);
    const relevanceMap = new Map(relevanceResults.map(r => [r.id, r]));
    // Filter to only relevant listings and sort by relevance score
    return listings
        .map(listing => ({
        listing,
        relevance: relevanceMap.get(listing.id) || {
            id: listing.id,
            isRelevant: true,
            relevanceScore: 50,
            reasoning: "Default",
        },
    }))
        .filter(item => item.relevance.isRelevant)
        .sort((a, b) => b.relevance.relevanceScore - a.relevance.relevanceScore);
};
exports.getRelevantListings = getRelevantListings;
/**
 * Get RAG system statistics
 */
const getRAGSystemStats = () => {
    return (0, index_1.getRAGStats)();
};
exports.getRAGSystemStats = getRAGSystemStats;
/**
 * Re-export RAG functions for external use
 */
var index_2 = require("./rag/index");
Object.defineProperty(exports, "indexListings", { enumerable: true, get: function () { return index_2.indexListings; } });
