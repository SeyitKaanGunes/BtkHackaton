import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  calculateInvestmentPortfolio,
  deriveGramGoldTry,
  fallbackQuoteFor,
  inferAssetType,
  INVESTMENT_CACHE_TTL_HOURS,
  normalizeSearchText,
  normalizeCurrency,
  roundMoney,
  scoreSymbolMatch,
  suggestInvestmentSymbols,
  symbolSearchText,
  type InvestmentHolding,
  type InvestmentPortfolioSummary,
  type InvestmentQuote,
  type MarketSymbolResult
} from "@fintwin/shared";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  refreshedAt: string;
};

type TwelveDataSymbol = {
  symbol?: string;
  instrument_name?: string;
  name?: string;
  exchange?: string;
  mic_code?: string;
  country?: string;
  currency?: string;
  currency_base?: string;
  currency_quote?: string;
  type?: string;
  instrument_type?: string;
};

@Injectable()
export class TwelveDataService {
  private readonly baseUrl = "https://api.twelvedata.com";
  private readonly ttlMs = INVESTMENT_CACHE_TTL_HOURS * 60 * 60 * 1000;
  private readonly quoteCache = new Map<string, CacheEntry<InvestmentQuote>>();
  private readonly searchCache = new Map<string, CacheEntry<MarketSymbolResult[]>>();
  private readonly catalogCache = new Map<string, CacheEntry<MarketSymbolResult[]>>();

  constructor(private readonly config: ConfigService) {}

  async searchSymbols(query: string): Promise<MarketSymbolResult[]> {
    const normalizedQuery = query.trim();
    const normalizedSearch = normalizeSearchText(normalizedQuery);
    const cacheKey = normalizedSearch || "__all__";
    const cached = this.getCached(this.searchCache, cacheKey);
    if (cached) return cached;

    const [bistCatalog, remoteResults] = await Promise.all([
      this.getBistStockCatalog(),
      normalizedSearch.length >= 2 ? this.searchRemoteSymbols(normalizedQuery) : Promise.resolve([])
    ]);
    const catalogResults = this.searchCatalog(bistCatalog, normalizedSearch, normalizedSearch ? 80 : 40);
    const presetResults = suggestInvestmentSymbols(normalizedQuery, normalizedSearch ? 24 : 12);
    const merged = this.mergeSymbols([...catalogResults, ...presetResults, ...remoteResults]).slice(0, normalizedSearch ? 80 : 40);
    this.setCached(this.searchCache, cacheKey, merged);
    return merged;
  }

  async buildPortfolio(holdings: InvestmentHolding[]): Promise<InvestmentPortfolioSummary> {
    const quotes = await this.quotesForPortfolio(holdings);
    const refreshedAt = quotes.find((item) => item.source === "twelve_data")?.updatedAt ?? new Date().toISOString();
    return calculateInvestmentPortfolio(holdings, quotes, refreshedAt);
  }

  async getQuote(holding: Pick<InvestmentHolding, "symbol" | "name" | "exchange" | "micCode" | "marketCurrency">): Promise<InvestmentQuote> {
    const symbol = holding.symbol.toUpperCase();
    if (symbol.startsWith("CASH_")) return fallbackQuoteFor(holding);
    const cacheKey = `${symbol}:${holding.exchange ?? ""}:${holding.micCode ?? ""}`;
    const cached = this.getCached(this.quoteCache, cacheKey);
    if (cached) return cached;

    const quote = symbol === "XAU_GRAM_TRY" ? await this.getGramGoldTryQuote() : await this.fetchQuote(holding);
    this.setCached(this.quoteCache, cacheKey, quote);
    return quote;
  }

