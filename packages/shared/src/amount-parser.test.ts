import { describe, expect, it } from "vitest";
import { parseAmountFromText } from "./amount-parser.js";

describe("AmountParser", () => {
  it.each([
    ["10000 TL telefon alırsam", 10000],
    ["10.000 TL telefon alırsam", 10000],
    ["10 bin TL telefon alırsam", 10000],
    ["2 bin 500 TL harcarsam", 2500],
    ["1.250,50 TL harcarsam", 1250.5],
    ["₺9.999 kulaklık alsam", 9999],
    ["10k laptop alsam", 10000],
    ["2k ayakkabı alsam", 2000],
    ["999 TL kulaklık alsam", 999],
    ["12 Mayıs'ta 3000 TL ödersem", 3000],
    ["3 taksit 4500 TL laptop alsam", 4500]
  ])("parses Turkish amount expression: %s", (message, expected) => {
    const result = parseAmountFromText(message);
    expect(result.value).toBe(expected);
    expect(result.currency).toBe("TRY");
    expect(result.confidence).toBeGreaterThanOrEqual(0.55);
  });

  it.each(["iPhone 15 alsam", "12 Mayıs'ta ödeme yaparsam", "3 taksit laptop alsam", "2024 model telefon alsam"])(
    "does not confuse non-amount numbers with money: %s",
    (message) => {
      const result = parseAmountFromText(message);
      expect(result.value).toBeUndefined();
      expect(result.confidence).toBeLessThan(0.45);
    }
  );

  it("marks default TRY assumptions with lower confidence when currency is omitted", () => {
    const result = parseAmountFromText("15000 harcarsam");
    expect(result.value).toBe(15000);
    expect(result.currency).toBe("TRY");
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.reason).toContain("TRY");
  });
});
