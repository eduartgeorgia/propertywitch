"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const searchService_1 = require("../services/searchService");
const router = (0, express_1.Router)();
const searchSchema = zod_1.z.object({
    query: zod_1.z.string().min(3),
    userLocation: zod_1.z.object({
        label: zod_1.z.string().min(2),
        lat: zod_1.z.number(),
        lng: zod_1.z.number(),
        currency: zod_1.z.string().min(3),
    }),
});
router.post("/search", async (req, res) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const request = {
            query: parsed.data.query,
            userLocation: parsed.data.userLocation,
        };
        const response = await (0, searchService_1.runSearch)(request);
        return res.json(response);
    }
    catch (error) {
        return res.status(500).json({ error: String(error) });
    }
});
exports.default = router;
