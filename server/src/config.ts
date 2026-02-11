import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv();

const projectRoot = process.cwd();

const toBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
};

export const APP_CONFIG = {
  port: Number(process.env.PORT ?? 4000),
  mockData: toBool(process.env.MOCK_DATA, false), // Use real OLX API data
  reportsDir: path.resolve(projectRoot, process.env.REPORTS_DIR ?? "reports"),
};

export const MATCH_RULES = {
  exactTolerancePercent: 0.02,
  exactToleranceAbsoluteEur: 50,
  nearMissTolerancePercent: 0.1,
  nearMissToleranceAbsoluteEur: 200,
  // Disabled geo filtering - this app searches Portugal from anywhere in the world
  // Set to 99999 to effectively disable the radius filter
  strictRadiusKm: 99999,
  nearMissRadiusKm: 99999,
};

export const FX_RATES = {
  USD_EUR: Number(process.env.FX_RATE_USD_EUR ?? 0.92),
  GBP_EUR: Number(process.env.FX_RATE_GBP_EUR ?? 1.17),
};

export const SITE_ORDER = [
  "idealista",
  "imovirtual",
  "casasapo",
  "supercasa",
  "remax",
  "era",
  "century21",
  "olx",
  "google",
];

// Google Custom Search API for searching Idealista, Imovirtual, etc.
export const GOOGLE_SEARCH = {
  apiKey: process.env.GOOGLE_SEARCH_API_KEY || "AIzaSyDr8ZReRh86y9bU8RNenqPKzrYXASB-DPs",
  // Create a Programmable Search Engine at: https://programmablesearchengine.google.com/
  // Configure it to search: idealista.pt, imovirtual.com, casasapo.pt, supercasa.pt, remax.pt, era.pt, century21.pt
  searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID || "000130217441617313365:ubwok8z0tna",
};
