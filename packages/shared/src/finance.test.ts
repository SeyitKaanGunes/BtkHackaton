import { describe, expect, it } from "vitest";
import {
  buildBusinessInsights,
  buildWhatIfScenarios,
  calculateCollectionScore,
  calculateDashboardSummary,
  calculateSpendingDna,
  detectSubscriptionLeakage,
  summarizeDecisionJournal
} from "./finance.js";
import { accounts, actions, budgets, business, businessCashEvents, businessCustomers, goals, subscriptions, transactions } from "./demo-data.js";
import type { Account, Budget, Category, Goal, Transaction } from "./types.js";

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

  it("includes user-created categories in dashboard and Spending DNA calculations", () => {
    const customCategories: Category[] = [{ id: "cat-custom-expense-spor", name: "Spor", kind: "expense", color: "#0d9488" }];
    const customTransactions = [expense("tx-sport", "cat-custom-expense-spor", 800, "2026-05-10")];
    const dashboard = calculateDashboardSummary([], customTransactions, [], [], [], { referenceDate: "2026-05-10" }, customCategories);
    const dna = calculateSpendingDna(customTransactions, [], { referenceDate: "2026-05-10" }, customCategories);

    expect(dashboard.categoryBreakdown).toEqual([{ categoryId: "cat-custom-expense-spor", name: "Spor", value: 800, color: "#0d9488" }]);
    expect(dna.categories[0]?.categoryName).toBe("Spor");
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

    expect(dna.nightSpendingScore).toBe(67);
    expect(dna.weekendSpendingScore).toBe(83);
    expect(dna.weekendNightScore).toBe(50);
    expect(dna.timeZone).toBe("Europe/Istanbul");
  });

  it("keeps budgetless category risk low-confidence when no history exists", () => {
    const dna = calculateSpendingDna([expense("tx-other", "cat-other", 5000, "2026-05-10")], [], { referenceDate: "2026-05-10" });
    const other = dna.categories.find((category) => category.categoryId === "cat-other");
    expect(other?.confidence).toBe("low");
    expect(other?.riskScore).toBeLessThan(60);
    expect(other?.reasons?.join(" ")).toContain("bütçe ve yeterli geçmiş veri");
  });

  it("uses historical deviation with medium confidence when category budget is missing", () => {
    const dna = calculateSpendingDna(
      [
        expense("tx-food-feb", "cat-food", 1000, "2026-02-10"),
        expense("tx-food-mar", "cat-food", 1000, "2026-03-10"),
        expense("tx-food-apr", "cat-food", 1000, "2026-04-10"),
        expense("tx-food-may", "cat-food", 5000, "2026-05-10")
      ],
      [],
      { referenceDate: "2026-05-10" }
    );
    const food = dna.categories.find((category) => category.categoryId === "cat-food");
    expect(food?.confidence).toBe("medium");
    expect(food?.riskScore).toBeGreaterThan(60);
    expect(food?.reasons?.join(" ")).toContain("ortalamanın");
  });

  it("does not turn mandatory rent or bill categories into automatic 100 risk without budgets", () => {
    const dna = calculateSpendingDna([expense("tx-rent", "cat-rent", 25000, "2026-05-10")], [], { referenceDate: "2026-05-10" });
    const rent = dna.categories.find((category) => category.categoryId === "cat-rent");
    expect(rent?.riskScore).toBeLessThan(100);
    expect(rent?.confidence).toBe("low");
    expect(rent?.reasons?.join(" ")).toContain("zorunlu gider");
  });

  it("scores budgeted category risk from budget usage", () => {
    const dna = calculateSpendingDna(
      [expense("tx-tech", "cat-tech", 750, "2026-05-10")],
      [{ id: "budget-tech-test", userId: "user-test", categoryId: "cat-tech", monthlyLimit: 1000 }],
      { referenceDate: "2026-05-10" }
    );
    const tech = dna.categories.find((category) => category.categoryId === "cat-tech");
    expect(tech?.riskScore).toBe(75);
    expect(tech?.confidence).toBe("high");
    expect(tech?.reasons?.length).toBeGreaterThan(0);
  });

  it("returns deterministic Spending DNA metric explanations", () => {
    const first = calculateSpendingDna(transactions, budgets);
    const second = calculateSpendingDna(transactions, budgets);
    expect(first.metrics).toEqual(second.metrics);
    expect(first.metrics?.overallRisk.reasons.length).toBeGreaterThan(0);
    expect(first.metrics?.paydayReflexScore.reasons.length).toBeGreaterThan(0);
    expect(first.metrics?.nightSpendingScore.reasons[0]).toContain("Gece harcamalarının");
  });

  it("detects payday from recurring income instead of fixed 5-8 fallback", () => {
    const dna = calculateSpendingDna(
      [
        income("tx-income-jan", 30000, "2026-01-01"),
        income("tx-income-feb", 30000, "2026-02-01"),
        income("tx-income-mar", 30000, "2026-03-01"),
        expense("tx-tech-after-payday", "cat-tech", 900, "2026-03-02"),
        expense("tx-clothes-later", "cat-clothes", 100, "2026-03-20"),
        expense("tx-rent-after-payday", "cat-rent", 10000, "2026-03-02")
      ],
      [],
      { referenceDate: "2026-03-20" }
    );
    expect(dna.paydayReflexScore).toBe(90);
    expect(dna.metrics?.paydayReflexScore.confidence).toBe("high");
    expect(dna.metrics?.paydayReflexScore.reasons.join(" ")).toContain("ayın 1");
  });

  it("keeps payday confidence low for irregular income", () => {
    const dna = calculateSpendingDna(
      [
        income("tx-income-jan", 30000, "2026-01-01"),
        income("tx-income-feb", 30000, "2026-02-11"),
        income("tx-income-mar", 30000, "2026-03-21"),
        expense("tx-tech", "cat-tech", 900, "2026-03-06")
      ],
      [],
      { referenceDate: "2026-03-21" }
    );
    expect(dna.paydayReflexScore).toBe(0);
    expect(dna.metrics?.paydayReflexScore.confidence).toBe("low");
  });

  it("calculates campaign sensitivity from discretionary campaign spend and budget breach", () => {
    const dna = calculateSpendingDna(
      [
        expense("tx-tech-campaign", "cat-tech", 8000, "2026-05-10", ["campaign"]),
        expense("tx-food", "cat-food", 1000, "2026-05-10")
      ],
      [{ id: "budget-tech-campaign", userId: "user-test", categoryId: "cat-tech", monthlyLimit: 5000 }],
      { referenceDate: "2026-05-10" }
    );
    expect(dna.campaignSensitivity).toBeGreaterThan(60);
    expect(dna.metrics?.campaignSensitivity.reasons.join(" ")).toContain("bütçesi aşıldı");
  });

  it("does not overreact to a tiny campaign transaction", () => {
    const dna = calculateSpendingDna(
      [expense("tx-campaign-small", "cat-tech", 100, "2026-05-10", ["campaign"]), expense("tx-food-large", "cat-food", 9900, "2026-05-10")],
      [],
      { referenceDate: "2026-05-10" }
    );
    expect(dna.campaignSensitivity).toBeLessThan(30);
  });

  it("does not include mandatory categories in campaign sensitivity", () => {
    const dna = calculateSpendingDna([expense("tx-rent-campaign", "cat-rent", 15000, "2026-05-10", ["campaign"])], [], { referenceDate: "2026-05-10" });
    expect(dna.campaignSensitivity).toBe(0);
    expect(dna.metrics?.campaignSensitivity.confidence).toBe("low");
  });

  it("returns safe, balanced and risky what-if scenarios", () => {
    const simulation = buildWhatIfScenarios(
      { amount: 10000, categoryId: "cat-tech" },
      { accounts, actions, budgets, goals, transactions }
    );
    expect(simulation.cards.map((card) => card.id)).toEqual(["safe", "balanced", "risky"]);
    expect(simulation.emotionalDelayMinutes).toBe(10);
    expect(simulation.scenarioId).toBeTruthy();
    expect(new Set(simulation.cards.map((card) => card.scenarioId)).size).toBe(3);
    expect(simulation.dataConfidenceLevel).toBeTruthy();
  });

  it("does not invent what-if scenarios for empty financial data", () => {
    const simulation = buildWhatIfScenarios({ amount: 10000, categoryId: "cat-tech" }, { accounts: [], actions: [], budgets: [], goals: [], transactions: [] });
    expect(simulation.safeLimit).toBe(0);
    expect(simulation.cards).toEqual([]);
    expect(simulation.dataConfidenceLevel).toBe("low");
  });

  it("reduces what-if safe limit when fixed expenses are due", () => {
    const simulation = buildWhatIfScenarios(
      { amount: 5000, categoryId: "cat-tech", decisionDate: "2026-05-10" },
      {
        accounts: [account(10000)],
        actions: [],
        budgets: [budget("cat-tech", 10000)],
        goals: [],
        transactions: [expense("tx-rent-due", "cat-rent", 9000, "2026-05-20", undefined, true)]
      }
    );
    expect(simulation.cashflow?.fixedExpensesDue).toBe(9000);
    expect(simulation.safeLimit).toBeLessThanOrEqual(800);
  });

  it("limits what-if safe limit by remaining category budget", () => {
    const simulation = buildWhatIfScenarios(
      { amount: 5000, categoryId: "cat-tech", decisionDate: "2026-05-10" },
      {
        accounts: [account(50000)],
        actions: [],
        budgets: [budget("cat-tech", 1000)],
        goals: [],
        transactions: [expense("tx-tech-used", "cat-tech", 900, "2026-05-02")]
      }
    );
    expect(simulation.cashflow?.categoryBudgetRemaining).toBe(100);
    expect(simulation.safeLimit).toBe(100);
  });

  it("subtracts emergency buffer from what-if available cash", () => {
    const simulation = buildWhatIfScenarios(
      { amount: 5000, categoryId: "cat-tech", decisionDate: "2026-05-10" },
      {
        accounts: [account(10000)],
        actions: [],
        budgets: [budget("cat-tech", 10000)],
        goals: [emergencyGoal(8000)],
        transactions: [expense("tx-market", "cat-market", 100, "2026-05-02")]
      }
    );
    expect(simulation.cashflow?.emergencyBuffer).toBe(8000);
    expect(simulation.cashflow?.availableCash).toBe(2000);
    expect(simulation.safeLimit).toBe(1500);
  });

  it("warns when the risky scenario exceeds the safe limit", () => {
    const simulation = buildWhatIfScenarios(
      { amount: 5000, categoryId: "cat-tech", decisionDate: "2026-05-10" },
      { accounts: [account(2000)], actions: [], budgets: [budget("cat-tech", 10000)], goals: [], transactions: [expense("tx-market", "cat-market", 100, "2026-05-02")] }
    );
    expect(simulation.cards.find((card) => card.id === "risky")?.warning).toContain("harcama sınırının üzerinde");
  });

  it("detects subscription leakage", () => {
    const leaks = detectSubscriptionLeakage(subscriptions, new Date("2026-05-10T00:00:00.000Z"));
    expect(leaks.some((leak) => leak.issue === "duplicate")).toBe(true);
  });

  it("summarizes decision journal outcomes into protected cash and health signal", () => {
    const summary = summarizeDecisionJournal([
      {
        id: "sim-1",
        kind: "what_if",
        question: "Telefon alırsam?",
        createdAt: "2026-05-13T12:00:00.000Z",
        decisionEvents: [
          {
            id: "dec-1",
            userId: "user-test",
            simulationId: "sim-1",
            scenarioId: "scenario-1",
            userAction: "reduced",
            originalAmount: 12000,
            finalAmount: 8000,
            createdAt: "2026-05-13T12:05:00.000Z"
          }
        ]
      },
      {
        id: "sim-2",
        kind: "what_if",
        question: "Ayakkabı alırsam?",
        createdAt: "2026-05-13T13:00:00.000Z",
        decisionEvents: [
          {
            id: "dec-2",
            userId: "user-test",
            simulationId: "sim-2",
            scenarioId: "scenario-2",
            userAction: "cancelled",
            originalAmount: 6000,
            createdAt: "2026-05-13T13:05:00.000Z"
          }
        ]
      }
    ]);

    expect(summary.decidedScenarios).toBe(2);
    expect(summary.reducedSpend).toBe(4000);
    expect(summary.avoidedSpend).toBe(6000);
    expect(summary.netProtectedCash).toBe(10000);
    expect(summary.healthAdjustment).toBeGreaterThan(0);
  });

  it("calculates collection score for a business customer", () => {
    const score = calculateCollectionScore("cus-2", businessCustomers);
    expect(score.score).toBeLessThan(100);
    expect(score.recommendation.length).toBeGreaterThan(10);
  });

  it("builds KOBI cashflow, coverage, collection priority and scenario insights", () => {
    const insights = buildBusinessInsights(business, businessCashEvents, businessCustomers, [], new Date("2026-05-12T00:00:00.000Z"));
    expect(insights.summary.expectedCollections30Days).toBe(128000);
    expect(insights.summary.upcomingPayments30Days).toBe(154000);
    expect(insights.cashflow).toHaveLength(31);
    expect(insights.coverage.requiredTotal).toBe(154000);
    expect(insights.coverage.canCover).toBe(true);
    expect(insights.collectionPriorities[0]?.priorityScore).toBeGreaterThanOrEqual(insights.collectionPriorities[1]?.priorityScore ?? 0);
    expect(insights.collectionPriorities.some((priority) => priority.customerName === "Mavi Lojistik")).toBe(true);
    expect(insights.scenarios.map((scenario) => scenario.id)).toEqual(["collection_delay", "payment_deferral", "cash_injection"]);
    expect(insights.twin.summary).toContain("30 gün");
  });
});

