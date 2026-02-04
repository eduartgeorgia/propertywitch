"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SITE_POLICIES = void 0;
const allow = (methods) => {
    return {
        api: methods.includes("API"),
        sitemap: methods.includes("SITEMAP"),
        publicHtml: methods.includes("PUBLIC_HTML"),
        byoc: methods.includes("BYOC"),
    };
};
exports.SITE_POLICIES = [
    {
        id: "olx",
        name: "OLX Portugal",
        baseUrl: "https://www.olx.pt",
        allowed: allow(["API"]),
        order: ["API"],
    },
];
