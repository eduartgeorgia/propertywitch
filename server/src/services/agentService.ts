/**
 * Agent Service - Multi-step reasoning for complex property queries
 * 
 * Implements a ReAct-style agent that can:
 * - Break down complex queries into steps
 * - Use tools (search, analyze, compare)
 * - Reason about intermediate results
 * - Provide comprehensive responses
 */

import { checkAIHealth, parseQueryWithAI, AIMessage } from "./aiService";
import { runSearch } from "./searchService";
import type { SearchResponse } from "../types/api";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.3-thinking-claude";

// Agent tools definitions
type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
};

const AGENT_TOOLS: AgentTool[] = [
  {
    name: "search_properties",
    description: "Search for properties in Portugal based on criteria like location, price, property type",
    parameters: {
      query: { type: "string", description: "Natural language search query", required: true },
      location: { type: "string", description: "Location name (city/region in Portugal)" },
      maxPrice: { type: "number", description: "Maximum price in EUR" },
      propertyType: { type: "string", description: "Type: land, apartment, house, villa" },
    },
  },
  {
    name: "analyze_listing",
    description: "Get detailed analysis of a specific listing",
    parameters: {
      listingId: { type: "string", description: "The listing ID to analyze", required: true },
    },
  },
  {
    name: "compare_listings",
    description: "Compare multiple listings side by side",
    parameters: {
      listingIds: { type: "array", description: "Array of listing IDs to compare", required: true },
    },
  },
  {
    name: "get_market_info",
    description: "Get market information about a region in Portugal",
    parameters: {
      region: { type: "string", description: "Region name (e.g., Algarve, Lisbon, Porto)", required: true },
    },
  },
  {
    name: "calculate_costs",
    description: "Calculate total costs including taxes and fees for a property purchase",
    parameters: {
      price: { type: "number", description: "Property price in EUR", required: true },
      isResident: { type: "boolean", description: "Whether buyer is Portuguese resident" },
    },
  },
];

// Agent step types
type AgentThought = {
  type: "thought";
  content: string;
};

type AgentAction = {
  type: "action";
  tool: string;
  input: Record<string, unknown>;
};

type AgentObservation = {
  type: "observation";
  content: string;
  data?: unknown;
};

type AgentFinalAnswer = {
  type: "final_answer";
  content: string;
};

type AgentStep = AgentThought | AgentAction | AgentObservation | AgentFinalAnswer;

export type AgentResult = {
  steps: AgentStep[];
  finalAnswer: string;
  searchResults?: SearchResponse;
  toolsUsed: string[];
  reasoning: string;
};

// Store for current agent session data
let currentSearchResults: SearchResponse | null = null;

const AGENT_SYSTEM_PROMPT = `You are an intelligent property search agent for Portugal. You help users find properties by breaking down their requests and using available tools.

AVAILABLE TOOLS:
${AGENT_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')}

RESPONSE FORMAT:
You must respond in this exact format for each step:

THOUGHT: [Your reasoning about what to do next]
ACTION: [tool_name]
INPUT: [JSON object with tool parameters]

After receiving observations, continue with more thoughts/actions until you have enough information.
When ready to give final answer:

THOUGHT: [Final reasoning]
FINAL_ANSWER: [Your comprehensive response to the user]

RULES:
1. Always start with a THOUGHT
2. Use tools to gather information before answering
3. Be thorough - use multiple searches if needed
4. Compare options when user asks for recommendations
5. Include specific details (prices, locations, sizes) in final answer
6. Keep final answer conversational and helpful

EXAMPLE:
User: "Find me cheap land near Lisbon for building a house"

THOUGHT: User wants building land near Lisbon at a low price. I should search for urban/building plots in the Lisbon area.
ACTION: search_properties
INPUT: {"query": "building land near Lisbon", "location": "Lisbon", "propertyType": "land"}

[After observation]

THOUGHT: I found some results. Let me analyze the best options and provide recommendations.
FINAL_ANSWER: I found X plots of land near Lisbon suitable for building...`;

/**
 * Execute an agent tool
 */
