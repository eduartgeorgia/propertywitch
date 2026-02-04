"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUserQuery = void 0;
const currencyService_1 = require("./currencyService");
const numberFrom = (value) => {
    const normalized = value.replace(/[, ]/g, "").replace(/\.(?=\d{3})/g, "");
    return Number(normalized);
};
const parseUserQuery = (input) => {
    const raw = input.trim();
    const lower = raw.toLowerCase();
    let priceIntent = { type: "none" };
    const betweenMatch = lower.match(/between\s+([\d.,]+)\s+and\s+([\d.,]+)/);
    if (betweenMatch) {
        priceIntent = {
            type: "between",
            min: numberFrom(betweenMatch[1]),
            max: numberFrom(betweenMatch[2]),
            currency: (0, currencyService_1.guessCurrency)(raw),
        };
    }
    const underMatch = lower.match(/(?:under|below|max|up to)\s+([\d.,]+)/);
    if (!betweenMatch && underMatch) {
        priceIntent = {
            type: "under",
            max: numberFrom(underMatch[1]),
            currency: (0, currencyService_1.guessCurrency)(raw),
        };
    }
    const overMatch = lower.match(/(?:over|above|min|at least)\s+([\d.,]+)/);
    if (!betweenMatch && !underMatch && overMatch) {
        priceIntent = {
            type: "over",
            min: numberFrom(overMatch[1]),
            currency: (0, currencyService_1.guessCurrency)(raw),
        };
    }
    // Only match standalone prices that look like actual prices (>= 1000 or with currency symbols/words)
    // Avoid matching small numbers like "1 apartment" or "2 bedroom"
    const plainPriceMatch = lower.match(/(?:€|£|\$|eur|euro|euros|usd|gbp)\s*([\d.,]+)|([\d.,]+)\s*(?:€|£|\$|eur|euro|euros|usd|gbp)/i)
        || lower.match(/\b([\d]{4,}(?:[.,]\d+)?)\b/); // Only match numbers >= 1000
    if (!betweenMatch && !underMatch && !overMatch && plainPriceMatch) {
        const priceValue = plainPriceMatch[1] || plainPriceMatch[2];
        if (priceValue) {
            priceIntent = {
                type: "exact",
                target: numberFrom(priceValue),
                currency: (0, currencyService_1.guessCurrency)(raw),
            };
        }
    }
    let propertyType;
    if (/(land|plot|terrain|lote)/.test(lower))
        propertyType = "land";
    if (/(apartment|apartamento|apt)/.test(lower))
        propertyType = "apartment";
    if (/(house|villa|casa|moradia)/.test(lower))
        propertyType = "house";
    // Detect if user wants properties for sale or rent
    let listingIntent;
    if (/(for rent|to rent|rental|rentals|arrendar|alugar|aluguer|per month|monthly|\/month|\/mo)/.test(lower)) {
        listingIntent = 'rent';
    }
    else if (/(for sale|to buy|buy|purchase|comprar|venda|à venda)/.test(lower)) {
        listingIntent = 'sale';
    }
    return {
        raw,
        propertyType,
        priceIntent,
        listingIntent,
    };
};
exports.parseUserQuery = parseUserQuery;