  private async quotesForPortfolio(holdings: InvestmentHolding[]) {
    const baseQuotes = await Promise.all(holdings.map((holding) => this.getQuote(holding)));
    const needsUsd = baseQuotes.some((quote) => normalizeCurrency(quote.currency) === "USD") || holdings.some((holding) => holding.costCurrency === "USD");
    const needsEur = baseQuotes.some((quote) => normalizeCurrency(quote.currency) === "EUR") || holdings.some((holding) => holding.costCurrency === "EUR");
    const fxQuotes: InvestmentQuote[] = [];
    if (needsUsd || !baseQuotes.some((quote) => quote.symbol === "USD/TRY")) {
      fxQuotes.push(await this.getQuote({ symbol: "USD/TRY", name: "US Dollar / Turkish Lira", marketCurrency: "TRY" }));
    }
    if (needsEur) {
      fxQuotes.push(await this.getQuote({ symbol: "EUR/TRY", name: "Euro / Turkish Lira", marketCurrency: "TRY" }));
    }
    return this.mergeQuotes([...baseQuotes, ...fxQuotes]);
  }

  private async getGramGoldTryQuote(): Promise<InvestmentQuote> {
    const [gold, usdTry] = await Promise.all([
      this.getQuote({ symbol: "XAU/USD", name: "Gold Spot / US Dollar", marketCurrency: "USD" }),
      this.getQuote({ symbol: "USD/TRY", name: "US Dollar / Turkish Lira", marketCurrency: "TRY" })
    ]);
    const price = deriveGramGoldTry(gold.price, usdTry.price);
    const percentChange = roundMoney(((gold.percentChange ?? 0) + (usdTry.percentChange ?? 0)) / 2);
    return {
      symbol: "XAU_GRAM_TRY",
      name: "Gram Gold / Turkish Lira",
      price,
      currency: "TRY",
      change: undefined,
      percentChange,
      previousClose: percentChange ? roundMoney(price / (1 + percentChange / 100)) : undefined,
      updatedAt: new Date().toISOString(),
      source: gold.source === "twelve_data" || usdTry.source === "twelve_data" ? "twelve_data" : "fallback",
      isStale: gold.isStale || usdTry.isStale,
      message: "Derived from XAU/USD and USD/TRY"
    };
  }

  private async fetchQuote(holding: Pick<InvestmentHolding, "symbol" | "name" | "exchange" | "micCode" | "marketCurrency">): Promise<InvestmentQuote> {
    const key = this.apiKey();
    const fallback = fallbackQuoteFor(holding);
    if (!key) return { ...fallback, message: "TWELVE_DATA_API_KEY is not configured" };

    const remote = await this.fetchJson(
      this.url("/quote", {
        symbol: holding.symbol,
        exchange: holding.exchange,
        mic_code: holding.micCode,
        apikey: key
      })
    );

    if (!remote || this.hasError(remote)) {
      return { ...fallback, message: this.errorMessage(remote) ?? "Twelve Data quote unavailable" };
    }

    const record = remote as Record<string, unknown>;
    const price = this.numberValue(record.close) ?? this.numberValue(record.price) ?? this.numberValue(record.previous_close);
    if (!price) return { ...fallback, message: "Twelve Data quote did not include a price" };

    const currency = String(record.currency ?? holding.marketCurrency ?? this.currencyFromSymbol(holding.symbol) ?? fallback.currency);
    const updatedAt = typeof record.datetime === "string" ? this.toIsoDate(record.datetime) : new Date().toISOString();
    const percentChange = this.numberValue(record.percent_change);
    return {
      symbol: holding.symbol.toUpperCase(),
      name: String(record.name ?? holding.name ?? fallback.name ?? holding.symbol),
      price,
      currency,
      change: this.numberValue(record.change),
      percentChange,
      previousClose: this.numberValue(record.previous_close),
      exchange: typeof record.exchange === "string" ? record.exchange : holding.exchange,
      updatedAt,
      source: "twelve_data",
      isStale: false
    };
  }

  private mapSymbol(item: TwelveDataSymbol): MarketSymbolResult | undefined {
    if (!item.symbol) return undefined;
    const symbol = item.symbol.toUpperCase();
    return {
      symbol,
      name: item.instrument_name || item.name || symbol,
      assetType: this.assetTypeFromTwelveData(item.type ?? item.instrument_type, symbol),
      currency: item.currency_quote || item.currency || this.currencyFromSymbol(symbol),
      exchange: item.exchange,
      micCode: item.mic_code,
      country: item.country,
      source: "twelve_data"
    };
  }