async function executeAgentTool(
  tool: string,
  input: Record<string, unknown>,
  userLocation: { label: string; lat: number; lng: number; currency: string }
): Promise<{ success: boolean; result: unknown; summary: string }> {
  console.log(`[Agent] Executing tool: ${tool}`, input);

  switch (tool) {
    case "search_properties": {
      const query = String(input.query || "property in Portugal");
      const searchResult = await runSearch({
        query,
        userLocation,
      });
      currentSearchResults = searchResult;
      
      const summary = searchResult.listings.length > 0
        ? `Found ${searchResult.listings.length} properties. Top results: ${searchResult.listings.slice(0, 3).map(l => `${l.title} (€${l.priceEur.toLocaleString()})`).join(', ')}`
        : "No properties found matching the criteria.";
      
      return { success: true, result: searchResult, summary };
    }

    case "analyze_listing": {
      const listingId = String(input.listingId);
      const listing = currentSearchResults?.listings.find(l => l.id === listingId);
      
      if (!listing) {
        return { success: false, result: null, summary: `Listing ${listingId} not found in current results` };
      }

      const analysis = `
Listing Analysis for: ${listing.title}
- Price: €${listing.priceEur.toLocaleString()}
- Location: ${listing.locationLabel}
- Area: ${listing.areaSqm ? `${listing.areaSqm} m²` : 'Not specified'}
- Beds: ${listing.beds || 'N/A'}, Baths: ${listing.baths || 'N/A'}
- Distance: ${listing.distanceKm ? `${listing.distanceKm.toFixed(1)} km from your location` : 'N/A'}
- AI Score: ${listing.matchScore}/100
- Source: ${listing.sourceSite}`;

      return { success: true, result: listing, summary: analysis };
    }

    case "compare_listings": {
      const ids = input.listingIds as string[];
      const listings = currentSearchResults?.listings.filter(l => ids.includes(l.id)) || [];
      
      if (listings.length === 0) {
        return { success: false, result: null, summary: "No listings found for comparison" };
      }

      const comparison = listings.map(l => 
        `• ${l.title}: €${l.priceEur.toLocaleString()}, ${l.areaSqm || '?'} m², ${l.locationLabel}`
      ).join('\n');

      return { 
        success: true, 
        result: listings, 
        summary: `Comparing ${listings.length} listings:\n${comparison}` 
      };
    }

    case "get_market_info": {
      const region = String(input.region || input.location || input.area || "portugal").toLowerCase();
      
      // Market info based on region (simplified - could be enhanced with real data)
      const marketData: Record<string, string> = {
        portugal: "Portugal: Growing real estate market. Average prices vary by region: Lisbon €4,000-6,000/m², Porto €2,500-4,000/m², Algarve €2,500-4,000/m², Alentejo €500-1,500/m². Foreign buyers welcome. IMT tax 0-8%, Stamp duty 0.8%.",
        algarve: "Algarve: Popular tourist region in southern Portugal. Average property prices €2,500-4,000/m². High rental demand. Golden Visa eligible for investments over €500k.",
        lisbon: "Lisbon: Capital city with strong economy. Average prices €4,000-6,000/m² in city center. High demand, competitive market. Good rental yields 4-6%.",
        porto: "Porto: Second largest city, growing tech hub. Average prices €2,500-4,000/m². Strong appreciation potential. UNESCO historic center.",
        alentejo: "Alentejo: Rural region, affordable land. Average €500-1,500/m². Large plots available. Good for agriculture or rural tourism.",
        "silver coast": "Silver Coast: Beach communities north of Lisbon. €1,500-3,000/m². Popular with expats. Good value compared to Algarve.",
        madeira: "Madeira: Atlantic island, subtropical climate. €2,000-3,500/m². Limited land availability. Strong tourism sector.",
      };

      const info = marketData[region] || `${region}: Contact local agents for market information.`;
      return { success: true, result: { region, info }, summary: info };
    }

    case "calculate_costs": {
      // Accept various price field names the AI might use
      const price = Number(input.price || input.purchase_price || input.property_price || input.amount || 0);
      const isResident = Boolean(input.isResident || input.is_resident);
      
      if (!price || isNaN(price)) {
        return { success: false, result: null, summary: "Please provide a valid property price" };
      }
      
      // IMT (property transfer tax) calculation - simplified progressive rates
      let imtRate = 0;
      if (price <= 97064) imtRate = 0;
      else if (price <= 132774) imtRate = 0.02;
      else if (price <= 181034) imtRate = 0.05;
      else if (price <= 301688) imtRate = 0.07;
      else if (price <= 578598) imtRate = 0.08;
      else imtRate = 0.06; // Single rate for high values

      const imt = price * imtRate;
      const stampDuty = price * 0.008; // 0.8% stamp duty
      const notaryFees = Math.min(price * 0.01, 2000); // ~1% capped
      const registryFees = 250;
      const legalFees = Math.max(price * 0.01, 1500); // ~1% minimum €1,500
      
      const totalCosts = imt + stampDuty + notaryFees + registryFees + legalFees;
      const totalPrice = price + totalCosts;

      const summary = `
Cost Calculation for €${price.toLocaleString()} property:
- IMT (Transfer Tax): €${imt.toLocaleString()} (${(imtRate * 100).toFixed(1)}%)
- Stamp Duty: €${stampDuty.toLocaleString()} (0.8%)
- Notary Fees: €${notaryFees.toLocaleString()}
- Registry Fees: €${registryFees.toLocaleString()}
- Legal Fees (est.): €${legalFees.toLocaleString()}
─────────────────────
Total Additional Costs: €${totalCosts.toLocaleString()}
TOTAL PRICE: €${totalPrice.toLocaleString()}`;

      return { 
        success: true, 
        result: { price, totalCosts, totalPrice, breakdown: { imt, stampDuty, notaryFees, registryFees, legalFees } },
        summary 
      };
    }

    default:
      return { success: false, result: null, summary: `Unknown tool: ${tool}` };
  }
}

