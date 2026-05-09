import { describe, expect, it } from "vitest";
import { cleanStatementText } from "../src/documents/statement-line-cleaner.js";

describe("cleanStatementText", () => {
  it("keeps merchant lines with date and amount", () => {
    const result = cleanStatementText("15/05/2026 MIGROS 250,75 TL");
    expect(result.candidateLines).toEqual(["15/05/2026 MIGROS 250,75 TL"]);
    expect(result.droppedCount).toBe(0);
  });

  it("drops Turkish statement summary and banking noise lines", () => {
    const raw = [
      "Dönem borcu 10.000,00 TL",
      "Asgari ödeme tutarı 500,00 TL",
      "Son ödeme tarihi 25/05/2026",
      "Kart numarası 1234 5678",
      "Limit: 50.000 TL",
      "İade 120,00 TL",
      "Faiz 12,00 TL",
      "Bakiye devri 90,00 TL",
      "Sayfa 2",
      "IBAN: TR120006200000000006299999",
      "15/05/2026 MIGROS 250,75 TL"
    ].join("\n");

    const result = cleanStatementText(raw);
    expect(result.candidateLines).toEqual(["15/05/2026 MIGROS 250,75 TL"]);
    expect(result.droppedCount).toBe(10);
  });

  it("drops blank, short and punctuation-only lines", () => {
    const result = cleanStatementText(["", "12", ".....", "abcde", "16.05.2026 BİM 80,50 TL"].join("\n"));
    expect(result.candidateLines).toEqual(["16.05.2026 BİM 80,50 TL"]);
    expect(result.droppedCount).toBe(3);
  });
});
