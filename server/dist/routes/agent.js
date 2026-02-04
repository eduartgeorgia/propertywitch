"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const agentService_1 = require("../services/agentService");
const router = (0, express_1.Router)();
const agentSchema = zod_1.z.object({
    query: zod_1.z.string().min(1),
    userLocation: zod_1.z.object({
        label: zod_1.z.string().min(2),
        lat: zod_1.z.number(),
        lng: zod_1.z.number(),
        currency: zod_1.z.string().min(3),
    }),
    maxSteps: zod_1.z.number().optional().default(5),
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
    const userLocation = parsed.data.userLocation;
    try {
        console.log(`[Agent Route] Processing: "${query}"`);
        const result = await (0, agentService_1.runAgent)(query, userLocation, maxSteps);
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
    }
    catch (error) {
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
    const useAgent = (0, agentService_1.shouldUseAgent)(query);
    return res.json({
        query,
        useAgent,
        reason: useAgent
            ? "Complex query detected - will use multi-step reasoning"
            : "Simple query - direct search is sufficient",
    });
});
exports.default = router;
