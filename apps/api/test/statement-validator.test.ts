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

  it("drops items with empty category", () => {
    const result = validateItems([{ ...validItem, categoryName: "" }]);
    expect(result.valid).toEqual([]);
    expect(result.warnings[0]).toContain("categoryName boş");
  });

  it("drops invalid payment methods", () => {
    const result = validateItems([{ ...validItem, paymentMethod: "btc" }]);
    expect(result.valid).toEqual([]);
    expect(result.warnings[0]).toContain("paymentMethod geçersiz");
  });

  it("drops invalid confidence values", () => {
    const result = validateItems([{ ...validItem, confidence: 1.5 }]);
    expect(result.valid).toEqual([]);
    expect(result.warnings[0]).toContain("confidence geçersiz");
  });
});
