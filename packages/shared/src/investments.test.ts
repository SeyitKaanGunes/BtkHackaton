import { describe, expect, it } from "vitest";
import { calculateInvestmentPortfolio, createInvestmentHolding, suggestInvestmentSymbols } from "./investments.js";
import type { InvestmentQuote } from "./types.js";

const marketQuotes: InvestmentQuote[] = [
  liveQuote("XAG/USD", 28.4, "USD", "Gümüş Spot / ABD Doları"),
  liveQuote("USD/TRY", 32.4, "TRY", "ABD Doları / Türk Lirası")
];

describe("investment portfolio engine", () => {
  it("values holdings and calculates profit/loss in TRY", () => {
    const holding = createInvestmentHolding({
      symbol: "XAG/USD",
      name: "Gümüş Spot / ABD Doları",
      assetType: "commodity",
      quantity: 10,
      averageCost: 25,
      costCurrency: "USD",
      marketCurrency: "USD"
    });
    const portfolio = calculateInvestmentPortfolio([holding], marketQuotes);

    expect(portfolio.positions[0]?.isPriced).toBe(true);
    expect(portfolio.positions[0]?.marketValueTry).toBeGreaterThan(0);
    expect(portfolio.totalMarketValueTry).toBeGreaterThan(portfolio.totalCostTry);
    expect(portfolio.allocation[0]?.assetType).toBe("commodity");
  });

  it("returns local symbol presets for empty or partial search", () => {
    expect(suggestInvestmentSymbols("altin")[0]?.symbol).toBe("XAU_GRAM_TRY");
    expect(suggestInvestmentSymbols("akbank")[0]?.symbol).toBe("AKBNK");
    expect(suggestInvestmentSymbols("")[0]?.symbol).toBe("THYAO");
  });

  it("projects end-of-day value for cash deposits with annual interest", () => {
    const holding = createInvestmentHolding({
      assetType: "cash",
      name: "Banka mevduati",
      quantity: 36500,
      costCurrency: "TRY",
      annualInterestRate: 10
    });

    const portfolio = calculateInvestmentPortfolio([holding], []);

    expect(holding.symbol).toBe("CASH_TRY");
    expect(portfolio.positions[0]?.isPriced).toBe(true);
    expect(portfolio.totalDailyInterestTry).toBe(10);
    expect(portfolio.projectedEndOfDayValueTry).toBe(36510);
    expect(portfolio.positions[0]?.assetType).toBe("cash");
  });

  it("does not calculate market value or profit/loss from missing prices", () => {
    const holding = createInvestmentHolding({
      symbol: "THYAO",
      name: "Türk Hava Yolları",
      assetType: "stock",
      quantity: 10,
      averageCost: 100,
      costCurrency: "TRY",
      marketCurrency: "TRY"
    });

    const portfolio = calculateInvestmentPortfolio([holding], []);

    expect(portfolio.positions[0]?.isPriced).toBe(false);
    expect(portfolio.totalMarketValueTry).toBe(0);
    expect(portfolio.totalProfitLossTry).toBe(0);
    expect(portfolio.hasMarketDataGap).toBe(true);
    expect(portfolio.warning).toContain("piyasa verisi alınamadı");
  });
});

function liveQuote(symbol: string, price: number, currency: string, name: string): InvestmentQuote {
  return {
    symbol,
    name,
    price,
    currency,
    updatedAt: "2026-01-01T00:00:00.000Z",
    source: "twelve_data",
    isStale: false
  };
}
