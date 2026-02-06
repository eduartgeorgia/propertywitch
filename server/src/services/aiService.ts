/**
 * AI Service - Multi-backend AI support for property search
 * Supports: Groq (cloud), Ollama with Llama3.3-Thinking-Claude (local), Claude API (optional)
 * Local-first architecture with cloud fallback
 * Now with RAG (Retrieval-Augmented Generation) support
 */

import { initializeRAG, buildRAGContext, storeConversation, getRAGStats } from "./rag/index";

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
    await initializeRAG();
    ragInitialized = true;
  }
};

export type AIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ParsedSearchIntent = {
  propertyType?: string;
  priceMin?: number;
  priceMax?: number;
  priceTarget?: number;
  priceIntent: "under" | "over" | "between" | "exact" | "around" | "none";
  currency?: string;
  location?: string;
  beds?: number;
  baths?: number;
  areaSqm?: number;
  areaMin?: number;
  areaMax?: number;
  areaTarget?: number;
  amenities?: string[];
  rawQuery: string;
};

export type AISearchResponse = {
  parsedIntent: ParsedSearchIntent;
  clarificationNeeded: boolean;
  clarificationQuestion?: string;
  responseMessage: string;
};

export type AIBackend = "groq" | "claude" | "ollama" | "local" | "none";

export type AvailableBackend = {
  id: AIBackend;
  name: string;
  available: boolean;
  models?: string[];
  isCloud: boolean;
};

let activeBackend: AIBackend = "none";
let activeOllamaModel: string = process.env.OLLAMA_MODEL ?? "llama3.3-thinking-claude";
let backendChecked = false;

const PROPERTY_SYSTEM_PROMPT = `You are an AI property search assistant for Portugal. Parse the user's query and extract search parameters.

IMPORTANT RULES:
- ALWAYS set clarificationNeeded to false - never ask for clarification
- Extract as much info as possible, use sensible defaults for missing info
- For "under X" queries, set priceMax to X
- For "around X" queries, set priceTarget to X
- Always extract the numeric price value
- IMPORTANT: Distinguish between PRICE (in EUR/€) and AREA (in m², m2, sqm, square meters)
  - "1000 m2", "1000m²", "1000 sqm" = AREA filter, NOT price
  - "€1000", "1000 euros", "1000 EUR" = PRICE filter
  - When user says "within 1000 m2 range" they mean land SIZE, not price

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
    "areaMin": null,
    "areaMax": null,
    "areaTarget": null,
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
export const detectBackend = async (): Promise<AIBackend> => {
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
        const modelNames = data.models.map((m: any) => m.name);
        console.log("AI Backend: Ollama (local) - FALLBACK, models:", modelNames);
        const hasThinkingClaude = modelNames.some((n: string) => 
          n.includes('thinking-claude') || n.includes('llama3.3')
        );
        if (hasThinkingClaude) {
          console.log("  → Using Llama3.3-Thinking-Claude (high-reasoning model)");
        }
        activeBackend = "ollama";
        return "ollama";
      }
    }
  } catch {
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
  } catch {
    // Local AI not available
  }

  console.log("AI Backend: None (using regex fallback)");
  activeBackend = "none";
  return "none";
};

/**
 * Get all available AI backends with their status
 */
export const getAvailableBackends = async (): Promise<AvailableBackend[]> => {
  const backends: AvailableBackend[] = [];

  // Check Ollama
  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      const models = data.models?.map((m: any) => m.name) || [];
      backends.push({
        id: "ollama",
        name: "Ollama (Local)",
        available: models.length > 0,
        models,
        isCloud: false,
      });
    } else {
      backends.push({ id: "ollama", name: "Ollama (Local)", available: false, isCloud: false });
    }
  } catch {
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
  } catch {
    backends.push({ id: "local", name: "Local LLaMA", available: false, isCloud: false });
  }

  return backends;
};

/**
 * Manually set the active AI backend
 */
export const setActiveBackend = async (
  backend: AIBackend,
  model?: string
): Promise<{ success: boolean; message: string }> => {
  const backends = await getAvailableBackends();
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

/**
 * Get current backend info
 */
export const getCurrentBackendInfo = (): {
  backend: AIBackend;
  model: string;
} => {
  let model = "unknown";
  if (activeBackend === "ollama") {
    model = activeOllamaModel;
  } else if (activeBackend === "groq") {
    model = GROQ_MODEL;
  } else if (activeBackend === "claude") {
    model = CLAUDE_MODEL;
  } else if (activeBackend === "local") {
    model = "local-llm";
  }
  return { backend: activeBackend, model };
};

/**
 * Check if AI is available
 */
export const checkAIHealth = async (): Promise<{ available: boolean; backend: AIBackend }> => {
  if (!backendChecked) {
    await detectBackend();
    backendChecked = true;
  }
  return {
    available: activeBackend !== "none",
    backend: activeBackend,
  };
};

/**
 * Call Groq API (fast inference) with retry logic
 */
async function callGroq(prompt: string, system?: string, conversationHistory?: AIMessage[]): Promise<string> {
  const messages: { role: string; content: string }[] = [
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
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000); // 40 second timeout

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
          max_tokens: 4096,
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
    } catch (error) {
      lastError = error as Error;
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
async function callGroqWithFallback(prompt: string, system?: string, conversationHistory?: AIMessage[]): Promise<string> {
  try {
    return await callGroq(prompt, system, conversationHistory);
  } catch (error) {
    const errorMsg = (error as Error).message;
    // Check for rate limit errors (429), quota exceeded, or other recoverable errors
    if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('limit') || errorMsg.includes('quota') || errorMsg.includes('500') || errorMsg.includes('503')) {
      console.log("[AI] Groq error, trying Ollama fallback...");
      return await tryFallbackChain(prompt, system, conversationHistory, error as Error);
    }
    throw error;
  }
}

/**
 * Try fallback AI providers in order: Ollama (local) -> Claude (cloud)
 */
async function tryFallbackChain(prompt: string, system?: string, conversationHistory?: AIMessage[], originalError?: Error): Promise<string> {
  // Try Ollama (local Llama3.3-Thinking-Claude) as primary fallback
  console.log("[AI] Trying Ollama (Llama3.3-Thinking-Claude) as fallback...");
  try {
    return await callOllama(prompt, system, conversationHistory);
  } catch (ollamaError) {
    console.log("[AI] Ollama fallback failed:", (ollamaError as Error).message.substring(0, 100));
  }
  
  // Try Claude as final fallback if available
  if (ANTHROPIC_API_KEY) {
    console.log("[AI] Trying Claude API as final fallback...");
    try {
      return await callClaude(prompt, system, conversationHistory);
    } catch (claudeError) {
      console.log("[AI] Claude failed:", (claudeError as Error).message.substring(0, 100));
    }
  }
  
  throw originalError || new Error("All AI providers failed");
}

/**
 * Call AI with automatic fallback - unified function for all backends
 * Priority: Groq (cloud - fast) -> Ollama (local) -> Claude (cloud)
 */
async function callAIWithFallback(prompt: string, system?: string, conversationHistory?: AIMessage[]): Promise<string> {
  const health = await checkAIHealth();
  
  const tryProvider = async (provider: string): Promise<string> => {
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
  const providers: string[] = ["groq", "ollama"];
  
  // If user manually switched backend, use that first but still allow fallback
  if (health.backend && health.backend !== "local" && health.backend !== "none") {
    const startIdx = providers.indexOf(health.backend);
    if (startIdx > 0) {
      providers.splice(startIdx, 1);
      providers.unshift(health.backend);
    }
  }
  
  let lastError: Error | null = null;
  
  for (const provider of providers) {
    try {
      console.log(`[AI] Trying ${provider}...`);
      return await tryProvider(provider);
    } catch (error) {
      const errMsg = (error as Error).message;
      console.log(`[AI] ${provider} failed: ${errMsg.substring(0, 100)}`);
      lastError = error as Error;
      
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
async function callClaude(prompt: string, system?: string, conversationHistory?: AIMessage[]): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  
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
      max_tokens: 4096,
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
async function callOllama(prompt: string, system?: string, conversationHistory?: AIMessage[]): Promise<string> {
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
async function callLocalAI(message: string): Promise<string> {
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
  if (!reader) return "";

  const decoder = new TextDecoder();
  let result = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              result += data.token;
            }
          } catch {
            // Not JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

/**
 * Parse a user query using AI
 */
export const parseQueryWithAI = async (query: string): Promise<AISearchResponse> => {
  const health = await checkAIHealth();

  if (!health.available) {
    return fallbackParse(query);
  }

  try {
    const response = await callAIWithFallback(
      `Parse this property search query and respond with JSON only:\n\n"${query}"`,
      PROPERTY_SYSTEM_PROMPT
    );

    return extractJSONFromResponse(response, query);
  } catch (error) {
    console.error("AI parsing failed:", error);
    return fallbackParse(query);
  }
};

/**
 * Generate a conversational response about search results
 */
export const generateResultsResponse = async (
  query: string,
  matchType: "exact" | "near-miss",
  listingsCount: number,
  priceRange: { min?: number; max?: number },
  locations: string[]
): Promise<string> => {
  const health = await checkAIHealth();

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
  } catch (error) {
    console.error("AI response failed:", error);
    return matchType === "exact"
      ? `Found ${listingsCount} listings matching your search.`
      : `No exact matches at that price. Found ${listingsCount} alternatives within the acceptable range.`;
  }
};

/**
 * AI-Powered Intent Detection
 * Uses the AI to understand user intent naturally from context
 */
export type UserIntent = "search" | "conversation" | "follow_up" | "refine_search" | "show_listings" | "pick_from_results";

export type AIIntentResult = {
  intent: UserIntent;
  isPropertySearch: boolean;
  confidence: number;
  reason: string;
  extractedFilters?: {
    location?: string;
    propertyType?: string;
    priceMin?: number;
    priceMax?: number;
    areaMin?: number;
    areaMax?: number;
    bedrooms?: number;
    keywords?: string[];
    // Vision/image feature filters
    imageFeatures?: string[];
  };
  selectionCriteria?: string;
  confirmationContext?: string;
};

const AI_INTENT_PROMPT = `You are an intent classifier for a Portuguese real estate assistant called "Property Witch".

