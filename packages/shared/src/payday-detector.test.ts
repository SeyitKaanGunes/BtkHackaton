import { describe, expect, it } from "vitest";
import { calculatePaydayReflexScore, detectPayday, type PaydayTransactionInput } from "./payday-detector.js";

describe("payday detector", () => {
  it("detects payday on the 1st when income repeats for 3 months", () => {
    const result = detectPayday([
      income("2026-01-01", 30000),
      income("2026-02-01", 30000),
      income("2026-03-01", 30000)
    ]);

    expect(result.paydayDayOfMonth).toBe(1);
    expect(result.confidence).toBe("high");
    expect(result.evidence[0]).toContain("1");
  });

  it("detects payday on the 15th when income repeats for 3 months", () => {
    const result = detectPayday([
      income("2026-01-15", 42000),
      income("2026-02-15", 42000),
      income("2026-03-15", 42000)
    ]);

    expect(result.paydayDayOfMonth).toBe(15);
    expect(result.confidence).toBe("high");
  });

  it("returns low confidence for irregular income", () => {
    const result = detectPayday([
      income("2026-01-01", 30000),
      income("2026-02-08", 31000),
      income("2026-03-20", 29000)
    ]);

    expect(result.paydayDayOfMonth).toBeUndefined();
    expect(result.confidence).toBe("low");
  });

  it("returns low confidence when income data is insufficient", () => {
    const result = detectPayday([income("2026-01-01", 30000), expense("2026-01-02", 1000, "teknoloji")]);

    expect(result.paydayDayOfMonth).toBeUndefined();
    expect(result.confidence).toBe("low");
    expect(result.evidence[0]).toContain("en az 3");
  });

  it("scores payday reflex from discretionary spending after payday", () => {
    const result = calculatePaydayReflexScore({
      paydayDayOfMonth: 1,
      transactions: [
        expense("2026-05-01", 500, "teknoloji"),
        expense("2026-05-03", 400, "yemek"),
        expense("2026-05-12", 100, "giyim")
      ]
    });

    expect(result.score).toBe(90);
    expect(result.confidence).toBe("high");
  });

  it("excludes mandatory expenses from discretionary spending", () => {
    const result = calculatePaydayReflexScore({
      paydayDayOfMonth: 1,
      transactions: [
        expense("2026-05-02", 15000, "kira"),
        expense("2026-05-03", 500, "teknoloji"),
        expense("2026-05-20", 500, "giyim")
      ]
    });

    expect(result.score).toBe(50);
    expect(result.reasons.join(" ")).toContain("Maaş günü ayın 1");
  });

  it("does not fall back to a fixed 5-8 payday window", () => {
    const result = calculatePaydayReflexScore({
      transactions: [expense("2026-05-06", 900, "teknoloji"), expense("2026-05-20", 100, "giyim")]
    });

    expect(result.score).toBeUndefined();
    expect(result.confidence).toBe("low");
  });
});

function income(date: string, amount: number): PaydayTransactionInput {
  return { type: "income", amount, date: `${date}T09:00:00.000Z`, category: "maaş" };
}

function expense(date: string, amount: number, category: string): PaydayTransactionInput {
  return { type: "expense", amount, date: `${date}T12:00:00.000Z`, category };
}
