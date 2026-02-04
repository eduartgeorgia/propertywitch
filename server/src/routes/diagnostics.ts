import { Router } from "express";
import { SITE_POLICIES } from "../config/sitePolicies";
import { diagnoseSite } from "../services/diagnosticsService";

const router = Router();

router.get("/diagnostics", async (_req, res) => {
  const diagnostics = await Promise.all(
    SITE_POLICIES.map((policy) => diagnoseSite(policy))
  );
  return res.json({ diagnostics });
});

export default router;
