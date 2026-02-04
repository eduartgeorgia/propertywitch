"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SITE_ORDER = exports.FX_RATES = exports.MATCH_RULES = exports.APP_CONFIG = void 0;
const dotenv_1 = require("dotenv");
const node_path_1 = __importDefault(require("node:path"));
(0, dotenv_1.config)();
const projectRoot = process.cwd();
const toBool = (value, fallback) => {
    if (value === undefined)
        return fallback;
    return value === "1" || value.toLowerCase() === "true";
};
exports.APP_CONFIG = {
    port: Number(process.env.PORT ?? 4000),
    mockData: toBool(process.env.MOCK_DATA, false), // Use real OLX API data
    reportsDir: node_path_1.default.resolve(projectRoot, process.env.REPORTS_DIR ?? "reports"),
};
exports.MATCH_RULES = {
    exactTolerancePercent: 0.02,
    exactToleranceAbsoluteEur: 50,
    nearMissTolerancePercent: 0.1,
    nearMissToleranceAbsoluteEur: 200,
    strictRadiusKm: 50,
    nearMissRadiusKm: 50,
};
exports.FX_RATES = {
    USD_EUR: Number(process.env.FX_RATE_USD_EUR ?? 0.92),
    GBP_EUR: Number(process.env.FX_RATE_GBP_EUR ?? 1.17),
};
exports.SITE_ORDER = [
    "idealista",
    "kyero",
    "supercasa",
    "pureportugal",
    "imovirtual",
    "olx",
];
