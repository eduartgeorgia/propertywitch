"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guessCurrency = exports.formatCurrency = exports.toEur = void 0;
const config_1 = require("../config");
const normalize = (currency) => currency.trim().toUpperCase();
const toEur = (amount, currency) => {
    const code = normalize(currency);
    if (code === "EUR")
        return amount;
    if (code === "USD")
        return amount * config_1.FX_RATES.USD_EUR;
    if (code === "GBP")
        return amount * config_1.FX_RATES.GBP_EUR;
    throw new Error(`Unsupported currency: ${currency}`);
};
exports.toEur = toEur;
const formatCurrency = (amount, currency) => {
    try {
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: currency.toUpperCase(),
            maximumFractionDigits: 0,
        }).format(amount);
    }
    catch {
        return `${amount.toFixed(0)} ${currency}`;
    }
};
exports.formatCurrency = formatCurrency;
const guessCurrency = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("usd") || lower.includes("$") || lower.includes("us$"))
        return "USD";
    if (lower.includes("eur") || lower.includes("€"))
        return "EUR";
    if (lower.includes("gbp") || lower.includes("£"))
        return "GBP";
    return undefined;
};
exports.guessCurrency = guessCurrency;
