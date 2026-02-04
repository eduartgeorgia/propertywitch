import { FX_RATES } from "../config";

const normalize = (currency: string) => currency.trim().toUpperCase();

export const toEur = (amount: number, currency: string): number => {
  const code = normalize(currency);
  if (code === "EUR") return amount;
  if (code === "USD") return amount * FX_RATES.USD_EUR;
  if (code === "GBP") return amount * FX_RATES.GBP_EUR;
  throw new Error(`Unsupported currency: ${currency}`);
};

export const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
};

export const guessCurrency = (text: string): string | undefined => {
  const lower = text.toLowerCase();
  if (lower.includes("usd") || lower.includes("$") || lower.includes("us$")) return "USD";
  if (lower.includes("eur") || lower.includes("€")) return "EUR";
  if (lower.includes("gbp") || lower.includes("£")) return "GBP";
  return undefined;
};