  private assetTypeFromTwelveData(type: string | undefined, symbol: string) {
    const normalized = type?.toLowerCase() ?? "";
    if (symbol.includes("XAU") || normalized.includes("gold")) return "gold";
    if (normalized.includes("commodity")) return "commodity";
    if (normalized.includes("digital") || normalized.includes("crypto")) return "crypto";
    if (normalized.includes("physical currency") || symbol.includes("/")) return "forex";
    if (normalized.includes("fund") || normalized.includes("etf")) return "fund";
    if (normalized.includes("stock") || normalized.includes("equity") || normalized.includes("share")) return "stock";
    return inferAssetType(symbol);
  }

  private currencyFromSymbol(symbol: string) {
    const parts = symbol.split("/");
    return parts[1];
  }

  private async getBistStockCatalog(): Promise<MarketSymbolResult[]> {
    const cached = this.getCached(this.catalogCache, "bist");
    if (cached) return cached;

    const remote = await this.fetchJson(this.url("/stocks", { exchange: "BIST" }));
    const data = this.arrayFromResponse<TwelveDataSymbol>(remote)
      .map((item) => this.mapSymbol(item))
      .filter((item): item is MarketSymbolResult => Boolean(item && item.assetType === "stock" && item.exchange === "BIST"));
    const fallback = suggestInvestmentSymbols("", 60).filter((item) => item.exchange === "BIST");
    const catalog = this.mergeSymbols([...data, ...fallback]);
    this.setCached(this.catalogCache, "bist", catalog);
    return catalog;
  }

  private searchCatalog(catalog: MarketSymbolResult[], normalizedQuery: string, limit: number) {
    if (!normalizedQuery) return catalog.slice(0, limit);
    return catalog
      .filter((item) => symbolSearchText(item).includes(normalizedQuery))
      .sort((left, right) => scoreSymbolMatch(left, normalizedQuery) - scoreSymbolMatch(right, normalizedQuery))
      .slice(0, limit);
  }

  private async searchRemoteSymbols(query: string): Promise<MarketSymbolResult[]> {
    const urls = [
      this.url("/symbol_search", { symbol: query, exchange: "BIST" }),
      this.url("/symbol_search", { symbol: query })
    ];
    const responses = await Promise.all(urls.map((url) => this.fetchJson(url)));
    return this.mergeSymbols(
      responses.flatMap((response) =>
        this.arrayFromResponse<TwelveDataSymbol>(response)
          .map((item) => this.mapSymbol(item))
          .filter((item): item is MarketSymbolResult => Boolean(item))
      )
    ).slice(0, 24);
  }

  private async fetchJson(url: URL): Promise<unknown> {
    try {
      const response = await fetch(url);
      if (!response.ok) return { status: "error", message: `HTTP ${response.status}` };
      return await response.json();
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Network error" };
    }
  }

  private url(path: string, params: Record<string, string | undefined>) {
    const url = new URL(path, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    return url;
  }

  private arrayFromResponse<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (Array.isArray(record.data)) return record.data as T[];
    }
    return [];
  }

  private numberValue(value: unknown): number | undefined {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private hasError(value: unknown) {
    return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).status === "error");
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object") return undefined;
    const message = (value as Record<string, unknown>).message;
    return typeof message === "string" ? message : undefined;
  }

  private toIsoDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  private mergeSymbols(items: MarketSymbolResult[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.symbol}:${item.exchange ?? ""}:${item.micCode ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private mergeQuotes(items: InvestmentQuote[]) {
    const map = new Map<string, InvestmentQuote>();
    items.forEach((item) => map.set(item.symbol.toUpperCase(), item));
    return Array.from(map.values());
  }

  private getCached<T>(cache: Map<string, CacheEntry<T>>, key: string) {
    const entry = cache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) return undefined;
    return entry.data;
  }

  private setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
    cache.set(key, { data, expiresAt: Date.now() + this.ttlMs, refreshedAt: new Date().toISOString() });
  }

  private apiKey() {
    return this.config.get<string>("TWELVE_DATA_API_KEY") ?? process.env.TWELVE_DATA_API_KEY;
  }
}
