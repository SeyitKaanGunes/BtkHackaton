import { describe, expect, it } from "vitest";
import { calculateInvestmentPortfolio, createInvestmentHolding, fallbackQuotes, suggestInvestmentSymbols } from "./investments.js";

describe("investment portfolio engine", () => {
  it("values holdings and calculates profit/loss in TRY", () => {
    const holding = createInvestmentHolding({
      symbol: "XAG/USD",
      name: "Silver Spot / US Dollar",
      assetType: "commodity",
      quantity: 10,
      averageCost: 25,
      costCurrency: "USD",
      marketCurrency: "USD"
    });
    const portfolio = calculateInvestmentPortfolio([holding], fallbackQuotes);

    expect(portfolio.positions[0]?.marketValueTry).toBeGreaterThan(0);
    expect(portfolio.totalMarketValueTry).toBeGreaterThan(portfolio.totalCostTry);
    expect(portfolio.allocation[0]?.assetType).toBe("commodity");
  });

  it("returns local symbol presets for empty or partial search", () => {
    expect(suggestInvestmentSymbols("altin")[0]?.symbol).toBe("XAU_GRAM_TRY");
    expect(suggestInvestmentSymbols("")[0]?.symbol).toBe("THYAO");
  });
});
