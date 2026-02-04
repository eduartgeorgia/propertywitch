"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNearMissPriceRange = exports.buildStrictPriceRange = void 0;
const exactDelta = (value, rules) => Math.min(value * rules.exactTolerancePercent, rules.exactToleranceAbsoluteEur);
const nearMissDelta = (value, rules) => Math.max(value * rules.nearMissTolerancePercent, rules.nearMissToleranceAbsoluteEur);
const buildStrictPriceRange = (intent, currency, rules) => {
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
exports.buildStrictPriceRange = buildStrictPriceRange;
const buildNearMissPriceRange = (intent, currency, rules) => {
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
exports.buildNearMissPriceRange = buildNearMissPriceRange;