Analyze the user's message IN CONTEXT of the conversation to determine their intent.

POSSIBLE INTENTS:
1. "search" - User wants to find NEW properties (new search query with specific criteria)
2. "refine_search" - User wants to MODIFY their previous search (add filters, change location, adjust price)
3. "pick_from_results" - User wants to SELECT/FILTER from EXISTING results (pick best, closest, cheapest, narrow down, filter by size)
4. "conversation" - User wants INFORMATION about buying process, taxes, laws, regions, or general chat
5. "follow_up" - User is asking about or referring to previous search results
6. "show_listings" - User wants to see/display the current results again

CRITICAL RULES:
- If user mentions m², m2, sqm, "square meters", "hectares" → this is about LAND SIZE (area), NOT price
- "narrow down within 1000 m2" means filter by AREA SIZE, not price
- "1000 euros" or "€1000" is PRICE, "1000 m2" is AREA
- If user has recent search results and asks to filter/narrow/pick → "pick_from_results"
- If user says "yes", "ok", "sure" after assistant suggested something → check what was suggested
- Questions about taxes, documents, visas, buying process → "conversation"
- New property search with location/price/type → "search"

IMAGE/VISUAL FEATURES - Extract these when user asks for properties with specific visual characteristics:
- Pool/swimming pool → imageFeatures: ["pool"]
- Sea view, ocean view, beach → imageFeatures: ["sea", "ocean", "beach"]
- Forest, trees, green → imageFeatures: ["forest", "trees"]
- Mountain view → imageFeatures: ["mountain"]
- Garden → imageFeatures: ["garden"]
- Ruins, old building → imageFeatures: ["ruins", "old"]
- Modern architecture → imageFeatures: ["modern"]
- Traditional/rustic style → imageFeatures: ["traditional", "rustic"]
- Terrace, balcony → imageFeatures: ["terrace", "balcony"]
- Vineyard, olive grove → imageFeatures: ["vineyard", "olive"]
- Bare/empty land → imageFeatures: ["bare_land"]
- Flat terrain, sloped → imageFeatures: ["flat", "sloped"]

Respond with ONLY valid JSON:
{
  "intent": "search" | "refine_search" | "pick_from_results" | "conversation" | "follow_up" | "show_listings",
  "isPropertySearch": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation of why you chose this intent",
  "extractedFilters": {
    "location": "string or null",
    "propertyType": "land|house|apartment|villa|commercial or null",
    "priceMin": number or null,
    "priceMax": number or null,
    "areaMin": number or null (in square meters),
    "areaMax": number or null (in square meters),
    "bedrooms": number or null,
    "keywords": ["array", "of", "relevant", "keywords"],
    "imageFeatures": ["array", "of", "visual", "features"] or null
  },
  "selectionCriteria": "what the user wants to filter/sort by (only for pick_from_results intent)"
}`;

export const detectIntent = async (
  message: string,
  conversationHistory?: AIMessage[],
  hasRecentResults?: boolean
): Promise<AIIntentResult> => {
  const health = await checkAIHealth();
  const lower = message.toLowerCase().trim();

  // Quick check for simple confirmations that need context
  const isSimpleConfirmation = /^(yes|yeah|yep|yup|sure|please|ok|okay|go ahead|do it|definitely|absolutely|of course|please do|yes please)\.?$/i.test(lower);
  
  if (isSimpleConfirmation && conversationHistory && conversationHistory.length > 0) {
    const lastAssistantMsg = [...conversationHistory].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg) {
      const assistantLower = lastAssistantMsg.content.toLowerCase();
      if (assistantLower.includes('search') || assistantLower.includes('narrow') || assistantLower.includes('filter') || assistantLower.includes('would you like')) {
        return {
          intent: "refine_search",
          isPropertySearch: true,
          confidence: 0.8,
          reason: "User confirmed assistant's suggestion",
          confirmationContext: lastAssistantMsg.content
        };
      }
    }
    return {
      intent: "follow_up",
      isPropertySearch: false,
      confidence: 0.6,
      reason: "Simple confirmation without clear context"
    };
  }

  // Use AI for intent detection if available
  if (health.available) {
    try {
      // Build conversation context
      const recentHistory = conversationHistory?.slice(-6) || [];
      const contextSummary = recentHistory.length > 0
        ? recentHistory.map(m => `${m.role.toUpperCase()}: ${m.content.substring(0, 300)}`).join('\n')
        : '(new conversation)';

      const prompt = `${AI_INTENT_PROMPT}

CONVERSATION CONTEXT:
${contextSummary}

