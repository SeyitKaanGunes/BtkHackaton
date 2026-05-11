import { describe, expect, it } from "vitest";
import { resolveCategoryFromText } from "./category-resolver.js";

describe("CategoryResolver", () => {
  it.each([
    ["iPhone alırsam", "technology"],
    ["Migros'ta 3000 TL harcarsam", "market"],
    ["Netflix aboneliği zamlanırsa", "subscription"],
    ["Uber'e 500 TL giderse", "transport"],
    ["Kira 15000 TL olursa", "rent_or_bills"],
    ["Starbucks'a 300 TL harcarsam", "food"]
  ])("resolves merchant or product category: %s", (message, expected) => {
    const result = resolveCategoryFromText(message);
    expect(result.category).toBe(expected);
    expect(result.categoryId).toBeTruthy();
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("keeps ambiguous products at medium or low confidence", () => {
    const result = resolveCategoryFromText("kahve makinesi alırsam");
    expect(result.category).toBeUndefined();
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("returns unknown for products outside the dictionary", () => {
    const result = resolveCategoryFromText("koleksiyon figürü alırsam");
    expect(result.category).toBeUndefined();
    expect(result.source).toBe("unknown");
    expect(result.confidence).toBeLessThan(0.5);
  });
});