function account(balance: number): Account {
  return { id: `acc-${balance}`, userId: "user-test", name: "Test", type: "debit", balance, currency: "TRY" };
}

function budget(categoryId: string, monthlyLimit: number): Budget {
  return { id: `budget-${categoryId}-${monthlyLimit}`, userId: "user-test", categoryId, monthlyLimit };
}

function emergencyGoal(currentAmount: number): Goal {
  return { id: "goal-emergency-test", userId: "user-test", title: "Acil Durum Fonu", targetAmount: 100000, currentAmount, deadline: "2026-12-31" };
}

function income(id: string, amount: number, occurredAt: string): Transaction {
  return {
    id,
    userId: "user-test",
    accountId: "acc-test",
    categoryId: "cat-salary",
    merchant: "Maaş",
    amount,
    currency: "TRY",
    type: "income",
    occurredAt: `${occurredAt}T09:00:00.000Z`,
    paymentMethod: "transfer"
  };
}

function expense(id: string, categoryId: string, amount: number, occurredAt: string, tags?: string[], recurring = false): Transaction {
  return {
    id,
    userId: "user-test",
    accountId: "acc-test",
    categoryId,
    merchant: getMerchant(categoryId),
    amount,
    currency: "TRY",
    type: "expense",
    occurredAt: `${occurredAt}T12:00:00.000Z`,
    paymentMethod: "credit_card",
    tags,
    recurring
  };
}

function getMerchant(categoryId: string) {
  return {
    "cat-tech": "TeknoMarket",
    "cat-food": "Restoran",
    "cat-clothes": "Giyim",
    "cat-market": "Market",
    "cat-rent": "Kira",
    "cat-other": "Diğer"
  }[categoryId] ?? "Satıcı";
}