/**
 * Parse agent response to extract thought/action/final_answer
 */
function parseAgentResponse(response: string): AgentStep[] {
  const steps: AgentStep[] = [];
  
  // Extract THOUGHT
  const thoughtMatch = response.match(/THOUGHT:\s*(.+?)(?=ACTION:|FINAL_ANSWER:|$)/is);
  if (thoughtMatch) {
    steps.push({ type: "thought", content: thoughtMatch[1].trim() });
  }

  // Extract ACTION and INPUT
  const actionMatch = response.match(/ACTION:\s*(\w+)/i);
  const inputMatch = response.match(/INPUT:\s*(\{[\s\S]*?\})/i);
  
  if (actionMatch) {
    let input = {};
    if (inputMatch) {
      try {
        input = JSON.parse(inputMatch[1]);
      } catch {
        console.log("[Agent] Failed to parse INPUT JSON");
      }
    }
    steps.push({ type: "action", tool: actionMatch[1], input });
  }

  // Extract FINAL_ANSWER
  const finalMatch = response.match(/FINAL_ANSWER:\s*([\s\S]+?)$/i);
  if (finalMatch) {
    steps.push({ type: "final_answer", content: finalMatch[1].trim() });
  }

  return steps;
}

/**
 * Call AI with agent prompt
 */
async function callAgentAI(
  messages: AIMessage[],
  backend: string
): Promise<string> {
  if (backend === "groq" && DEEPSEEK_API_KEY) {
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Check for rate limit - fallback to Ollama
        if (response.status === 429) {
          console.log("[Agent] DeepSeek rate limit hit, falling back to Ollama...");
          return callAgentAI(messages, "ollama");
        }
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (error) {
      // On any DeepSeek error, try Ollama fallback
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('429') || errorMsg.includes('rate') || errorMsg.includes('limit')) {
        console.log("[Agent] DeepSeek error, falling back to Ollama...");
        return callAgentAI(messages, "ollama");
      }
      throw error;
    }
  }

  if (backend === "ollama") {
    const systemMsg = messages.find(m => m.role === "system")?.content || "";
    const otherMsgs = messages.filter(m => m.role !== "system");
    
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: systemMsg },
          ...otherMsgs.map(m => ({ role: m.role, content: m.content }))
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || "";
  }

  if (backend === "claude" && ANTHROPIC_API_KEY) {
    const systemMsg = messages.find(m => m.role === "system")?.content || "";
    const otherMsgs = messages.filter(m => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemMsg,
        messages: otherMsgs.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  }

  throw new Error("No AI backend available for agent");
}

