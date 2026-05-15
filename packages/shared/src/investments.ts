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
  forex: "Döviz",
  gold: "Altın",
  commodity: "Emtia",
  crypto: "Kripto",
  fund: "Fon",
  cash: "Nakit / Mevduat",
  other: "Diğer"
};

export const investmentSymbolPresets: MarketSymbolResult[] = [
  { symbol: "THYAO", name: "Türk Hava Yolları", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "ASELS", name: "Aselsan", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "GARAN", name: "Garanti BBVA", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "BIMAS", name: "BİM Mağazalar", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "KCHOL", name: "Koç Holding", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "AKBNK", name: "Akbank", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "YKBNK", name: "Yapı ve Kredi Bankası", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "ISCTR", name: "Türkiye İş Bankası C", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "SAHOL", name: "Sabancı Holding", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "TUPRS", name: "Tüpraş", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "FROTO", name: "Ford Otosan", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "TOASO", name: "Tofaş Oto Fabrika", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "EREGL", name: "Ereğli Demir Çelik", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "SISE", name: "Türkiye Şişe ve Cam Fabrikaları", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "KOZAL", name: "Koza Altın", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "PETKM", name: "Petkim", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "PGSUS", name: "Pegasus Hava Taşımacılığı", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "TCELL", name: "Turkcell", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "TTKOM", name: "Türk Telekom", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "ENKAI", name: "Enka İnşaat", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "ARCLK", name: "Arçelik", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "VESTL", name: "Vestel", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "MGROS", name: "Migros Ticaret", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "ULKER", name: "Ülker Bisküvi", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "SASA", name: "Sasa Polyester", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "HEKTS", name: "Hektaş", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "GUBRF", name: "Gübre Fabrikaları", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "ASTOR", name: "Astor Enerji", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "CWENE", name: "CW Enerji", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "MIATK", name: "Mia Teknoloji", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "TAVHL", name: "TAV Havalimanları", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "DOAS", name: "Doğuş Otomotiv", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "CCOLA", name: "Coca Cola İçecek", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "AEFES", name: "Anadolu Efes", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "OYAKC", name: "Oyak Çimento", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "KONTR", name: "Kontrolmatik Teknoloji", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "SMRTG", name: "Smart Güneş Enerjisi", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "EKGYO", name: "Emlak Konut GYO", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "ENJSA", name: "Enerjisa Enerji", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "AKSEN", name: "Aksa Enerji", assetType: "stock", currency: "TRY", exchange: "BIST", micCode: "XIST", country: "Turkey", source: "local" },
  { symbol: "USD/TRY", name: "ABD Doları / Türk Lirası", assetType: "forex", currency: "TRY", source: "local" },
  { symbol: "EUR/TRY", name: "Euro / Türk Lirası", assetType: "forex", currency: "TRY", source: "local" },
  { symbol: "XAU_GRAM_TRY", name: "Gram Altın / Türk Lirası", assetType: "gold", currency: "TRY", source: "local" },
  { symbol: "XAU/USD", name: "Altın Spot / ABD Doları", assetType: "gold", currency: "USD", source: "local" },
  { symbol: "XAG/USD", name: "Gümüş Spot / ABD Doları", assetType: "commodity", currency: "USD", source: "local" },
  { symbol: "BTC/USD", name: "Bitcoin / ABD Doları", assetType: "crypto", currency: "USD", source: "local" },
  { symbol: "CASH_TRY", name: "Nakit / Mevduat TRY", assetType: "cash", currency: "TRY", source: "local" },
  { symbol: "CASH_USD", name: "Nakit / Mevduat USD", assetType: "cash", currency: "USD", source: "local" },
  { symbol: "CASH_EUR", name: "Nakit / Mevduat EUR", assetType: "cash", currency: "EUR", source: "local" }
];

export function createInvestmentHolding(input: InvestmentHoldingCreateRequest, now = new Date().toISOString(), userId = ""): InvestmentHolding {
  const inputSymbol = canonicalInvestmentSymbol(input.symbol?.trim().toUpperCase());
  const requestedCurrency = normalizeCurrency(input.marketCurrency) ?? input.costCurrency ?? cashCurrencyFromSymbol(inputSymbol ?? "") ?? "TRY";
  const requestedAssetType = input.assetType;
  const isCash = requestedAssetType === "cash" || isCashSymbol(inputSymbol);
  const symbol = (isCash ? cashSymbolFor(requestedCurrency) : inputSymbol) ?? "";
  const preset = investmentSymbolPresets.find((item) => item.symbol.toUpperCase() === symbol);
  const assetType = input.assetType ?? preset?.assetType ?? inferAssetType(symbol);
  const costCurrency = input.costCurrency ?? normalizeCurrency(input.marketCurrency) ?? presetCurrency(preset) ?? "TRY";
  return {
    id: `inv-${globalThis.crypto.randomUUID()}`,
    userId,
    symbol,
    name: input.name?.trim() || preset?.name || (assetType === "cash" ? cashNameFor(costCurrency) : symbol),
    assetType,
    quantity: Math.max(0, Number(input.quantity || 0)),
    averageCost: Math.max(0, Number(input.averageCost ?? (assetType === "cash" ? 1 : 0))),
    costCurrency,
    exchange: assetType === "cash" ? undefined : input.exchange || preset?.exchange,
    micCode: assetType === "cash" ? undefined : input.micCode || preset?.micCode,
    marketCurrency: assetType === "cash" ? costCurrency : input.marketCurrency || preset?.currency,
    annualInterestRate: sanitizeAnnualInterestRate(input.annualInterestRate),
    createdAt: now,
    updatedAt: now
  };
}

