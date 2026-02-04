import { Router } from "express";
import { z } from "zod";
import { runAgent, shouldUseAgent } from "../services/agentService";
import type { UserLocation } from "../types/api";

const router = Router();

const agentSchema = z.object({
  query: z.string().min(1),
  userLocation: z.object({
    label: z.string().min(2),
    lat: z.number(),
    lng: z.number(),
    currency: z.string().min(3),
  }),
  maxSteps: z.number().optional().default(5),
});

/**
 * Run agent for complex multi-step queries
 */
router.post("/agent", async (req, res) => {
  const parsed = agentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { query, maxSteps } = parsed.data;
  const userLocation = parsed.data.userLocation as UserLocation;

  try {
    console.log(`[Agent Route] Processing: "${query}"`);
    
    const result = await runAgent(query, userLocation, maxSteps);

    return res.json({
      success: true,
      query,
      result: {
        finalAnswer: result.finalAnswer,
        reasoning: result.reasoning,
        toolsUsed: result.toolsUsed,
        stepsCount: result.steps.length,
        steps: result.steps.map(step => ({
          type: step.type,
          content: step.type === "thought" || step.type === "final_answer" || step.type === "observation" 
            ? step.content 
            : step.type === "action" 
              ? `${step.tool}(${JSON.stringify(step.input)})`
              : null,
        })),
      },
      searchResults: result.searchResults,
    });
  } catch (error) {
    console.error("[Agent Route] Error:", error);
    return res.status(500).json({ error: String(error) });
  }
});

/**
 * Check if query should use agent
 */
router.post("/agent/check", (req, res) => {
  const { query } = req.body;
  
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query is required" });
  }

  const useAgent = shouldUseAgent(query);
  
  return res.json({
    query,
    useAgent,
    reason: useAgent 
      ? "Complex query detected - will use multi-step reasoning"
      : "Simple query - direct search is sufficient",
  });
});

export default router;
