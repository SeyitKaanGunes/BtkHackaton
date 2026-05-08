import { describe, expect, it } from "vitest";
import {
  buildWhatIfScenarios,
  calculateCollectionScore,
  calculateDashboardSummary,
  calculateSpendingDna,
  detectSubscriptionLeakage
} from "./finance.js";

describe("FINSHADOW finance engines", () => {
  it("calculates a personal dashboard with a health score", () => {
    const dashboard = calculateDashboardSummary();
    expect(dashboard.financialHealthScore).toBeGreaterThan(0);
    expect(dashboard.categoryBreakdown.length).toBeGreaterThan(0);
  });

  it("builds Spending DNA category risks", () => {
    const dna = calculateSpendingDna();
    expect(dna.categories[0]?.riskScore).toBeGreaterThan(0);
    expect(dna.patterns).toContain("Maaş sonrası ilk 72 saatte teknoloji ve giyim harcaması artıyor.");
  });

  it("returns safe, balanced and risky what-if scenarios", () => {
    const simulation = buildWhatIfScenarios({ amount: 10000, categoryId: "cat-tech" });
    expect(simulation.cards.map((card) => card.id)).toEqual(["safe", "balanced", "risky"]);
    expect(simulation.emotionalDelayMinutes).toBe(10);
  });

  it("detects subscription leakage", () => {
    const leaks = detectSubscriptionLeakage();
    expect(leaks.some((leak) => leak.issue === "duplicate")).toBe(true);
  });

  it("calculates collection score for a business customer", () => {
    const score = calculateCollectionScore("cus-2");
    expect(score.score).toBeLessThan(100);
    expect(score.recommendation.length).toBeGreaterThan(10);
  });
});
