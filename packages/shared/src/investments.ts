import { DEMO_USER_ID } from "./demo-data.js";
import type {
  Currency,
  InvestmentAssetType,
  InvestmentHolding,
  InvestmentHoldingCreateRequest,
  InvestmentPortfolioSummary,
  InvestmentQuote,
  MarketSymbolResult
} from "./types.js";

const OUNCE_TO_GRAMS = 31.1034768;

export const INVESTMENT_CACHE_TTL_HOURS = 24;

export const assetTypeLabels: Record<InvestmentAssetType, string> = {
  stock: "Hisse",
  forex: "Doviz",
  gold: "Altin",
  commodity: "Emtia",
  crypto: "Kripto",
  fund: "Fon",
  other: "Diger"
};

export const investmentSymbolPresets: MarketSymbolResult[] = [
  { symbol: "THYAO", name: "Turk Hava Yollari", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "fallback" },
  { symbol: "ASELS", name: "Aselsan", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "fallback" },
  { symbol: "GARAN", name: "Garanti BBVA", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "fallback" },
  { symbol: "BIMAS", name: "BIM Magazalar", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "fallback" },
  { symbol: "KCHOL", name: "Koc Holding", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "fallback" },
  { symbol: "USD/TRY", name: "US Dollar / Turkish Lira", assetType: "forex", currency: "TRY", source: "fallback" },
  { symbol: "EUR/TRY", name: "Euro / Turkish Lira", assetType: "forex", currency: "TRY", source: "fallback" },
  { symbol: "XAU_GRAM_TRY", name: "Gram Gold / Turkish Lira", assetType: "gold", currency: "TRY", source: "fallback" },
  { symbol: "XAU/USD", name: "Gold Spot / US Dollar", assetType: "gold", currency: "USD", source: "fallback" },
  { symbol: "XAG/USD", name: "Silver Spot / US Dollar", assetType: "commodity", currency: "USD", source: "fallback" },
  { symbol: "BTC/USD", name: "Bitcoin / US Dollar", assetType: "crypto", currency: "USD", source: "fallback" }
];

export const demoInvestmentHoldings: InvestmentHolding[] = [
  createInvestmentHolding({
    symbol: "THYAO",
    name: "Turk Hava Yollari",
    assetType: "stock",
    quantity: 12,
    averageCost: 302,
    costCurrency: "TRY",
    exchange: "BIST",
    micCode: "XIST",
    marketCurrency: "TRY"
  }),
  createInvestmentHolding({
    symbol: "XAU_GRAM_TRY",
    name: "Gram Gold / Turkish Lira",
    assetType: "gold",
    quantity: 5,
    averageCost: 2450,
    costCurrency: "TRY",
    marketCurrency: "TRY"
  })
];

export const fallbackQuotes: InvestmentQuote[] = [
  quote("THYAO", 318.75, "TRY", 1.9, "Turk Hava Yollari"),
  quote("ASELS", 164.3, "TRY", -0.4, "Aselsan"),
  quote("GARAN", 91.85, "TRY", 0.8, "Garanti BBVA"),
  quote("BIMAS", 526.5, "TRY", 0.35, "BIM Magazalar"),
  quote("KCHOL", 196.2, "TRY", -0.25, "Koc Holding"),
  quote("USD/TRY", 32.4, "TRY", 0.1, "US Dollar / Turkish Lira"),
  quote("EUR/TRY", 34.9, "TRY", 0.15, "Euro / Turkish Lira"),
  quote("XAU_GRAM_TRY", 2465, "TRY", 0.55, "Gram Gold / Turkish Lira"),
  quote("XAU/USD", 2365, "USD", 0.35, "Gold Spot / US Dollar"),
  quote("XAG/USD", 28.4, "USD", 0.45, "Silver Spot / US Dollar"),
  quote("BTC/USD", 64200, "USD", 1.2, "Bitcoin / US Dollar")
];

export function createInvestmentHolding(input: InvestmentHoldingCreateRequest, now = new Date().toISOString()): InvestmentHolding {
  const preset = investmentSymbolPresets.find((item) => item.symbol.toUpperCase() === input.symbol.toUpperCase());
  const symbol = input.symbol.trim().toUpperCase();
  return {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: DEMO_USER_ID,
    symbol,
    name: input.name?.trim() || preset?.name || symbol,
    assetType: input.assetType ?? preset?.assetType ?? inferAssetType(symbol),
    quantity: Math.max(0, Number(input.quantity || 0)),
    averageCost: Math.max(0, Number(input.averageCost || 0)),
    costCurrency: input.costCurrency ?? normalizeCurrency(input.marketCurrency) ?? "TRY",
    exchange: input.exchange || preset?.exchange,
    micCode: input.micCode || preset?.micCode,
    marketCurrency: input.marketCurrency || preset?.currency,
    createdAt: now,
    updatedAt: now
  };
}

export function suggestInvestmentSymbols(query: string, limit = 8): MarketSymbolResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return investmentSymbolPresets.slice(0, limit);
  return investmentSymbolPresets
    .filter((item) => `${item.symbol} ${item.name} ${item.assetType} ${assetTypeLabels[item.assetType]}`.toLowerCase().includes(normalized))
    .slice(0, limit);
}

