"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sitePolicies_1 = require("../config/sitePolicies");
const diagnosticsService_1 = require("../services/diagnosticsService");
const router = (0, express_1.Router)();
router.get("/diagnostics", async (_req, res) => {
    const diagnostics = await Promise.all(sitePolicies_1.SITE_POLICIES.map((policy) => (0, diagnosticsService_1.diagnoseSite)(policy)));
    return res.json({ diagnostics });
});
exports.default = router;