USER HAS EXISTING SEARCH RESULTS: ${hasRecentResults ? 'YES - User can filter/pick from these results' : 'NO - User needs to search first'}

USER'S NEW MESSAGE: "${message}"

Analyze and respond with JSON only:`;

      const response = await callAIWithFallback(prompt, "You are a precise intent classifier. Respond with valid JSON only.");

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[Intent AI] Detected: ${parsed.intent} (${parsed.confidence}) - ${parsed.reason}`);
        
        // SAFETY CHECK: If message clearly looks like a property search, override AI if it said "conversation"
        const looksLikeSearch = /(?:show|find|search|looking|houses?|apartments?|properties?|land|villa|for\s*sale|to\s*buy|near|pool|sea\s*view)/i.test(message);
        const aiSaidConversation = parsed.intent === "conversation" || parsed.isPropertySearch === false;
        
        if (looksLikeSearch && aiSaidConversation) {
          console.log(`[Intent AI] OVERRIDE: Message looks like search but AI said "${parsed.intent}" - forcing search intent`);
          return {
            intent: "search",
            isPropertySearch: true,
            confidence: 0.8,
            reason: "Override: message contains search keywords",
            extractedFilters: parsed.extractedFilters,
          };
        }
        
        return {
          intent: parsed.intent || "search",
          isPropertySearch: parsed.isPropertySearch ?? true,
          confidence: parsed.confidence || 0.7,
          reason: parsed.reason || "AI classification",
          extractedFilters: parsed.extractedFilters,
          selectionCriteria: parsed.selectionCriteria,
        };
      }
    } catch (error) {
      console.error("[Intent AI] Detection failed:", error);
    }
  }

  // Fallback: minimal pattern matching for when AI is unavailable
  console.log("[Intent] AI unavailable, using fallback patterns");
  
  // PRIORITY 1: Check for explicit search keywords - these should ALWAYS trigger search
  if (/(?:show\s*me|find\s*me|looking\s*for|search\s*for|get\s*me|i\s*want|i\s*need|houses?|apartments?|properties?|land|villa|villas)/i.test(message) && 
      /(?:for\s*sale|to\s*buy|near|in\s+\w+|portugal|lisbon|porto|algarve|with\s+pool|sea\s*view)/i.test(message)) {
    return {
      intent: "search",
      isPropertySearch: true,
      confidence: 0.9,
      reason: "Fallback: explicit property search with location/criteria detected"
    };
  }
  
  // Check for area mentions (m2, m², sqm) - this is about land SIZE
  if (/\d+\s*(?:m2|m²|sqm|square\s*met)/i.test(message) && hasRecentResults) {
    return {
      intent: "pick_from_results",
      isPropertySearch: true,
      confidence: 0.7,
      reason: "Fallback: area filter detected with existing results"
    };
  }
  
  // Check for obvious search patterns
  if (/(?:find|search|looking for|show me)\s+(?:me\s+)?(?:some\s+)?(?:a\s+)?(?:land|house|houses|apartment|apartments|property|properties|villas?)/i.test(message)) {
    return {
      intent: "search",
      isPropertySearch: true,
      confidence: 0.85,
      reason: "Fallback: search pattern detected"
    };
  }
  
  // Check for pick/filter patterns
  if (hasRecentResults && /(?:narrow|filter|pick|select|closest|cheapest|best|which one)/i.test(message)) {
    return {
      intent: "pick_from_results",
      isPropertySearch: true,
      confidence: 0.7,
      reason: "Fallback: filter pattern detected with existing results"
    };
  }
  
  // Check for questions (likely conversation)
  if (/\?$|^(?:what|how|why|when|where|who|can you|tell me|explain)/i.test(message)) {
    return {
      intent: "conversation",
      isPropertySearch: false,
      confidence: 0.6,
      reason: "Fallback: question pattern detected"
    };
  }

  // Default to search
  return {
    intent: "search",
    isPropertySearch: true,
    confidence: 0.5,
    reason: "Fallback: defaulting to search"
  };
};

/**
 * Chat with AI for general questions (with conversation history and RAG)
 */
export const chatWithAI = async (
  message: string,
  conversationHistory?: AIMessage[],
  searchContext?: string,
  conversationId?: string
): Promise<string> => {
  const health = await checkAIHealth();

  if (!health.available) {
    return "AI is currently unavailable. Please try your search - I can still find listings using the search system.";
  }

  // Ensure RAG is initialized
  await ensureRAGInitialized();

  // Build RAG context for knowledge-enhanced responses
  const ragContext = await buildRAGContext(message, {
    includeKnowledge: true,
    includeListings: false,
    includeConversations: !!conversationId,
    conversationId,
    maxTokens: 1500,
  });

  // Build context-aware prompt with RAG
  let contextualPrompt = message;
  const contextParts: string[] = [];
  
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
        await storeConversation(conversationId, message, response, searchContext);
      } catch (err) {
        console.error("[RAG] Failed to store conversation:", err);
      }
    }

    return response;
  } catch (error) {
    console.error("AI chat failed:", error);
    return "I'm having trouble connecting to the AI. Please try again.";
  }
};

// Helper: Extract JSON from AI response
function extractJSONFromResponse(text: string, originalQuery: string): AISearchResponse {
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
    } catch {
      // JSON parse failed
    }
  }

  return fallbackParse(originalQuery);
}

