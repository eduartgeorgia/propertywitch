"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnoseSite = void 0;
const fetchWithTimeout = async (url, timeoutMs = 3500) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; PropertyAssistant/0.1; +https://localhost)",
            },
        });
        return response;
    }
    finally {
        clearTimeout(timeout);
    }
};
const probeApi = async (policy) => {
    // OLX Portugal has a public JSON API
    if (policy.id === "olx") {
        try {
            const response = await fetchWithTimeout("https://www.olx.pt/api/v1/offers?limit=1");
            if (response.ok) {
                const data = await response.json();
                return Array.isArray(data?.data);
            }
        }
        catch {
            return false;
        }
    }
    return false;
};
const probeSitemap = async (policy) => {
    try {
        const response = await fetchWithTimeout(`${policy.baseUrl}/sitemap.xml`);
        return response.ok;
    }
    catch {
        return false;
    }
};
const robotsAllows = async (policy) => {
    try {
        const response = await fetchWithTimeout(`${policy.baseUrl}/robots.txt`);
        if (!response.ok)
            return false;
        const body = await response.text();
        const lower = body.toLowerCase();
        if (lower.includes("disallow: /"))
            return false;
        return true;
    }
    catch {
        return false;
    }
};
const probePublicHtml = async (policy) => {
    const robotsOk = await robotsAllows(policy);
    if (!robotsOk)
        return false;
    try {
        const response = await fetchWithTimeout(policy.baseUrl);
        return response.ok;
    }
    catch {
        return false;
    }
};
const diagnoseSite = async (policy) => {
    for (const method of policy.order) {
        if (method === "API" && policy.allowed.api) {
            if (await probeApi(policy)) {
                return {
                    siteId: policy.id,
                    siteName: policy.name,
                    accessMethod: "API",
                    requiresUserSession: false,
                    reason: "API access available",
                };
            }
        }
        if (method === "SITEMAP" && policy.allowed.sitemap) {
            if (await probeSitemap(policy)) {
                return {
                    siteId: policy.id,
                    siteName: policy.name,
                    accessMethod: "SITEMAP",
                    requiresUserSession: false,
                    reason: "Sitemap accessible",
                };
            }
        }
        if (method === "PUBLIC_HTML" && policy.allowed.publicHtml) {
            if (await probePublicHtml(policy)) {
                return {
                    siteId: policy.id,
                    siteName: policy.name,
                    accessMethod: "PUBLIC_HTML",
                    requiresUserSession: false,
                    reason: "Public HTML allowed",
                };
            }
        }
        if (method === "BYOC" && policy.allowed.byoc) {
            return {
                siteId: policy.id,
                siteName: policy.name,
                accessMethod: "BYOC",
                requiresUserSession: true,
                reason: "Requires user-authenticated browsing",
            };
        }
    }
    return {
        siteId: policy.id,
        siteName: policy.name,
        accessMethod: "NONE",
        requiresUserSession: false,
        reason: "No compliant access method found",
    };
};
exports.diagnoseSite = diagnoseSite;
