import { describe, expect, it } from "vitest";
import { buildFinancialMetadata, calculateDataConfidence, type FinancialDataAvailability } from "./financial-metadata.js";

describe("financial metadata helpers", () => {
  it("returns high confidence for complete financial data", () => {
    const availability: FinancialDataAvailability = {
      hasBalance: true,
      hasTransactions: true,
      hasBudgets: true,
      hasIncome: true,
      hasFixedExpenses: true,
      hasDebtPayments: true,
      hasPlannedSavings: true,
      hasEmergencyBuffer: true
    };

    const metadata = buildFinancialMetadata(availability);
    expect(calculateDataConfidence(availability)).toBe("high");
    expect(metadata.dataConfidence).toBe("high");
    expect(metadata.missingData).toEqual([]);
    expect(metadata.assumptions).toEqual(["Mevcut bakiye, işlem, gelir, bütçe ve sabit gider verileriyle hesaplandı."]);
  });

  it("returns medium confidence when transactions exist but budgets or fixed expenses are missing", () => {
    const metadata = buildFinancialMetadata({
      hasBalance: true,
      hasTransactions: true,
      hasBudgets: false,
      hasIncome: true,
      hasFixedExpenses: false
    });

    expect(metadata.dataConfidence).toBe("medium");
    expect(metadata.missingData).toContain("budgets");
    expect(metadata.missingData).toContain("fixedExpenses");
    expect(metadata.assumptions).toContain("Bu kategori için bütçe tanımlı değil.");
  });

  it("returns low confidence when balance or transactions are missing", () => {
    expect(calculateDataConfidence({ hasBalance: false, hasTransactions: true, hasIncome: false })).toBe("low");
    expect(calculateDataConfidence({ hasBalance: true, hasTransactions: false, hasIncome: true })).toBe("low");
  });

  it("lists all missing fields deterministically", () => {
    const first = buildFinancialMetadata({ hasTransactions: true, hasIncome: true });
    const second = buildFinancialMetadata({ hasTransactions: true, hasIncome: true });

    expect(first).toEqual(second);
    expect(first.missingData).toEqual(["balance", "budgets", "fixedExpenses", "debtPayments", "plannedSavings", "emergencyBuffer"]);
    expect(first.assumptions.length).toBeGreaterThan(0);
  });
});
