import { describe, expect, it } from "vitest";
import type { StatementPreviewItem } from "@fintwin/shared";
import { analyzeConsistency } from "../src/documents/statement-consistency.js";

function item(index: number, confidence = 0.9): StatementPreviewItem {
  return {
    index,
    merchant: `Merchant ${index}`,
    amount: 100 + index,
    occurredAt: "2026-05-15",
    categoryName: "Diğer",
    paymentMethod: "credit_card",
    confidence
  };
}

describe("analyzeConsistency", () => {
  it("returns no warnings for enough high-confidence items", () => {
    const result = analyzeConsistency({ items: Array.from({ length: 10 }, (_, index) => item(index)), avgConfidence: 0.9, statementMonth: "2026-05" });
    expect(result.warnings).toEqual([]);
    expect(result.lowConfidenceCount).toBe(0);
    expect(result.sumMismatch).toBe(false);
  });

  it("does not warn for a short statement when all candidate lines were extracted", () => {
    const result = analyzeConsistency({ items: [item(0), item(1), item(2)], avgConfidence: 0.9, statementMonth: "2026-05", candidateLineCount: 3 });
    expect(result.warnings).toEqual([]);
  });

  it("warns when many candidate lines are not extracted", () => {
    const result = analyzeConsistency({ items: [item(0), item(1), item(2)], avgConfidence: 0.9, statementMonth: "2026-05", candidateLineCount: 8 });
    expect(result.warnings).toContain("8 aday satırdan 3 kalem çıkarıldı, eksik ayrıştırma olabilir.");
  });

  it("counts low confidence items", () => {
    const result = analyzeConsistency({ items: [item(0, 0.5), item(1, 0.5), item(2), item(3), item(4)], avgConfidence: 0.8, statementMonth: "2026-05" });
    expect(result.lowConfidenceCount).toBe(2);
    expect(result.warnings).toContain("2 kalemde güven skoru düşük.");
  });

  it("warns when average confidence is low", () => {
    const result = analyzeConsistency({ items: Array.from({ length: 5 }, (_, index) => item(index)), avgConfidence: 0.4, statementMonth: "2026-05" });
    expect(result.warnings.some((warning) => warning.includes("Ortalama güven skoru düşük"))).toBe(true);
    expect(result.sumMismatch).toBe(false);
  });

  it("flags a mismatch when extracted item total does not match statement summary total", () => {
    const result = analyzeConsistency({ items: [item(0), item(1)], avgConfidence: 0.9, statementMonth: "2026-05", expectedTotalAmount: 500 });
    expect(result.sumMismatch).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("Ekstre toplamı"))).toBe(true);
  });

  it("accepts small rounding differences in statement summary totals", () => {
    const result = analyzeConsistency({ items: [item(0), item(1)], avgConfidence: 0.9, statementMonth: "2026-05", expectedTotalAmount: 202.5 });
    expect(result.sumMismatch).toBe(false);
  });
});