export function suggestInvestmentSymbols(query: string, limit = 8): MarketSymbolResult[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return investmentSymbolPresets.slice(0, limit);
  return investmentSymbolPresets
    .filter((item) => symbolSearchText(item).includes(normalized))
    .sort((left, right) => scoreSymbolMatch(left, normalized) - scoreSymbolMatch(right, normalized))
    .slice(0, limit);
}

export function inferAssetType(symbol: string): InvestmentAssetType {
  const upper = symbol.toUpperCase();
  if (upper.includes("XAU") || upper.includes("GOLD")) return "gold";
  if (upper.includes("XAG") || upper.includes("SILVER")) return "commodity";
  if (upper.includes("/") && (upper.includes("BTC") || upper.includes("ETH"))) return "crypto";
  if (upper.includes("/")) return "forex";
  if (upper.startsWith("CASH_")) return "cash";
  return "stock";
}

function canonicalInvestmentSymbol(symbol?: string): string | undefined {
  if (!symbol) return undefined;
  const upper = symbol.trim().toUpperCase();
  const compactFx = upper.match(/^([A-Z]{3})(TRY|USD|EUR)$/);
  if (compactFx) return `${compactFx[1]}/${compactFx[2]}`;
  return upper;
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
  const fxRateToTry = (currency?: string) => {
    const normalized = normalizeCurrency(currency) ?? "TRY";
    if (normalized === "TRY") return 1;
    const quote = quoteMap.get(`${normalized}/TRY`);
    if (!quote || !hasTrustedPrice(quote) || quote.price <= 0) return undefined;
    return quote.price;
  };
  const convertToTry = (amount: number, currency?: string) => {
    const rate = fxRateToTry(currency);
    return rate === undefined ? undefined : amount * rate;
  };

  const positions = holdings.map((holding) => {
    const rawQuote =
      quoteMap.get(holding.symbol.toUpperCase()) ??
      quoteMap.get(canonicalInvestmentSymbol(holding.symbol) ?? holding.symbol.toUpperCase()) ??
      (isCashSymbol(holding.symbol) ? cashQuoteFor(holding) : unavailableQuoteFor(holding));
    const quote = sanitizeInvestmentQuote(rawQuote);
    const marketValue = holding.quantity * quote.price;
    const costBasis = holding.quantity * holding.averageCost;
    const marketValueTryValue = hasTrustedPrice(quote) ? convertToTry(marketValue, quote.currency) : undefined;
    const costBasisTryValue = convertToTry(costBasis, holding.costCurrency);
    const marketDataMessage = marketDataGapMessage(holding, quote, marketValueTryValue, costBasisTryValue);
    const isPriced = marketDataMessage === undefined;
    const marketValueTry = isPriced ? roundMoney(marketValueTryValue ?? 0) : 0;
    const costBasisTry = roundMoney(costBasisTryValue ?? 0);
    const profitLossTry = isPriced ? roundMoney(marketValueTry - costBasisTry) : 0;
    const profitLossPercent = isPriced && costBasisTry > 0 ? roundPercent((profitLossTry / costBasisTry) * 100) : 0;
    const dailyInterestTry = isPriced ? roundMoney((marketValueTry * (holding.annualInterestRate ?? 0)) / 100 / 365) : 0;
    const projectedEndOfDayValueTry = roundMoney(marketValueTry + dailyInterestTry);
    return {
      ...holding,
      quote,
      isPriced,
      marketDataMessage,
      marketValue,
      marketValueTry,
      costBasis,
      costBasisTry,
      profitLossTry,
      profitLossPercent,
      dailyInterestTry,
      projectedEndOfDayValueTry
    };
  });

  const totalMarketValueTry = roundMoney(positions.reduce((total, item) => total + item.marketValueTry, 0));
  const totalCostTry = roundMoney(positions.reduce((total, item) => total + item.costBasisTry, 0));
  const pricedPositions = positions.filter((item) => item.isPriced);
  const pricedCostTry = roundMoney(pricedPositions.reduce((total, item) => total + item.costBasisTry, 0));
  const totalProfitLossTry = roundMoney(pricedPositions.reduce((total, item) => total + item.profitLossTry, 0));
  const totalProfitLossPercent = pricedCostTry > 0 ? roundPercent((totalProfitLossTry / pricedCostTry) * 100) : 0;
  const totalDailyInterestTry = roundMoney(positions.reduce((total, item) => total + item.dailyInterestTry, 0));
  const projectedEndOfDayValueTry = roundMoney(totalMarketValueTry + totalDailyInterestTry);
  const unpricedPositionCount = positions.length - pricedPositions.length;
  const unpricedCostTry = roundMoney(positions.filter((item) => !item.isPriced).reduce((total, item) => total + item.costBasisTry, 0));
  const marketDataMessages = positions.filter((item) => !item.isPriced).map((item) => `${item.symbol}: Piyasa verisi alınamadı.`);
  const allocation = Object.entries(assetTypeLabels)
    .map(([assetType, label]) => {
      const valueTry = roundMoney(pricedPositions.filter((item) => item.assetType === assetType).reduce((total, item) => total + item.marketValueTry, 0));
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
    totalDailyInterestTry,
    projectedEndOfDayValueTry,
    pricedPositionCount: pricedPositions.length,
    unpricedPositionCount,
    unpricedCostTry,
    hasMarketDataGap: unpricedPositionCount > 0,
    marketDataMessages,
    allocation,
    provider: "Twelve Data",
    refreshedAt,
    cacheTtlHours: INVESTMENT_CACHE_TTL_HOURS,
    warning:
      unpricedPositionCount > 0
        ? `${unpricedPositionCount} pozisyon için piyasa verisi alınamadı; toplam değer ve kar/zarar sadece fiyatlanan pozisyonları içerir.`
        : undefined
  };
}

export function cashQuoteFor(holding: Pick<InvestmentHolding, "symbol" | "name" | "marketCurrency">): InvestmentQuote {
  return {
    symbol: holding.symbol.toUpperCase(),
    name: holding.name,
    price: 1,
    currency: normalizeCurrency(holding.marketCurrency) ?? cashCurrencyFromSymbol(holding.symbol) ?? "TRY",
    change: 0,
    percentChange: 0,
    previousClose: 1,
    updatedAt: new Date().toISOString(),
    source: "user",
    isStale: false,
    message: "User-entered cash balance"
  };
}

export function unavailableQuoteFor(
  holding: Pick<InvestmentHolding, "symbol" | "name" | "marketCurrency">,
  message = "Piyasa verisi alınamadı."
): InvestmentQuote {
  return {
    symbol: holding.symbol.toUpperCase(),
    name: holding.name,
    price: 0,
    currency: normalizeCurrency(holding.marketCurrency) ?? "TRY",
    updatedAt: new Date().toISOString(),
    source: "unavailable",
    isStale: true,
    message
  };
}

export function isCashSymbol(symbol?: string): boolean {
  return Boolean(symbol?.trim().toUpperCase().startsWith("CASH_"));
}

function cashSymbolFor(currency: Currency): string {
  return `CASH_${currency}`;
}

function cashCurrencyFromSymbol(symbol: string): Currency | undefined {
  return normalizeCurrency(symbol.replace("CASH_", ""));
}

function cashNameFor(currency: Currency): string {
  return `Nakit / Mevduat ${currency}`;
}

function presetCurrency(preset?: MarketSymbolResult): Currency | undefined {
  return normalizeCurrency(preset?.currency);
}

function sanitizeAnnualInterestRate(value?: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) return undefined;
  return roundPercent(rate);
}

