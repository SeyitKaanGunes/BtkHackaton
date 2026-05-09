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
    const result = analyzeConsistency(Array.from({ length: 10 }, (_, index) => item(index)), 0.9, "2026-05");
    expect(result.warnings).toEqual([]);
    expect(result.lowConfidenceCount).toBe(0);
    expect(result.sumMismatch).toBe(false);
  });

  it("warns when item count is low", () => {
    const result = analyzeConsistency([item(0), item(1), item(2)], 0.9, "2026-05");
    expect(result.warnings).toContain("Sadece 3 kalem çıktı, eksik ayrıştırma olabilir.");
  });

  it("counts low confidence items", () => {
    const result = analyzeConsistency([item(0, 0.5), item(1, 0.5), item(2), item(3), item(4)], 0.8, "2026-05");
    expect(result.lowConfidenceCount).toBe(2);
    expect(result.warnings).toContain("2 kalemde güven skoru düşük.");
  });

  it("warns when average confidence is low", () => {
    const result = analyzeConsistency(Array.from({ length: 5 }, (_, index) => item(index)), 0.4, "2026-05");
    expect(result.warnings.some((warning) => warning.includes("Ortalama güven skoru düşük"))).toBe(true);
    expect(result.sumMismatch).toBe(false);
  });
});