// Helper: Regex-based fallback parser
function fallbackParse(query: string): AISearchResponse {
  const lower = query.toLowerCase();

  // Property type
  let propertyType: string | undefined;
  if (/(land|plot|terrain|lote|terreno)/.test(lower)) propertyType = "land";
  else if (/(apartment|apartamento|apt|flat)/.test(lower)) propertyType = "apartment";
  else if (/(house|villa|casa|moradia|home)/.test(lower)) propertyType = "house";

  // Price parsing
  let priceTarget: number | undefined;
  let priceMin: number | undefined;
  let priceMax: number | undefined;
  let priceIntent: "under" | "over" | "between" | "exact" | "around" | "none" = "none";

  const betweenMatch = lower.match(/between\s+([\d.,]+)\s*(?:k|thousand|mil)?\s*(?:and|to|-)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
  const underMatch = lower.match(/(?:under|below|max|up to|less than|<)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
  const overMatch = lower.match(/(?:over|above|min|at least|more than|>)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
  const forMatch = lower.match(/(?:for|at|around|about|~)\s*([\d.,]+)\s*(?:k|thousand|mil)?/i);
  const plainMatch = query.match(/([\d.,]+)\s*(?:k|thousand|mil)?/i);

  const parseNumber = (str: string, suffix?: string): number => {
    let num = parseFloat(str.replace(/[,]/g, ""));
    const hasK = suffix?.toLowerCase().includes("k") || suffix?.toLowerCase().includes("thousand");
    const hasMil = suffix?.toLowerCase().includes("mil");
    if (hasK) num *= 1000;
    if (hasMil) num *= 1000000;
    return num;
  };

  if (betweenMatch) {
    priceMin = parseNumber(betweenMatch[1]);
    priceMax = parseNumber(betweenMatch[2]);
    priceIntent = "between";
  } else if (underMatch) {
    priceMax = parseNumber(underMatch[1]);
    priceIntent = "under";
  } else if (overMatch) {
    priceMin = parseNumber(overMatch[1]);
    priceIntent = "over";
  } else if (forMatch) {
    priceTarget = parseNumber(forMatch[1]);
    priceIntent = "around";
  } else if (plainMatch) {
    priceTarget = parseNumber(plainMatch[1]);
    priceIntent = "around";
  }

  // Currency
  let currency: string | undefined;
  if (lower.includes("usd") || lower.includes("$") || lower.includes("dollar")) currency = "USD";
  else if (lower.includes("eur") || lower.includes("€") || lower.includes("euro")) currency = "EUR";
  else if (lower.includes("gbp") || lower.includes("£") || lower.includes("pound")) currency = "GBP";

  // Location
  let location: string | undefined;
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
  if (propertyType) responseMessage += `${propertyType} `;
  else responseMessage += "properties ";
  if (location) responseMessage += `near ${location} `;
  if (priceTarget) responseMessage += `around ${currency === "USD" ? "$" : "€"}${priceTarget.toLocaleString()}`;
  else if (priceMax) responseMessage += `under ${currency === "USD" ? "$" : "€"}${priceMax.toLocaleString()}`;
  else if (priceMin) responseMessage += `over ${currency === "USD" ? "$" : "€"}${priceMin.toLocaleString()}`;
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
function cleanResponse(text: string): string {
  return text
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[\s\S]*?\}/g, "")
    .trim()
    .slice(0, 500); // Limit length
}

/**
 * AI Listing Relevance Filter
 * Analyzes each listing's title, description, and photos to determine
 * if it matches what the user is actually looking for.
 */

type ListingForAnalysis = {
  id: string;
  title: string;
  description?: string;
  photos: string[];
  priceEur: number;
  areaSqm?: number;
  propertyType?: string;
  city?: string;
  locationLabel?: string;
};

export type ListingRelevanceResult = {
  id: string;
  isRelevant: boolean;
  relevanceScore: number; // 0-100
  reasoning: string;
};

const LISTING_ANALYSIS_PROMPT = `You are an expert Portuguese real estate analyst. Your job is to CAREFULLY READ each listing's title and description to understand exactly what is being sold/rented.

**YOUR CRITICAL TASK:**
1. READ the user's search query to understand EXACTLY what they want
2. READ each listing's TITLE and DESCRIPTION CAREFULLY - these contain crucial information
3. MATCH the listing content against what the user is looking for
4. Score based on how well the ACTUAL listing content matches the user's needs

**UNDERSTANDING PORTUGUESE REAL ESTATE LISTINGS:**
- "Terreno rústico" = Rural land (CANNOT build, only agriculture)
- "Terreno urbano" / "Lote" = Urban plot (CAN build on it)
- "Quinta" = Farm estate (usually includes house + land)
- "Moradia" = House/Villa
- "Apartamento T2" = 2-bedroom apartment
- "Vista mar" / "Vista para o mar" = Sea view
- "Piscina" = Swimming pool
- "Para recuperar" / "A necessitar de obras" = Needs renovation
- "Bom estado" / "Renovado" = Good condition / Renovated

**VISUAL FEATURES TO DETECT IN TEXT:**
When user asks for visual features (sea view, pool, forest, etc.), CHECK IF THE LISTING TEXT MENTIONS THEM:
- Sea/Ocean view: "vista mar", "vista oceano", "frente mar", "à beira-mar", "oceanfront"
- Pool: "piscina", "pool"
- Garden: "jardim", "garden", "quintal"
- Forest/Trees: "floresta", "arborizado", "árvores", "bosque"
- Mountain view: "vista serra", "vista montanha", "mountain view"
- River: "rio", "ribeira", "riverside"
- Terrace/Balcony: "terraço", "varanda", "balcony"
- Modern: "moderno", "contemporâneo", "modern"
- Traditional/Rustic: "tradicional", "rústico", "típico"

**SCORING RULES:**
- 85-100: PERFECT match - listing clearly has what user wants (mentioned in text)
- 70-84: GOOD match - listing mostly matches, minor differences
- 50-69: PARTIAL match - could work but not ideal
- 30-49: WEAK match - listing has some relevant aspects but not what user needs
- 0-29: NO match - listing is completely different from what user wants

**FOR VISUAL FEATURE SEARCHES:**
- If user asks for "sea view" and listing text says "vista mar" → HIGH score
- If user asks for "sea view" but listing text doesn't mention it → LOWER score + note "visual feature not confirmed in text, may need photo analysis"
- If user asks for "pool" and listing mentions "piscina" → HIGH score

**IMPORTANT:**
- ACTUALLY READ the description text provided - don't just guess from the title
- Look for specific keywords in Portuguese and English
- Note when visual features are NOT mentioned in text (vision analysis may be needed)

Return ONLY valid JSON - no explanations outside the JSON array.`;

// Configuration for AI analysis behavior
const AI_ANALYSIS_CONFIG = {
  // Maximum listings to analyze in a single AI call (smaller = faster response)
  batchSize: 8, // Reduced from 12 - faster AI responses
  // Maximum total listings for AI analysis (larger sets use smart pre-filtering)
  maxListingsForAI: 100, // Always try AI first
  // Timeout for AI analysis in milliseconds
  analysisTimeoutMs: 45000, // 45 seconds - reduced from 90 to fail faster
  // Enable/disable AI listing analysis
  enableAIAnalysis: true,
  // Threshold for detailed vs brief analysis
  detailedAnalysisThreshold: 20, // More listings get detailed analysis
  // ALWAYS use AI when visual features are detected
  forceAIForVisualFeatures: true,
};

/**
 * Build the AI analysis prompt - detailed or brief based on listing count
 * Now includes full description content for proper AI comprehension
 */
function buildAnalysisPrompt(userQuery: string, listings: ListingForAnalysis[], isDetailed: boolean): string {
  const listingSummaries = listings.map((l, idx) => {
    const photoInfo = l.photos.length > 0 
      ? `Has ${l.photos.length} photo(s) - can be analyzed for visual features if needed`
      : 'No photos available';
    
    // Clean description - remove HTML tags but KEEP FULL TEXT for AI to read
    const cleanDesc = l.description 
      ? l.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : 'No description provided';
    
    // ALWAYS include enough description for AI to understand the listing
    // Keep descriptions concise to avoid token limits and timeouts
    const descLength = isDetailed ? 800 : 500;
    const truncatedDesc = cleanDesc.length > descLength 
      ? cleanDesc.slice(0, descLength) + '...'
      : cleanDesc;
    
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LISTING ${idx + 1} (ID: ${l.id})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Location: ${l.city || l.locationLabel || 'Portugal'}
🏷️ Title: "${l.title}"
💰 Price: €${l.priceEur.toLocaleString()}
📐 Area: ${l.areaSqm ? `${l.areaSqm.toLocaleString()} m²` : 'Not specified'}
🏠 Type: ${l.propertyType || 'Not specified'}

📝 FULL DESCRIPTION (READ THIS CAREFULLY):
"${truncatedDesc}"

📷 ${photoInfo}`;
  }).join('\n');

  // Detect if user is asking for visual features
  const visualFeaturePatterns = [
    { pattern: /sea\s*view|vista\s*mar|ocean|oceano|frente\s*mar|beach|praia/i, feature: 'sea/ocean view' },
    { pattern: /pool|piscina|swimming/i, feature: 'swimming pool' },
    { pattern: /garden|jardim|quintal/i, feature: 'garden' },
    { pattern: /forest|floresta|trees|árvores|bosque|arborizado/i, feature: 'forest/trees' },
    { pattern: /mountain|montanha|serra|monte/i, feature: 'mountain view' },
    { pattern: /river|rio|ribeira/i, feature: 'river/riverside' },
    { pattern: /terrace|terraço|varanda|balcony/i, feature: 'terrace/balcony' },
    { pattern: /rural|countryside|campo|isolated|isolado/i, feature: 'rural setting' },
    { pattern: /modern|moderno|contemporary|contemporâneo/i, feature: 'modern style' },
  ];
  
  const requestedFeatures = visualFeaturePatterns
    .filter(vf => vf.pattern.test(userQuery))
    .map(vf => vf.feature);
  
  const visualFeatureNote = requestedFeatures.length > 0
    ? `\n⚠️ USER IS SEARCHING FOR VISUAL FEATURES: ${requestedFeatures.join(', ')}\nCHECK EACH DESCRIPTION for mentions of these features. If a feature is NOT mentioned in the text, note it in your reasoning as "feature not confirmed in text - may need photo analysis".`
    : '';

  if (isDetailed) {
    // Detailed analysis prompt for fewer results
    return `USER SEARCH QUERY: "${userQuery}"
${visualFeatureNote}

CRITICAL INSTRUCTIONS:
1. READ each listing's TITLE and DESCRIPTION CAREFULLY
2. Identify what is ACTUALLY being offered based on the text
3. Match the listing content against what the user wants
4. Be SPECIFIC in your reasoning - cite actual words from the description

For EACH listing, analyze:
✓ Does the TITLE indicate what user wants?
✓ Does the DESCRIPTION mention the features user is looking for?
✓ Is the location appropriate?
✓ Is the price reasonable?
✓ What specific keywords in the description support/reject this match?

LISTINGS TO ANALYZE:
${listingSummaries}

Return a JSON array. Each entry MUST include specific details from the listing text:
[
  {
    "id": "listing-id",
    "isRelevant": true/false,
    "relevanceScore": 0-100,
    "reasoning": "4-6 sentences citing SPECIFIC details from the listing. Example: 'The description mentions \"vista panorâmica para o mar\" confirming sea view. Listed as terreno urbano (buildable). Priced at €X/m² which is reasonable for the coastal area. However, no pool is mentioned in the text.'"
  }
]`;
  } else {
    // Brief analysis for many results - but still MUST read descriptions thoroughly
    return `USER SEARCH QUERY: "${userQuery}"
${visualFeatureNote}

YOUR TASK: Analyze these ${listings.length} Portuguese real estate listings.

CRITICAL: You MUST actually READ each listing's description to determine relevance.
- Don't just look at titles - read the full description text
- Look for Portuguese keywords that indicate features
- Note when requested features are or aren't mentioned in the text
- For LAND: Always specify if it's "urbano" (buildable) or "rústico" (not buildable)
- For VISUAL FEATURES: Note if sea view, pool, garden, etc. is mentioned or NOT mentioned

${listingSummaries}

Return a JSON array. Each reasoning MUST be 3-4 sentences with:
1. Property type and key characteristics from description
2. Whether it matches the user's search criteria
3. Any notable features or concerns (buildability, visual features, condition)
4. If visual features requested: explicitly state if mentioned in text or "not confirmed in text"

[
  {
    "id": "listing-id",
    "isRelevant": true/false,
    "relevanceScore": 0-100,
    "reasoning": "3-4 sentences. Example: 'This is a terreno urbano (urban land) suitable for construction, with 500m² in Cascais. Description mentions \"vista mar\" (sea view) and good road access. Priced at €150/m² which is reasonable for this coastal area. Water and electricity connections available.'"
  }
]`;
  }
}

export const filterListingsByRelevance = async (
  userQuery: string,
  listings: ListingForAnalysis[],
  options?: { skipAI?: boolean; timeout?: number; forceDetailed?: boolean; hasVisualFeatures?: boolean }
): Promise<ListingRelevanceResult[]> => {
  const skipAI = options?.skipAI ?? !AI_ANALYSIS_CONFIG.enableAIAnalysis;
  const timeout = options?.timeout ?? AI_ANALYSIS_CONFIG.analysisTimeoutMs;
  const forceDetailed = options?.forceDetailed ?? false;
  const hasVisualFeatures = options?.hasVisualFeatures ?? false;
  
  // Force AI if visual features detected (we need AI to understand context)
  const shouldForceAI = hasVisualFeatures && AI_ANALYSIS_CONFIG.forceAIForVisualFeatures;
  
  // Fast path: skip AI analysis entirely if disabled (but not if visual features force it)
  if (skipAI && !shouldForceAI) {
    console.log(`[AI Analysis] Using fast local analysis (skipAI=${skipAI}, listings=${listings.length})`);
    return analyzeListingsLocally(userQuery, listings, forceDetailed);
  }

  const health = await checkAIHealth();

  // If no AI available, use local analysis (not just return all as relevant)
  if (!health.available || listings.length === 0) {
    console.log(`[AI Analysis] AI not available, using enhanced local analysis`);
    return analyzeListingsLocally(userQuery, listings, forceDetailed);
  }

  // Determine if we should do detailed analysis based on listing count or force flag
  const isDetailed = forceDetailed || listings.length <= AI_ANALYSIS_CONFIG.detailedAnalysisThreshold;
  
  // **CRITICAL FIX**: Always use AI, but batch large result sets
  const needsBatching = listings.length > AI_ANALYSIS_CONFIG.batchSize;
  
  console.log(`[AI Analysis] Mode: ${isDetailed ? 'DETAILED' : 'BRIEF'} (${listings.length} listings, batching: ${needsBatching}, visual features: ${hasVisualFeatures})`);

  try {
    let allResults: ListingRelevanceResult[] = [];
    
    if (needsBatching) {
      // Process in batches to ensure AI actually analyzes all listings
      const batches: ListingForAnalysis[][] = [];
      for (let i = 0; i < listings.length; i += AI_ANALYSIS_CONFIG.batchSize) {
        batches.push(listings.slice(i, i + AI_ANALYSIS_CONFIG.batchSize));
      }
      
      console.log(`[AI Analysis] Processing ${batches.length} batches of ~${AI_ANALYSIS_CONFIG.batchSize} listings each...`);
      
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        console.log(`[AI Analysis] Batch ${batchIdx + 1}/${batches.length}: Analyzing ${batch.length} listings with ${health.backend} backend...`);
        
        const batchResults = await analyzeListingBatch(userQuery, batch, health.backend!, isDetailed, timeout, hasVisualFeatures);
        allResults = allResults.concat(batchResults);
      }
    } else {
      // Single batch analysis
      allResults = await analyzeListingBatch(userQuery, listings, health.backend!, isDetailed, timeout, hasVisualFeatures);
    }
    
    console.log(`[AI Analysis] Completed: ${allResults.length} listings analyzed`);
    return allResults;
    
  } catch (error) {
    console.error("[AI Analysis] Failed:", error);
    // Enhanced fallback: analyze listings locally with good heuristics
    console.log(`[AI Analysis] Using enhanced local fallback (detailed: ${isDetailed})`);
    return analyzeListingsLocally(userQuery, listings, isDetailed);
  }
};

/**
 * Analyze a single batch of listings with AI
 */
async function analyzeListingBatch(
  userQuery: string,
  listings: ListingForAnalysis[],
  backend: string,
  isDetailed: boolean,
  timeout: number,
  hasVisualFeatures: boolean
): Promise<ListingRelevanceResult[]> {
  // Build the appropriate prompt
  const prompt = buildAnalysisPrompt(userQuery, listings, isDetailed);

  try {
    // Add timeout wrapper for AI call
    const aiCallPromise = callAIWithFallback(prompt, LISTING_ANALYSIS_PROMPT);
    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('AI analysis timeout')), timeout)
    );
    
    const response = await Promise.race([aiCallPromise, timeoutPromise]);

    console.log(`[AI Analysis] Got response (${response.length} chars)`);

    // Extract JSON array from response - try multiple patterns
    let jsonStr: string | null = null;
    
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
          if (response[i] === '[') depth++;
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
        const results: ListingRelevanceResult[] = rawResults.map((r: any) => ({
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
            if (!l || !l.id) {
              return {
                id: l?.id || 'unknown',
                isRelevant: true,
                relevanceScore: 50,
                reasoning: "Listing data incomplete",
              };
            }
            const aiResult = resultMap.get(l.id);
            if (aiResult) {
              return aiResult;
            }
            // Check if AI analyzed this listing but under a different ID format
            const altResult = validResults.find(r => {
              if (!r || !r.id) return false;
              const rId = String(r.id || '');
              const lId = String(l.id || '');
              const lTitle = String(l.title || '').toLowerCase().slice(0, 20);
              const rReasoning = String(r.reasoning || '').toLowerCase();
              return rId.includes(lId) || lId.includes(rId) || rReasoning.includes(lTitle);
            });
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
      } catch (parseError) {
        console.error("[AI Analysis] JSON parse error:", parseError);
        console.log("[AI Analysis] Raw JSON attempt:", jsonStr?.slice(0, 500));
      }
    } else {
      console.log("[AI Analysis] No JSON array found in response");
      console.log("[AI Analysis] Response preview:", response.slice(0, 500));
    }
  } catch (error) {
    console.error("[AI Analysis] Batch failed:", error);
  }

  // Fallback for this batch
  return analyzeListingsLocally(userQuery, listings, isDetailed);
}

/**
 * Local analysis fallback when AI is unavailable
 * Provides meaningful analysis based on keyword matching and property attributes
 * @param isDetailed - When true, provide comprehensive 4-6 sentence analysis; when false, keep it brief
 */
function analyzeListingsLocally(
  userQuery: string,
  listings: ListingForAnalysis[],
  isDetailed: boolean = false
): ListingRelevanceResult[] {
  const query = userQuery.toLowerCase();
  
  // Extract search intent from query
  const wantsApartment = /apartment|apartamento|apt|flat/.test(query) && !/house|moradia|villa/.test(query);
  const wantsHouse = /house|casa|moradia|villa|vivenda|quinta/.test(query);
  const wantsLand = /land|terreno|plot|lote|terrain/.test(query);
  const wantsConstructionLand = /construct|build|construção|construir|building plot|lote para|urbano/.test(query) && wantsLand;
  const wantsFarmingLand = /farm|agric|farming|cultiv|rústico|agrícola/.test(query) && wantsLand;
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
    let reasons: string[] = [];
    let isRelevant = true;
    
    // Property type detection - order matters (more specific first)
    const isRoom = /quarto(?!\s+de\s+banho)|room\b|single room/.test(combined) && !/apartamento|moradia|t[1-4]/.test(title);
    const isApartment = /apartamento|apartment|flat|\bt[0-4]\b/.test(combined) && !isRoom && !/moradia|house|villa/.test(title);
    const isHouse = /moradia|house|villa|vivenda|quinta/.test(combined) && !isApartment;
    const isLand = /terreno|land|lote|plot|rústico/.test(combined);
    const isCommercial = /comercial|loja|armazém|pavilh|escritório|office/.test(combined);
    const isMobileHome = /mobil\s*home|caravana|rulote/.test(combined);
    
    // Construction land detection - critical for Portugal
    const isUrbanLand = isLand && /urbano|urbanizável|construção|lote de|para construir|viabilidade|projeto aprovado|alvará/.test(combined);
    const isRuralLand = isLand && /rústico|rústica|agrícola|agricultural|rural/.test(combined);
    const isLandBuildable = isUrbanLand && !isRuralLand;
    
    // Determine property type label
    const propertyType = isRoom ? 'Room' : 
                        isApartment ? 'Apartment' : 
                        isHouse ? 'House/Villa' : 
                        isUrbanLand ? 'Urban Land (buildable)' :
                        isRuralLand ? 'Rural Land (not buildable)' :
                        isLand ? 'Land' : 
                        isCommercial ? 'Commercial' :
                        isMobileHome ? 'Mobile Home' : 'Property';
    
    // Check if listing type matches query
    if (wantsApartment) {
      if (isApartment) {
        score += 35;
        reasons.push(`${propertyType} in ${l.city || 'the area'}`);
      } else if (isRoom) {
        score -= 25;
        reasons.push(`This is a room rental, not a full apartment`);
        isRelevant = false;
      } else if (isHouse) {
        score += 10;
        reasons.push(`${propertyType} - you searched for apartments`);
      } else if (isCommercial) {
        score -= 30;
        reasons.push(`Commercial property, not residential`);
        isRelevant = false;
      } else if (isMobileHome) {
        score -= 10;
        reasons.push(`Mobile home listing`);
      }
    } else if (wantsHouse) {
      if (isHouse) {
        score += 35;
        reasons.push(`${propertyType} matches your search`);
      } else if (isApartment) {
        score += 5;
        reasons.push(`${propertyType} - you searched for houses`);
      }
    } else if (wantsLand && isLand) {
      // Handle construction land specifically
      if (wantsConstructionLand) {
        if (isUrbanLand && !isRuralLand) {
          score += 40;
          reasons.push(`Urban land - suitable for construction`);
        } else if (isRuralLand) {
          score -= 40;
          reasons.push(`⚠️ Rural/rústico land - CANNOT build on this`);
          isRelevant = false;
        } else {
          // Unknown land type - check price per sqm
          const pricePerSqm = l.areaSqm && l.areaSqm > 0 ? l.priceEur / l.areaSqm : 0;
          if (pricePerSqm > 20) {
            score += 20;
            reasons.push(`Land (€${Math.round(pricePerSqm)}/m² suggests buildable)`);
          } else if (pricePerSqm > 0 && pricePerSqm < 10) {
            score -= 20;
            reasons.push(`Low price (€${Math.round(pricePerSqm)}/m²) suggests rural/unbuildable`);
            isRelevant = false;
          } else {
            reasons.push(`Land - verify if urbano (buildable) or rústico (not buildable)`);
          }
        }
      } else if (wantsFarmingLand) {
        if (isRuralLand) {
          score += 40;
          reasons.push(`Rural/agricultural land - suitable for farming`);
        } else if (isUrbanLand) {
          score -= 10;
          reasons.push(`Urban land - designed for construction, not farming`);
        } else {
          score += 20;
          reasons.push(`Land plot - check if suitable for agriculture`);
        }
      } else {
        // Generic land search
        score += 30;
        if (isUrbanLand) {
          reasons.push(`Urban land (construction allowed)`);
        } else if (isRuralLand) {
          reasons.push(`Rural land (agricultural use only)`);
        } else {
          reasons.push(`Land plot - verify land classification`);
        }
      }
    } else if (wantsRoom && isRoom) {
      score += 25;
      reasons.push(`Room rental matches your search`);
    } else if (wantsApartment && isCommercial) {
      score -= 30;
      reasons.push(`Commercial property, not residential`);
      isRelevant = false;
    } else if (!wantsApartment && !wantsHouse && !wantsLand && !wantsRoom) {
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
    } else if (wantsForRent && forSale && !forRent) {
      score -= 15;
      reasons.push(`For sale at €${l.priceEur.toLocaleString()}`);
    } else if (forSale && l.priceEur > 0) {
      reasons.push(`€${l.priceEur.toLocaleString()}`);
    }
    
    // Size info
    if (l.areaSqm && l.areaSqm > 0) {
      const sizeInfo = `${l.areaSqm}m²`;
      if (!reasons.some(r => r.includes('m²'))) {
        reasons.push(sizeInfo);
      }
    }
    
    // Visual feature detection from query and listing text
    const visualFeaturePatterns: [RegExp, string, string][] = [
      [/\b(sea|mar|ocean|oceano|vista\s*mar|sea\s*view|ocean\s*view)\b/i, 'sea', 'sea/ocean view'],
      [/\b(pool|piscina|swimming)\b/i, 'pool', 'swimming pool'],
      [/\b(forest|floresta|trees?|árvores?|bosque|arborizado)\b/i, 'forest', 'forest/trees'],
      [/\b(mountain|montanha|serra|vista\s*montanha)\b/i, 'mountain', 'mountain view'],
      [/\b(garden|jardim|quintal)\b/i, 'garden', 'garden'],
      [/\b(river|rio|ribeira|riverside)\b/i, 'river', 'riverside'],
      [/\b(ruin|ruína|abandoned|para\s*reconstruir|para\s*recuperar)\b/i, 'ruins', 'ruins/renovation needed'],
      [/\b(modern|moderno|contemporary|contemporâneo)\b/i, 'modern', 'modern style'],
      [/\b(traditional|tradicional|típico|rústico|rustic)\b/i, 'traditional', 'traditional/rustic'],
      [/\b(vineyard|vinha|vineyard|vinícola)\b/i, 'vineyard', 'vineyard'],
      [/\b(terrace|terraço|varanda|balcony|balcon)\b/i, 'terrace', 'terrace/balcony'],
      [/\b(garage|garagem|parking|estacionamento)\b/i, 'parking', 'parking/garage'],
      [/\b(rural|campo|countryside|isolado)\b/i, 'rural', 'rural location'],
    ];
    
    // Check which visual features user is looking for
    const requestedVisualFeatures: string[] = [];
    for (const [pattern, key] of visualFeaturePatterns) {
      if (pattern.test(query)) {
        requestedVisualFeatures.push(key);
      }
    }
    
    // Check which visual features the listing has (in title/description)
    const listingVisualFeatures: string[] = [];
    for (const [pattern, key, label] of visualFeaturePatterns) {
      if (pattern.test(combined)) {
        listingVisualFeatures.push(key);
      }
    }
    
    // Boost score for matching visual features
    if (requestedVisualFeatures.length > 0) {
      const matchedFeatures = requestedVisualFeatures.filter(f => listingVisualFeatures.includes(f));
      if (matchedFeatures.length > 0) {
        const featureBoost = (matchedFeatures.length / requestedVisualFeatures.length) * 25;
        score += featureBoost;
        const labels = matchedFeatures.map(f => visualFeaturePatterns.find(p => p[1] === f)?.[2] || f);
        reasons.push(`Has ${labels.join(', ')}`);
      } else {
        // Penalize if visual feature requested but not found
        score -= 10;
      }
    }
    
    // Clamp score
    score = Math.max(10, Math.min(95, score));
    
    // Build reasoning string - ALWAYS provide detailed analysis now
    let reasoning: string;
    
    // Generate comprehensive 3-4 sentence analysis for ALL modes
    const detailedParts: string[] = [];
    
    // Property type and location
    detailedParts.push(`This is a ${propertyType.toLowerCase()} located in ${l.city || 'Portugal'}.`);
    
    // Land classification (critical for Portugal)
    if (isLand) {
      if (isUrbanLand && !isRuralLand) {
        detailedParts.push(`This is classified as URBAN land (terreno urbano) - construction is permitted.`);
      } else if (isRuralLand) {
        detailedParts.push(`⚠️ This is RURAL/RÚSTICO land - construction is NOT permitted, suitable only for agriculture.`);
      } else {
        detailedParts.push(`Land classification unclear from listing - verify if urbano (buildable) or rústico (not buildable).`);
      }
    }
    
    // Price analysis
    if (l.priceEur > 0) {
      const pricePerSqm = l.areaSqm && l.areaSqm > 0 ? Math.round(l.priceEur / l.areaSqm) : 0;
      if (pricePerSqm > 0) {
        const priceAssessment = isLand 
          ? (pricePerSqm < 20 ? 'very affordable (likely rural)' : pricePerSqm < 50 ? 'affordable' : pricePerSqm < 150 ? 'moderate' : 'premium (likely urban/coastal)')
          : (pricePerSqm < 1500 ? 'quite affordable' : pricePerSqm < 3000 ? 'reasonably priced' : pricePerSqm < 5000 ? 'mid-range' : 'premium pricing');
        detailedParts.push(`Priced at €${l.priceEur.toLocaleString()} (€${pricePerSqm}/m²) - ${priceAssessment} for the area.`);
      } else {
        detailedParts.push(`Listed at €${l.priceEur.toLocaleString()}.`);
      }
    }
    
    // Size details
    if (l.areaSqm && l.areaSqm > 0) {
      const sizeCategory = isLand
        ? (l.areaSqm < 500 ? 'small plot' : l.areaSqm < 2000 ? 'medium plot' : l.areaSqm < 10000 ? 'large plot' : 'very large plot')
        : (l.areaSqm < 50 ? 'compact' : l.areaSqm < 100 ? 'medium-sized' : l.areaSqm < 200 ? 'spacious' : 'large');
      detailedParts.push(`Size: ${l.areaSqm.toLocaleString()}m² (${sizeCategory}).`);
    }
    
    // Visual features found
    if (listingVisualFeatures.length > 0) {
      const labels = listingVisualFeatures.map(f => visualFeaturePatterns.find(p => p[1] === f)?.[2] || f);
      detailedParts.push(`Features mentioned: ${labels.join(', ')}.`);
    } else if (requestedVisualFeatures.length > 0) {
      detailedParts.push(`Note: Requested visual features (${requestedVisualFeatures.join(', ')}) not confirmed in listing text - photo analysis may help.`);
    }
    
    // Match assessment
    if (score >= 75) {
      detailedParts.push(`Strong match for your search criteria.`);
    } else if (score >= 50) {
      detailedParts.push(`Partial match - review details to confirm suitability.`);
    } else {
      detailedParts.push(`May not fully match your requirements.`);
    }
    
    reasoning = detailedParts.slice(0, 5).join(' ');
    
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
export const getRelevantListings = async <T extends ListingForAnalysis>(
  userQuery: string,
  listings: T[]
): Promise<{ listing: T; relevance: ListingRelevanceResult }[]> => {
  if (listings.length === 0) return [];

  // Detect if user is asking for visual features
  const visualFeaturePatterns = [
    /sea\s*view|vista\s*mar|ocean|oceano|frente\s*mar|beach|praia/i,
    /pool|piscina|swimming/i,
    /garden|jardim|quintal/i,
    /forest|floresta|trees|árvores|bosque|arborizado/i,
    /mountain|montanha|serra|monte/i,
    /river|rio|ribeira/i,
    /terrace|terraço|varanda|balcony/i,
    /rural|countryside|campo|isolated|isolado/i,
  ];
  const hasVisualFeatures = visualFeaturePatterns.some(p => p.test(userQuery));

  // Get AI relevance analysis - now with visual features flag
  const relevanceResults = await filterListingsByRelevance(userQuery, listings, { hasVisualFeatures });
  const relevanceMap = new Map(relevanceResults.map(r => [r.id, r]));

  // Filter to only relevant listings and sort by relevance score
  let results = listings
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

  // If we ended up with ≤10 results but started with many more, 
  // re-analyze these few results with detailed mode for better reasoning
  const shouldReAnalyze = results.length <= AI_ANALYSIS_CONFIG.detailedAnalysisThreshold && 
                          listings.length > AI_ANALYSIS_CONFIG.detailedAnalysisThreshold;
  
  if (shouldReAnalyze && results.length > 0) {
    console.log(`[AI Analysis] Re-analyzing ${results.length} final results with detailed mode (started with ${listings.length})`);
    
    // Re-analyze just the final results with detailed prompts
    const finalListings = results.map(r => r.listing);
    const detailedResults = await filterListingsByRelevance(userQuery, finalListings, { forceDetailed: true, hasVisualFeatures });
    const detailedMap = new Map(detailedResults.map(r => [r.id, r]));
    
    // Update results with detailed reasoning
    results = results.map(item => ({
      ...item,
      relevance: detailedMap.get(item.listing.id) || item.relevance,
    }));
  }

  return results;
};

/**
 * Get RAG system statistics
 */
export const getRAGSystemStats = () => {
  return getRAGStats();
};

/**
 * Pick best listings from previous results using AI
 * Used when user says "pick 2", "choose the best ones", etc.
 */
export const pickBestListings = async (
  userQuery: string,
  listings: any[],
  count: number = 2
): Promise<{ selectedListings: any[]; explanation: string }> => {
  if (listings.length === 0) {
    return { selectedListings: [], explanation: "No listings available to pick from." };
  }

  // Extract the count from the query if specified
  const countMatch = userQuery.match(/(\d+|one|two|three|four|five|a few|some)/i);
  if (countMatch) {
    const numWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, "a few": 3, some: 3 };
    const parsed = numWords[countMatch[1].toLowerCase()] || parseInt(countMatch[1]);
    if (!isNaN(parsed)) count = parsed;
  }

  // Limit to available listings
  count = Math.min(count, listings.length);
  
  // Determine analysis depth based on expected results - always detailed for picks since user is narrowing down
  const isDetailed = count <= AI_ANALYSIS_CONFIG.detailedAnalysisThreshold;

  const health = await checkAIHealth();
  if (!health.available) {
    // Fallback: just return the first N listings
    return {
      selectedListings: listings.slice(0, count),
      explanation: `Here are the top ${count} listings from your search.`,
    };
  }

  // Create simplified listing data for AI - include index for mapping back
  const listingData = listings.slice(0, 30).map((l, idx) => ({
    index: idx,
    id: l.id,
    title: l.title,
    price: l.priceEur || l.displayPrice,
    location: l.locationLabel || l.city,
    distance: l.distanceKm,
    beds: l.beds,
    baths: l.baths,
    area: l.areaSqm,
    propertyType: l.propertyType,
    description: l.description?.slice(0, 300) || '',
  }));

  // Build prompt that requires BOTH selection and detailed per-listing analysis
  const pickPrompt = `You are helping a user select properties from their search results.

User request: "${userQuery}"

Available listings:
${JSON.stringify(listingData, null, 2)}

TASK: Select the ${count} best listings that match the user's criteria.
- If they want "closest to center" or "nearest", prioritize by distance (lower distanceKm = closer)
- If they want "cheapest", prioritize by price (lower = better)
- If they mention "m2", "m²", "sqm", "square meters", filter/sort by land AREA (area field in listings)
- "within 1000 m2" or "around 1000 m2" means filter listings with area close to 1000 square meters
- If they say "only 45m2" or "exactly 60m2", select ONLY listings with that exact area
- If they want "best", use overall value (price/quality/location balance)

${isDetailed ? `IMPORTANT: For each selected listing, provide a DETAILED individual analysis (4-6 sentences) covering:
- Why this property specifically matches the user's criteria
- Price analysis (value for money, €/m² if applicable)
- Location benefits
- Size/space assessment
- Key features and potential concerns
- Recommendation` : `For each selected listing, provide a brief analysis (2-3 sentences).`}

Respond with ONLY a valid JSON object:
{
  "selectedIndices": [0, 3],
  "listingAnalyses": {
    "0": "Detailed analysis for the listing at index 0...",
    "3": "Detailed analysis for the listing at index 3..."
  },
  "explanation": "Overall summary of why these listings were chosen (2-3 sentences)."
}`;

  try {
    const response = await callAIWithFallback(pickPrompt, "You are a helpful real estate assistant that selects the best properties based on user criteria.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const indices = parsed.selectedIndices || [];
      const listingAnalyses = parsed.listingAnalyses || {};
      
      // Build selected listings WITH updated aiReasoning
      const selectedListings = indices
        .filter((i: number) => i >= 0 && i < listings.length)
        .slice(0, count)
        .map((i: number) => {
          const listing = { ...listings[i] };
          // Update the aiReasoning with the detailed analysis if available
          const analysis = listingAnalyses[String(i)] || listingAnalyses[i];
          if (analysis && typeof analysis === 'string' && analysis.length > 50) {
            listing.aiReasoning = analysis;
          }
          return listing;
        });
      
      return {
        selectedListings,
        explanation: parsed.explanation || `Here are the ${count} best options based on your criteria.`,
      };
    }
  } catch (error) {
    console.error("Error picking listings with AI:", error);
  }

  // Fallback: sort by criteria mentioned in query
  const lowerQuery = userQuery.toLowerCase();
  const sortedListings = [...listings].sort((a, b) => {
    // Check for area/size filter
    if (lowerQuery.includes("m2") || lowerQuery.includes("m²") || lowerQuery.includes("sqm") || lowerQuery.includes("square")) {
      const areaMatch = userQuery.match(/(\d+)\s*(?:m2|m²|sqm)/i);
      if (areaMatch) {
        const targetArea = parseInt(areaMatch[1]);
        const diffA = Math.abs((a.areaSqm || 0) - targetArea);
        const diffB = Math.abs((b.areaSqm || 0) - targetArea);
        return diffA - diffB; // Closest to target area first
      }
      return (a.areaSqm || 0) - (b.areaSqm || 0);
    }
    // Check for distance/closest
    if (lowerQuery.includes("closest") || lowerQuery.includes("nearest") || lowerQuery.includes("center")) {
      return (a.distanceKm || 999) - (b.distanceKm || 999);
    }
    // Default: sort by price
    return (a.priceEur || 0) - (b.priceEur || 0);
  });

  return {
    selectedListings: sortedListings.slice(0, count),
    explanation: `Here are the ${count} listings that best match your criteria.`,
  };
};

/**
 * Re-export RAG functions for external use
 */
export { indexListings } from "./rag/index";
