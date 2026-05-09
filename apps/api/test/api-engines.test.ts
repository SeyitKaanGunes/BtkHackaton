import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import {
  accounts,
  actions,
  budgets,
  business,
  businessCashEvents,
  businessCustomers,
  categories,
  demoInvestmentHoldings,
  demoUser,
  goals,
  subscriptions,
  transactions,
  type ActionItem,
  type InvestmentHolding,
  type Transaction
} from "@fintwin/shared";
import { AgentService } from "../src/agent/agent.service.js";
import { QwenService } from "../src/ai/qwen.service.js";
import { ActionsController } from "../src/actions/actions.controller.js";
import { DataStoreService } from "../src/data/data-store.service.js";
import { DocumentsService } from "../src/documents/documents.service.js";
import { ReceiptExpenseAgentService } from "../src/documents/receipt-expense-agent.service.js";
import { StatementExpenseAgentService } from "../src/documents/statement-expense-agent.service.js";
import { InvestmentsController } from "../src/investments/investments.controller.js";
import { TwelveDataService } from "../src/investments/twelve-data.service.js";

describe("API feature services", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes agent questions through LangGraph and returns explainability", async () => {
    const agent = new AgentService(createTestStore(), new QwenService());
    const result = await agent.chat("10000 TL harcarsam ne olur?");
    expect(result.routedAgents).toContain("Simulation Agent");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.suggestedActions[0]?.type).toBe("delay_purchase");
  });

  it("rejects receipt OCR when no document is provided", async () => {
    const documents = new DocumentsService(new QwenService());
    await expect(documents.scanReceipt({})).rejects.toThrow("imageBase64 is required");
  });

  it("imports a scanned receipt as an expense transaction", async () => {
    const store = createTestStore();
    const receiptAgent = new ReceiptExpenseAgentService(new DocumentsService(qwenWith(receiptJson)), store);
    const before = store.transactions.length;
    const result = await receiptAgent.importReceipt({ imageBase64: "ZmFrZS1pbWFnZQ==", mimeType: "image/jpeg" });
    expect(result.agentName).toBe("Receipt Agent");
    expect(result.transaction.type).toBe("expense");
    expect(result.transaction.tags).toContain("receipt_agent");
    expect(store.transactions.length).toBe(before + 1);
  });

  it("imports statement line items as categorized expense transactions", async () => {
    const store = createTestStore();
    const statementAgent = new StatementExpenseAgentService(new DocumentsService(qwenWith(statementJson)), store);
    const before = store.transactions.length;
    const result = await statementAgent.importStatement({ statementText: "StreamPlus 219 TL 2026-05-01" });
    expect(result.agentName).toBe("Statement Agent");
    expect(result.importedCount).toBeGreaterThan(1);
    expect(result.recurringSubscriptions.length).toBeGreaterThan(0);
    expect(result.transactions.every((transaction) => transaction.type === "expense")).toBe(true);
    expect(store.transactions.length).toBe(before + result.importedCount);
  });

  it("creates dated reminders for detected subscriptions", async () => {
    const store = createTestStore();
    const controller = new ActionsController(store);
    const result = await controller.createSubscriptionReminder({ merchant: "StreamPlus", amount: 219, remindAt: "2026-06-01" });
    expect(result.scheduled).toBe(true);
    expect(result.action.type).toBe("calendar_bill");
    expect(result.action.dueAt).toBe("2026-06-01T09:00:00.000Z");
    expect(store.actions[0]?.id).toBe(result.action.id);
  });

  it("builds an investment portfolio with fallback market data", async () => {
    const previousKey = process.env.TWELVE_DATA_API_KEY;
    delete process.env.TWELVE_DATA_API_KEY;

    try {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                symbol: "AKBNK",
                name: "Akbank T.A.S.",
                exchange: "BIST",
                mic_code: "XIST",
                country: "Turkey",
                currency: "TRY",
                type: "Common Stock"
              }
            ],
            status: "ok"
          })
        )
      );

      const store = createTestStore();
      const controller = new InvestmentsController(store, new TwelveDataService(new ConfigService()));
      const portfolio = await controller.portfolio();
      const next = await controller.addHolding({
        symbol: "USD/TRY",
        name: "US Dollar / Turkish Lira",
        assetType: "forex",
        quantity: 100,
        averageCost: 31,
        costCurrency: "TRY",
        marketCurrency: "TRY"
      });

      expect(portfolio.positions.length).toBeGreaterThan(0);
      expect(next.positions.some((position) => position.symbol === "USD/TRY")).toBe(true);
      expect((await controller.symbols("akbank")).some((symbol) => symbol.symbol === "AKBNK")).toBe(true);
    } finally {
      if (previousKey === undefined) {
        delete process.env.TWELVE_DATA_API_KEY;
      } else {
        process.env.TWELVE_DATA_API_KEY = previousKey;
      }
    }
  });
});

function createTestStore(): DataStoreService {
  const store = {
    categories: [...categories],
    budgets: [...budgets],
    goals: [...goals],
    subscriptions: [...subscriptions],
    business,
    businessCustomers: [...businessCustomers],
    businessCashEvents: [...businessCashEvents],
    accounts: [...accounts],
    investmentHoldings: [...demoInvestmentHoldings],
    actions: [...actions],
    transactions: [...transactions],
    fcmTokens: [],
    users: [{ ...demoUser, passwordHash: "$2b$10$XUWXgP2dSqJbe1dTT4rC9O71yPUb4B3bVAeMzb7XHSc6uWXr6KI0m" }],
    getDemoUser() {
      return this.users[0]!;
    },
    async addTransaction(transaction: Transaction) {
      this.transactions.unshift(transaction);
      return transaction;
    },
    async addAction(action: ActionItem) {
      this.actions.unshift(action);
      return action;
    },
    async addInvestmentHolding(holding: InvestmentHolding) {
      this.investmentHoldings.unshift(holding);
      return holding;
    },
    async removeInvestmentHolding(id: string) {
      const existing = this.investmentHoldings.find((holding) => holding.id === id);
      this.investmentHoldings = this.investmentHoldings.filter((holding) => holding.id !== id);
      return existing;
    }
  };
  return store as unknown as DataStoreService;
}

const receiptJson = JSON.stringify({
  merchant: "Canli Market",
  totalAmount: 1249.9,
  taxAmount: 113.63,
  occurredAt: "2026-05-08",
  categoryName: "Market",
  paymentMethod: "credit_card",
  confidence: 0.91,
  lineItems: [
    { name: "Temel gida", amount: 720.4 },
    { name: "Temizlik", amount: 529.5 }
  ]
});

const statementJson = JSON.stringify({
  statementMonth: "2026-05",
  items: [
    { merchant: "TeknoMarket", amount: 9800, occurredAt: "2026-05-07", categoryName: "Teknoloji", paymentMethod: "credit_card", confidence: 0.88 },
    { merchant: "StreamPlus", amount: 219, occurredAt: "2026-05-01", categoryName: "Abonelik", paymentMethod: "credit_card", confidence: 0.9 }
  ]
});

function qwenWith(content: string): QwenService {
  return {
    isConfigured: () => true,
    chat: vi.fn(async () => ({ content, model: "test-qwen" }))
  } as unknown as QwenService;
}