export function inferAssetType(symbol: string): InvestmentAssetType {
  const upper = symbol.toUpperCase();
  if (upper.includes("XAU") || upper.includes("GOLD")) return "gold";
  if (upper.includes("XAG") || upper.includes("SILVER")) return "commodity";
  if (upper.includes("/") && (upper.includes("BTC") || upper.includes("ETH"))) return "crypto";
  if (upper.includes("/")) return "forex";
  return "stock";
}

export function normalizeCurrency(currency?: string): Currency | undefined {
  const value = currency?.toUpperCase();
  if (!value) return undefined;
  if (value.includes("TRY") || value.includes("TURK")) return "TRY";
  if (value.includes("USD") || value.includes("DOLLAR")) return "USD";
  if (value.includes("EUR") || value.includes("EURO")) return "EUR";
  return undefined;
}

export function calculateInvestmentPortfolio(
  holdings: InvestmentHolding[],
  quotes: InvestmentQuote[],
  refreshedAt = new Date().toISOString()
): InvestmentPortfolioSummary {
  const quoteMap = new Map(quotes.map((item) => [item.symbol.toUpperCase(), item]));
  const usdTry = quoteMap.get("USD/TRY")?.price ?? 32.4;
  const eurTry = quoteMap.get("EUR/TRY")?.price ?? 34.9;
  const convertToTry = (amount: number, currency?: string) => {
    const normalized = normalizeCurrency(currency) ?? "TRY";
    if (normalized === "USD") return amount * usdTry;
    if (normalized === "EUR") return amount * eurTry;
    return amount;
  };

  const positions = holdings.map((holding) => {
    const quote = quoteMap.get(holding.symbol.toUpperCase()) ?? fallbackQuoteFor(holding);
    const marketValue = holding.quantity * quote.price;
    const costBasis = holding.quantity * holding.averageCost;
    const marketValueTry = convertToTry(marketValue, quote.currency);
    const costBasisTry = convertToTry(costBasis, holding.costCurrency);
    const profitLossTry = marketValueTry - costBasisTry;
    const profitLossPercent = costBasisTry > 0 ? (profitLossTry / costBasisTry) * 100 : 0;
    return {
      ...holding,
      quote,
      marketValue,
      marketValueTry,
      costBasis,
      costBasisTry,
      profitLossTry,
      profitLossPercent
    };
  });

  const totalMarketValueTry = roundMoney(positions.reduce((total, item) => total + item.marketValueTry, 0));
  const totalCostTry = roundMoney(positions.reduce((total, item) => total + item.costBasisTry, 0));
  const totalProfitLossTry = roundMoney(totalMarketValueTry - totalCostTry);
  const totalProfitLossPercent = totalCostTry > 0 ? roundPercent((totalProfitLossTry / totalCostTry) * 100) : 0;
  const allocation = Object.entries(assetTypeLabels)
    .map(([assetType, label]) => {
      const valueTry = roundMoney(positions.filter((item) => item.assetType === assetType).reduce((total, item) => total + item.marketValueTry, 0));
      return {
        assetType: assetType as InvestmentAssetType,
        label,
        valueTry,
        weight: totalMarketValueTry > 0 ? roundPercent((valueTry / totalMarketValueTry) * 100) : 0
      };
    })
    .filter((item) => item.valueTry > 0);

  return {
    positions,
    totalMarketValueTry,
    totalCostTry,
    totalProfitLossTry,
    totalProfitLossPercent,
    allocation,
    provider: "Twelve Data",
    refreshedAt,
    cacheTtlHours: INVESTMENT_CACHE_TTL_HOURS,
    warning: quotes.some((item) => item.source === "fallback") ? "Bazi fiyatlar demo/fallback veriyle hesaplandi." : undefined
  };
}

export function demoInvestmentPortfolio(): InvestmentPortfolioSummary {
  return calculateInvestmentPortfolio(demoInvestmentHoldings, fallbackQuotes);
}

export function fallbackQuoteFor(holding: Pick<InvestmentHolding, "symbol" | "name" | "marketCurrency">): InvestmentQuote {
  return fallbackQuotes.find((item) => item.symbol.toUpperCase() === holding.symbol.toUpperCase()) ?? quote(holding.symbol, 0, holding.marketCurrency ?? "TRY", 0, holding.name);
}

function quote(symbol: string, price: number, currency: string, percentChange: number, name: string): InvestmentQuote {
  const now = new Date().toISOString();
  const previousClose = price / (1 + percentChange / 100);
  return {
    symbol,
    name,
    price,
    currency,
    change: roundMoney(price - previousClose),
    percentChange,
    previousClose: roundMoney(previousClose),
    updatedAt: now,
    source: "fallback",
    isStale: true,
    message: "Fallback price"
  };
}

export function deriveGramGoldTry(ounceGoldUsd: number, usdTry: number): number {
  return roundMoney((ounceGoldUsd / OUNCE_TO_GRAMS) * usdTry);
}

export function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function roundPercent(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
