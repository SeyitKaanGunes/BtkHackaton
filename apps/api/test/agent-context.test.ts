import { describe, expect, it } from "vitest";
import { categories, type SimulationHistoryItem } from "@fintwin/shared";
import { AGENT_CONTEXT_CHAR_BUDGET, buildTokenFriendlyAgentContext } from "../src/agent/agent-context.js";

describe("buildTokenFriendlyAgentContext", () => {
  it("keeps rich financial context inside the default prompt budget", () => {
    const context = buildTokenFriendlyAgentContext(makeData(), historyRows);

    expect(JSON.stringify(context).length).toBeLessThanOrEqual(AGENT_CONTEXT_CHAR_BUDGET);
    expect(context.summary.financialHealthScore).toBeGreaterThanOrEqual(0);
    expect(context.budgets[0]).toMatchObject({ category: expect.any(String), monthlyLimit: expect.any(Number) });
    expect(context.decisionJournal.netProtectedCash).toBeGreaterThan(0);
    expect(context.subscriptions.leakCount).toBeGreaterThanOrEqual(0);
    expect(context.profileCompleteness).toMatchObject({ score: 100, missingCriticalData: [] });
    expect(context.contextBudget.maxChars).toBe(AGENT_CONTEXT_CHAR_BUDGET);
  });

  it("truncates noisy sections before dropping core profile signals", () => {
    const noisyData = makeData(80);
    const context = buildTokenFriendlyAgentContext(noisyData, historyRows, { maxChars: 3_500 });

    expect(JSON.stringify(context).length).toBeLessThanOrEqual(3_500);
    expect(context.contextBudget.truncatedSections.length).toBeGreaterThan(0);
    expect(context.user.monthlyIncome).toBe(60000);
    expect(context.summary.safeSpendLimit).toBeGreaterThanOrEqual(0);
    expect(context.recentTransactions.length).toBeLessThan(noisyData.transactions.length);
  });
});

function makeData(extraTransactionCount = 0) {
  const transactions = [
    tx("tx-salary", "cat-salary", "Maaş", 60000, "income", "2026-05-05T09:00:00.000Z"),
    tx("tx-market", "cat-market", "Market", 4500, "expense", "2026-05-10T12:00:00.000Z"),
    tx("tx-food", "cat-food", "Restoran", 2200, "expense", "2026-05-11T20:00:00.000Z"),
    ...Array.from({ length: extraTransactionCount }, (_, index) =>
      tx(`tx-extra-${index}`, index % 2 === 0 ? "cat-tech" : "cat-clothing", `Uzun islem aciklamasi ${index}`, 100 + index, "expense", `2026-05-${String((index % 20) + 1).padStart(2, "0")}T12:00:00.000Z`)
    )
  ];

  return {
    user: {
      id: "user-1",
      name: "Alperen",
      email: "alperen@example.com",
      persona: "young_professional" as const,
      accountType: "personal" as const,
      monthlyIncome: 60000,
      payday: 5,
      currency: "TRY" as const
    },
    accounts: [
      { id: "acc-1", userId: "user-1", name: "Ana hesap", type: "debit" as const, balance: 42000, currency: "TRY" as const },
      { id: "acc-2", userId: "user-1", name: "Acil fon", type: "savings" as const, balance: 18000, currency: "TRY" as const }
    ],
    actions: [
      {
        id: "act-1",
        userId: "user-1",
        type: "delay_purchase" as const,
        title: "Telefon kararını beklet",
        description: "Harcama öncesi 24 saat bekle.",
        status: "pending" as const,
        source: "agent" as const,
        dueAt: "2026-05-18T12:00:00.000Z"
      }
    ],
    budgets: [
      { id: "budget-market", userId: "user-1", categoryId: "cat-market", monthlyLimit: 9000 },
      { id: "budget-food", userId: "user-1", categoryId: "cat-food", monthlyLimit: 6000 },
      { id: "budget-tech", userId: "user-1", categoryId: "cat-tech", monthlyLimit: 4000 }
    ],
    categories,
    goals: [
      { id: "goal-1", userId: "user-1", title: "Acil durum tamponu", targetAmount: 120000, currentAmount: 18000, deadline: "2026-12-31" }
    ],
    subscriptions: [
      {
        id: "sub-1",
        userId: "user-1",
        merchant: "StreamPlus",
        categoryId: "cat-subscription",
        amount: 219,
        currency: "TRY" as const,
        cadence: "monthly" as const,
        status: "active" as const,
        source: "statement" as const,
        nextExpectedAt: "2026-06-01"
      }
    ],
    transactions,
    investmentHoldings: [
      {
        id: "hold-1",
        userId: "user-1",
        symbol: "GLD",
        name: "Altın",
        assetType: "gold" as const,
        quantity: 10,
        averageCost: 2500,
        costCurrency: "TRY" as const,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z"
      }
    ]
  };
}

function tx(
  id: string,
  categoryId: string,
  merchant: string,
  amount: number,
  type: "income" | "expense",
  occurredAt: string
) {
  return {
    id,
    userId: "user-1",
    accountId: "acc-1",
    categoryId,
    merchant,
    amount,
    currency: "TRY" as const,
    type,
    occurredAt,
    paymentMethod: "debit_card" as const
  };
}

const historyRows: SimulationHistoryItem[] = [
  {
    id: "sim-1",
    kind: "what_if",
    question: "10.000 TL telefon alırsam ne olur?",
    amount: 10000,
    categoryId: "cat-tech",
    categoryName: "Teknoloji",
    riskLevel: "medium",
    emotionalDelayMinutes: 30,
    safeLimit: 7000,
    createdAt: "2026-05-13T12:00:00.000Z",
    decisionEvents: [
      {
        id: "decision-1",
        userId: "user-1",
        simulationId: "sim-1",
        scenarioId: "balanced",
        userAction: "delayed",
        originalAmount: 10000,
        createdAt: "2026-05-13T12:30:00.000Z"
      }
    ]
  }
];
