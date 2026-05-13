export type PortfolioFormMode = "overview" | "add";

export const MARKET_SYMBOL_MIN_SEARCH_LENGTH = 2;

type MarketSymbolSearchInput = {
  mode: PortfolioFormMode;
  isCash: boolean;
  query: string;
};

export function normalizeMarketSymbolQuery(query: string): string {
  return query.trim();
}

export function shouldSearchMarketSymbols({ mode, isCash, query }: MarketSymbolSearchInput): boolean {
  return mode === "add" && !isCash && normalizeMarketSymbolQuery(query).length >= MARKET_SYMBOL_MIN_SEARCH_LENGTH;
}
