import type { AccessMethod, SitePolicy } from "../services/diagnosticsService";

const allow = (methods: AccessMethod[]) => {
  return {
    api: methods.includes("API"),
    sitemap: methods.includes("SITEMAP"),
    publicHtml: methods.includes("PUBLIC_HTML"),
    byoc: methods.includes("BYOC"),
  };
};

export const SITE_POLICIES: SitePolicy[] = [
  {
    id: "olx",
    name: "OLX Portugal",
    baseUrl: "https://www.olx.pt",
    allowed: allow(["API"]),
    order: ["API"],
  },
];
