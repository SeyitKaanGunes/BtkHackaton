import { describe, expect, it } from "vitest";
import {
  buildWhatIfScenarios,
  calculateCollectionScore,
  calculateDashboardSummary,
  calculateSpendingDna,
  detectSubscriptionLeakage
} from "./finance.js";
import { accounts, actions, budgets, businessCustomers, goals, subscriptions, transactions } from "./demo-data.js";

describe("Fintwin finance engines", () => {
  it("calculates a personal dashboard with a health score", () => {
    const dashboard = calculateDashboardSummary(accounts, transactions, goals, actions, budgets);
    expect(dashboard.financialHealthScore).toBeGreaterThan(0);
    expect(dashboard.periodLabel).toBe("Mayıs 2026");
    expect(dashboard.categoryBreakdown.length).toBeGreaterThan(0);
  });

  it("keeps empty personal dashboard data neutral", () => {
    const dashboard = calculateDashboardSummary([], [], [], [], []);
    const dna = calculateSpendingDna([], []);
    expect(dashboard.financialHealthScore).toBe(0);
    expect(dashboard.categoryBreakdown).toEqual([]);
    expect(dashboard.riskAlerts).toEqual([]);
    expect(dna.overallRisk).toBe(0);
    expect(dna.categories).toEqual([]);
    expect(dna.patterns[0]).toContain("Harcama verisi");
  });

  it("filters dashboard summaries by selected period", () => {
    const daily = calculateDashboardSummary(accounts, transactions, goals, actions, budgets, { period: "daily", referenceDate: "2026-05-08" });
    const monthly = calculateDashboardSummary(accounts, transactions, goals, actions, budgets, { period: "monthly", referenceDate: "2026-05-08" });
    expect(daily.period).toBe("daily");
    expect(daily.periodStart).toBe("2026-05-08");
    expect(monthly.period).toBe("monthly");
    expect(monthly.expenses).toBeGreaterThanOrEqual(daily.expenses);
  });

  it("builds Spending DNA category risks", () => {
    const dna = calculateSpendingDna(transactions, budgets);
    expect(dna.categories[0]?.riskScore).toBeGreaterThan(0);
    expect(dna.patterns.length).toBeGreaterThan(0);
  });

  it("calculates Spending DNA time scores in the user's local timezone", () => {
    const localTransactions = [
      {
        id: "tx-weekday-night",
        userId: "user-timezone",
        accountId: "acc-main",
        categoryId: "cat-food",
        merchant: "Weekday Night",
        amount: 100,
        currency: "TRY",
        type: "expense",
        occurredAt: "2026-05-08T17:30:00.000Z",
        paymentMethod: "credit_card"
      },
      {
        id: "tx-weekend-day",
        userId: "user-timezone",
        accountId: "acc-main",
        categoryId: "cat-food",
        merchant: "Weekend Day",
        amount: 200,
        currency: "TRY",
        type: "expense",
        occurredAt: "2026-05-09T10:00:00.000Z",
        paymentMethod: "credit_card"
      },
      {
        id: "tx-weekend-night",
        userId: "user-timezone",
        accountId: "acc-main",
        categoryId: "cat-food",
        merchant: "Weekend Night",
        amount: 300,
        currency: "TRY",
        type: "expense",
        occurredAt: "2026-05-09T17:30:00.000Z",
        paymentMethod: "credit_card"
      }
    ] as typeof transactions;
    const dna = calculateSpendingDna(localTransactions, [{ id: "budget-food-test", userId: "user-timezone", categoryId: "cat-food", monthlyLimit: 10000 }], {
      timeZone: "Europe/Istanbul",
      referenceDate: "2026-05-09"
    });

    expect(dna.nightSpendingScore).toBe(83);
    expect(dna.weekendSpendingScore).toBe(99);
    expect(dna.weekendNightScore).toBe(66);
    expect(dna.timeZone).toBe("Europe/Istanbul");
  });

  it("returns safe, balanced and risky what-if scenarios", () => {
    const simulation = buildWhatIfScenarios(
      { amount: 10000, categoryId: "cat-tech" },
      { accounts, actions, budgets, goals, transactions }
    );
    expect(simulation.cards.map((card) => card.id)).toEqual(["safe", "balanced", "risky"]);
    expect(simulation.emotionalDelayMinutes).toBe(10);
  });

  it("does not invent what-if scenarios for empty financial data", () => {
    const simulation = buildWhatIfScenarios({ amount: 10000, categoryId: "cat-tech" }, { accounts: [], actions: [], budgets: [], goals: [], transactions: [] });
    expect(simulation.safeLimit).toBe(0);
    expect(simulation.cards).toEqual([]);
  });

  it("detects subscription leakage", () => {
    const leaks = detectSubscriptionLeakage(subscriptions, new Date("2026-05-10T00:00:00.000Z"));
    expect(leaks.some((leak) => leak.issue === "duplicate")).toBe(true);
  });

  it("calculates collection score for a business customer", () => {
    const score = calculateCollectionScore("cus-2", businessCustomers);
    expect(score.score).toBeLessThan(100);
    expect(score.recommendation.length).toBeGreaterThan(10);
  });
});