function hasTrustedPrice(quote: InvestmentQuote): boolean {
  return (quote.source === "twelve_data" || quote.source === "user") && quote.price > 0;
}

function sanitizeInvestmentQuote(quote: InvestmentQuote): InvestmentQuote {
  if (hasTrustedPrice(quote)) return quote;
  return { ...quote, message: "Piyasa verisi alınamadı." };
}

function marketDataGapMessage(
  holding: InvestmentHolding,
  quote: InvestmentQuote,
  marketValueTry: number | undefined,
  costBasisTry: number | undefined
): string | undefined {
  if (!hasTrustedPrice(quote)) return quote.message ?? "Piyasa verisi alınamadı.";
  if (marketValueTry === undefined) return `${quote.currency} kuru alınamadı.`;
  if (costBasisTry === undefined) return `${holding.costCurrency} maliyet kuru alınamadı.`;
  return undefined;
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

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
}

export function symbolSearchText(item: Pick<MarketSymbolResult, "symbol" | "name" | "assetType" | "exchange" | "country">): string {
  return normalizeSearchText(`${item.symbol} ${item.name} ${item.assetType} ${assetTypeLabels[item.assetType]} ${item.exchange ?? ""} ${item.country ?? ""}`);
}

export function scoreSymbolMatch(item: Pick<MarketSymbolResult, "symbol" | "name" | "assetType" | "exchange" | "country">, normalizedQuery: string): number {
  const symbol = normalizeSearchText(item.symbol);
  const name = normalizeSearchText(item.name);
  const asset = normalizeSearchText(`${item.assetType} ${assetTypeLabels[item.assetType]}`);
  if (symbol === normalizedQuery) return 0;
  if (symbol.startsWith(normalizedQuery)) return 1;
  if (asset.includes(normalizedQuery)) return 2;
  if (name.startsWith(normalizedQuery)) return 2;
  if (symbol.includes(normalizedQuery)) return 3;
  if (name.includes(normalizedQuery)) return 4;
  return symbolSearchText(item).includes(normalizedQuery) ? 5 : 9;
}
