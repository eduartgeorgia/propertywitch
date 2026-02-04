import type { PriceRange } from "../types/api";
import type { PriceIntent } from "../domain/query";

export type MatchRules = {
  exactTolerancePercent: number;
  exactToleranceAbsoluteEur: number;
  nearMissTolerancePercent: number;
  nearMissToleranceAbsoluteEur: number;
};

const exactDelta = (value: number, rules: MatchRules) =>
  Math.min(value * rules.exactTolerancePercent, rules.exactToleranceAbsoluteEur);

const nearMissDelta = (value: number, rules: MatchRules) =>
  Math.max(value * rules.nearMissTolerancePercent, rules.nearMissToleranceAbsoluteEur);

export const buildStrictPriceRange = (
  intent: PriceIntent,
  currency: string,
  rules: MatchRules
): PriceRange => {
  switch (intent.type) {
    case "under":
      return { max: intent.max, currency };
    case "over":
      return { min: intent.min, currency };
    case "between":
      return { min: intent.min, max: intent.max, currency };
    case "exact":
    case "around": {
      const delta = exactDelta(intent.target, rules);
      return { min: intent.target - delta, max: intent.target + delta, currency };
    }
    case "none":
    default:
      return { currency };
  }
};

export const buildNearMissPriceRange = (
  intent: PriceIntent,
  currency: string,
  rules: MatchRules
): PriceRange => {
  switch (intent.type) {
    case "under": {
      const delta = nearMissDelta(intent.max, rules);
      return { max: intent.max + delta, currency };
    }
    case "over": {
      const delta = nearMissDelta(intent.min, rules);
      return { min: Math.max(0, intent.min - delta), currency };
    }
    case "between": {
      const deltaMin = nearMissDelta(intent.min, rules);
      const deltaMax = nearMissDelta(intent.max, rules);
      return { min: Math.max(0, intent.min - deltaMin), max: intent.max + deltaMax, currency };
    }
    case "exact":
    case "around": {
      const delta = nearMissDelta(intent.target, rules);
      return { min: Math.max(0, intent.target - delta), max: intent.target + delta, currency };
    }
    case "none":
    default:
      return { currency };
  }
};