/**
 * Run the agent with multi-step reasoning
 */
export async function runAgent(
  userQuery: string,
  userLocation: { label: string; lat: number; lng: number; currency: string },
  maxSteps: number = 5
): Promise<AgentResult> {
  const health = await checkAIHealth();
  
  if (!health.available) {
    // Fallback to simple search without agent
    const searchResult = await runSearch({ query: userQuery, userLocation });
    return {
      steps: [{ type: "thought", content: "AI agent unavailable, performing direct search" }],
      finalAnswer: `Found ${searchResult.listings.length} properties matching your search.`,
      searchResults: searchResult,
      toolsUsed: ["search_properties"],
      reasoning: "Direct search fallback",
    };
  }

  const steps: AgentStep[] = [];
  const toolsUsed: string[] = [];
  let messages: AIMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: userQuery },
  ];

  console.log(`[Agent] Starting multi-step reasoning for: "${userQuery}"`);

  for (let i = 0; i < maxSteps; i++) {
    console.log(`[Agent] Step ${i + 1}/${maxSteps}`);
    
    // Get AI response
    const response = await callAgentAI(messages, health.backend);
    console.log(`[Agent] AI response:`, response.slice(0, 200));

    // Parse the response
    const parsedSteps = parseAgentResponse(response);
    steps.push(...parsedSteps);

    // Check for final answer
    const finalAnswer = parsedSteps.find(s => s.type === "final_answer") as AgentFinalAnswer | undefined;
    if (finalAnswer) {
      console.log(`[Agent] Got final answer after ${i + 1} steps`);
      return {
        steps,
        finalAnswer: finalAnswer.content,
        searchResults: currentSearchResults || undefined,
        toolsUsed,
        reasoning: steps.filter(s => s.type === "thought").map(s => (s as AgentThought).content).join(" → "),
      };
    }

    // Execute action if present
    const action = parsedSteps.find(s => s.type === "action") as AgentAction | undefined;
    if (action) {
      toolsUsed.push(action.tool);
      const result = await executeAgentTool(action.tool, action.input, userLocation);
      
      const observation: AgentObservation = {
        type: "observation",
        content: result.summary,
        data: result.result,
      };
      steps.push(observation);

      // Add to messages for next iteration
      messages.push({ role: "assistant", content: response });
      messages.push({ role: "user", content: `OBSERVATION: ${result.summary}` });
    } else {
      // No action and no final answer - something went wrong
      console.log("[Agent] No action or final answer found, breaking loop");
      break;
    }
  }

  // Max steps reached without final answer
  console.log("[Agent] Max steps reached, generating summary");
  const summaryAnswer = currentSearchResults 
    ? `I found ${currentSearchResults.listings.length} properties. ${currentSearchResults.listings.slice(0, 3).map(l => `${l.title} at €${l.priceEur.toLocaleString()}`).join(', ')}.`
    : "I wasn't able to complete the search. Please try a simpler query.";

  return {
    steps,
    finalAnswer: summaryAnswer,
    searchResults: currentSearchResults || undefined,
    toolsUsed,
    reasoning: steps.filter(s => s.type === "thought").map(s => (s as AgentThought).content).join(" → "),
  };
}

/**
 * Check if a query should use agent (complex query) vs simple search
 */
export function shouldUseAgent(query: string): boolean {
  const complexPatterns = [
    /compare|versus|vs|better|which/i,
    /recommend|suggest|advice|help me choose/i,
    /best|cheapest|most|least/i,
    /and also|as well as|plus/i,
    /first.+then|after that|also need/i,
    /what.+cost|how much.+total|calculate/i,
    /market|investment|rental yield/i,
    /multiple|several|few|some options/i,
  ];

  return complexPatterns.some(pattern => pattern.test(query));
}
