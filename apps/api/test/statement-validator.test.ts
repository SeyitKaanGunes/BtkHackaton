import { describe, expect, it } from "vitest";
import { validateItems } from "../src/documents/statement-validator.js";

const validItem = {
  merchant: "MIGROS",
  amount: 250.75,
  occurredAt: "2026-05-15",
  categoryName: "Market",
  paymentMethod: "credit_card",
  confidence: 0.8
};

describe("validateItems", () => {
  it("accepts a valid item", () => {
    const result = validateItems([validItem]);
    expect(result.valid).toEqual([validItem]);
    expect(result.warnings).toEqual([]);
  });

  it("drops items with empty merchant", () => {
    const result = validateItems([{ ...validItem, merchant: "" }]);
    expect(result.valid).toEqual([]);
    expect(result.warnings[0]).toContain("merchant boş");
  });

  it("drops non-positive amounts", () => {
    const result = validateItems([{ ...validItem, amount: -50 }, { ...validItem, amount: 0 }]);
    expect(result.valid).toEqual([]);
    expect(result.warnings).toHaveLength(2);
  });

  it("drops invalid date formats", () => {
    const result = validateItems([{ ...validItem, occurredAt: "15/05/2026" }]);
    expect(result.valid).toEqual([]);
    expect(result.warnings[0]).toContain("occurredAt geçersiz");
  });

  it("fills empty category with Diğer", () => {
    const result = validateItems([{ ...validItem, categoryName: "" }]);
    expect(result.valid[0]?.categoryName).toBe("Diğer");
    expect(result.warnings).toEqual([]);
  });

  it("normalizes invalid payment method", () => {
    const result = validateItems([{ ...validItem, paymentMethod: "btc" }]);
    expect(result.valid[0]?.paymentMethod).toBe("credit_card");
  });

  it("clamps confidence to 1", () => {
    const result = validateItems([{ ...validItem, confidence: 1.5 }]);
    expect(result.valid[0]?.confidence).toBe(1);
  });
});
