import type { Currency } from "@fintwin/shared";

const currencyMeta: Record<Currency, { symbol: string; suffix?: string }> = {
  TRY: { symbol: "₺" },
  USD: { symbol: "$" },
  EUR: { symbol: "€" }
};

export function formatCurrency(value: number, currency: Currency | string = "TRY", options?: { maximumFractionDigits?: number }) {
  const normalized = normalizeCurrency(currency);
  const meta = currencyMeta[normalized];
  const formatted = Number.isFinite(value)
    ? value.toLocaleString("tr-TR", {
        maximumFractionDigits: options?.maximumFractionDigits ?? (Math.abs(value) % 1 === 0 ? 0 : 2),
        minimumFractionDigits: 0
      })
    : "0";
  return meta.suffix ? `${meta.symbol}${formatted} ${meta.suffix}` : `${meta.symbol}${formatted}`;
}

export function formatCurrencyText(text: string) {
  return text.replace(/(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*TL\b/g, "₺$1");
}

function normalizeCurrency(currency: Currency | string): Currency {
  if (currency === "USD" || currency === "EUR" || currency === "TRY") return currency;
  return "TRY";
}
