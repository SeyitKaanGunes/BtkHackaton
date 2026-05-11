import { afterEach, describe, expect, it, vi } from "vitest";
import type { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  categories,
  type ActionItem,
  type BusinessCashEvent,
  type BusinessCustomer,
  type InvestmentHolding,
  type Transaction
} from "@fintwin/shared";
import {
  accounts,
  actions,
  budgets,
  business,
  businessCashEvents,
  businessCustomers,
  demoInvestmentHoldings,
  demoUser,
  goals,
  subscriptions,
  transactions
} from "@fintwin/shared/dist/demo-data.js";
import { AgentController } from "../src/agent/agent.controller.js";
import { AgentService } from "../src/agent/agent.service.js";
import { QwenService } from "../src/ai/qwen.service.js";
import { ActionsController } from "../src/actions/actions.controller.js";
import { BusinessController } from "../src/business/business.controller.js";
import { DataStoreService } from "../src/data/data-store.service.js";
import { DocumentsService } from "../src/documents/documents.service.js";
import { PdfExtractorService } from "../src/documents/pdf-extractor.service.js";
import { ReceiptExpenseAgentService } from "../src/documents/receipt-expense-agent.service.js";
import { StatementDocumentRepository } from "../src/documents/statement-document.repository.js";
import { StatementExpenseAgentService } from "../src/documents/statement-expense-agent.service.js";
import { StatementExtractorService } from "../src/documents/statement-extractor.service.js";
import { InvestmentsController } from "../src/investments/investments.controller.js";
import { TwelveDataService } from "../src/investments/twelve-data.service.js";
import { NotificationsController } from "../src/notifications/notifications.controller.js";
import { SimulationsController } from "../src/simulations/simulations.controller.js";
import { TransactionsController } from "../src/transactions/transactions.controller.js";

describe("API feature services", () => {
  const authUser = { id: demoUser.id, email: demoUser.email, name: demoUser.name };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes agent questions through LangGraph and returns explainability", async () => {
    const store = createTestStore();
    const agent = new AgentService(store, new QwenService());
    const before = store.getPersonalData(authUser.id).actions.length;
    const result = await agent.chat(authUser.id, "10000 TL harcarsam ne olur?");
    expect(result.routedAgents).toContain("Simulation Agent");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.suggestedActions[0]?.type).toBe("delay_purchase");
    expect(result.answer).toContain("Güvenli senaryo");
    expect(result.answer).toContain("Dengeli senaryo");
    expect(result.answer).toContain("Riskli senaryo");
    expect(result.answer).toContain("Varsayımlar");
    expect(result.answer).toContain("Veri güveni");
    expect(store.getPersonalData(authUser.id).actions).toHaveLength(before + 1);

    const repeated = await agent.chat(authUser.id, "10000 TL harcarsam ne olur?");
    expect(repeated.suggestedActions[0]?.id).toBe(result.suggestedActions[0]?.id);
    expect(store.getPersonalData(authUser.id).actions).toHaveLength(before + 1);

    const controller = new ActionsController(store);
    const approved = await controller.approve(authUser, result.suggestedActions[0]!.id);
    expect(approved.status).toBe("approved");
  });

  it("asks for an amount when a what-if chat message only contains model or date-like numbers", async () => {
    const store = createTestStore();
    const agent = new AgentService(store, new QwenService());
    const result = await agent.chat(authUser.id, "iPhone 15 alsam ne olur?");
    expect(result.routedAgents).toContain("Simulation Agent");
    expect(result.answer).toContain("tutarı");
    expect(result.suggestedActions).toEqual([]);
  });

  it("rejects invalid agent and what-if request bodies before defaulting", () => {
    const store = createTestStore();
    const agentController = new AgentController(new AgentService(store, new QwenService()));
    const simulationsController = new SimulationsController(store);

    expect(() => agentController.chat(authUser, { message: "   " })).toThrow("message is required");
    expect(() => simulationsController.whatIf(authUser, { amount: "abc" })).toThrow("amount must be a positive number");
    expect(() => simulationsController.whatIf(authUser, { amount: -1 })).toThrow("amount must be a positive number");
    expect(() => simulationsController.whatIf(authUser, { decisionDate: "2026-02-30" })).toThrow("decisionDate must be a valid date");

    const result = simulationsController.whatIf(authUser, { amount: 1000, categoryId: "cat-tech", description: "Telefon alırsam ne olur?" });
    expect(result.cards.length).toBeGreaterThan(0);
  });

  it("rejects receipt OCR when no document is provided", async () => {
    const documents = createTestDocuments(new QwenService());
    await expect(documents.scanReceipt({})).rejects.toThrow("imageBase64 is required");
  });

  it("rejects receipt OCR with a clear error when Qwen is not configured", async () => {
    const documents = createTestDocuments(unconfiguredQwen());
    await expectHttpException(documents.scanReceipt({ imageBase64: "ZmFrZS1pbWFnZQ==", mimeType: "image/jpeg" }), 503, {
      code: "RECEIPT_AI_NOT_CONFIGURED",
      message: "Fiş analizi için QWEN_API_KEY tanımlı değil. Demo sonuç üretilmedi."
    });
  });

  it("imports a scanned receipt as an expense transaction", async () => {
    const store = createTestStore();
    const receiptAgent = new ReceiptExpenseAgentService(createTestDocuments(qwenWith(receiptJson)), store);
    const before = store.transactions.length;
    const result = await receiptAgent.importReceipt(authUser.id, { imageBase64: "ZmFrZS1pbWFnZQ==", mimeType: "image/jpeg" });
    expect(result.agentName).toBe("Receipt Agent");
    expect(result.transaction.type).toBe("expense");
    expect(result.transaction.tags).toContain("receipt_agent");
    expect(store.transactions.length).toBe(before + 1);
  });

  it("rejects scanned receipt imports when the date is missing instead of using today", async () => {
    const store = createTestStore();
    const receiptAgent = new ReceiptExpenseAgentService(createTestDocuments(qwenWith(receiptWithoutDateJson)), store);
    await expectHttpException(receiptAgent.importReceipt(authUser.id, { imageBase64: "ZmFrZS1pbWFnZQ==", mimeType: "image/jpeg" }), 400, {
      code: "RECEIPT_INVALID_DATE",
      message: "Fiş tarihi okunamadı; bugüne çekilmeden işlem reddedildi."
    });
  });

  it("rejects scanned receipt imports with invalid payment metadata", async () => {
    const store = createTestStore();
    const receiptAgent = new ReceiptExpenseAgentService(createTestDocuments(qwenWith(receiptInvalidPaymentJson)), store);
    const before = store.transactions.length;

    await expectHttpException(receiptAgent.importReceipt(authUser.id, { imageBase64: "ZmFrZS1pbWFnZQ==", mimeType: "image/jpeg" }), 400, {
      code: "RECEIPT_INVALID_PAYMENT_METHOD",
      message: "Fiş ödeme yöntemi geçersiz; işlem DB'ye yazılmadı."
    });
    expect(store.transactions.length).toBe(before);
  });

  it("maps unknown document categories to cat-other instead of market", async () => {
    const store = createTestStore();
    const receiptAgent = new ReceiptExpenseAgentService(createTestDocuments(qwenWith(receiptUnknownCategoryJson)), store);
    const result = await receiptAgent.importReceipt(authUser.id, { imageBase64: "ZmFrZS1pbWFnZQ==", mimeType: "image/jpeg" });
    expect(result.transaction.categoryId).toBe("cat-other");
  });

  it("previews and confirms statement line items as categorized expense transactions", async () => {
    const store = createTestStore();
    const statementRepository = createTestStatementRepository();
    const statementAgent = new StatementExpenseAgentService(createTestDocuments(qwenWith(statementJson)), store, statementRepository);
    const before = store.transactions.length;
    const preview = await statementAgent.previewStatement(authUser.id, { statementText: "StreamPlus 219 TL 2026-05-01" });
    const result = await statementAgent.confirmStatement(authUser.id, { documentId: preview.documentId, skipDuplicates: false });
    expect(result.agentName).toBe("Statement Agent");
    expect(preview.documentId).toBe("doc-statement-test");
    expect(result.importedCount).toBeGreaterThan(1);
    expect(result.recurringSubscriptions.length).toBeGreaterThan(0);
    expect(result.transactions.every((transaction) => transaction.type === "expense")).toBe(true);
    expect(store.transactions.length).toBe(before + result.importedCount);
  });

  it("rejects invalid statement selections without marking the document imported", async () => {
    const store = createTestStore();
    const statementRepository = createTestStatementRepository();
    const statementAgent = new StatementExpenseAgentService(createTestDocuments(qwenWith(statementJson)), store, statementRepository);
    const preview = await statementAgent.previewStatement(authUser.id, { statementText: "StreamPlus 219 TL 2026-05-01" });

    await expect(statementAgent.confirmStatement(authUser.id, { documentId: preview.documentId, selectedItemIndexes: [] })).rejects.toThrow(
      "En az bir ekstre kalemi seçilmeli."
    );
    await expect(statementAgent.confirmStatement(authUser.id, { documentId: preview.documentId, selectedItemIndexes: [999] })).rejects.toThrow(
      "selectedItemIndexes geçersiz kalem içeriyor: 999"
    );

    const result = await statementAgent.confirmStatement(authUser.id, { documentId: preview.documentId, skipDuplicates: false });
    expect(result.importedCount).toBeGreaterThan(0);
  });

  it("rejects invalid manual and CSV transactions before writing dirty data", async () => {
    const store = createTestStore();
    const controller = new TransactionsController(store);
    const before = store.transactions.length;

    await expect(
      controller.create(authUser, {
        merchant: "",
        amount: 0,
        categoryId: "cat-market",
        type: "expense",
        currency: "TRY",
        paymentMethod: "debit_card",
        occurredAt: "2026-05-10"
      })
    ).rejects.toThrow("merchant zorunlu");

    await expect(
      controller.importCsv(authUser, {
        csv: "occurredAt,merchant,amount,categoryId,type,paymentMethod,currency\n2026-02-30,Market,100,cat-market,expense,debit_card,TRY"
      })
    ).rejects.toThrow("occurredAt geçerli takvim tarihi olmalı");

    expect(store.transactions.length).toBe(before);
  });

  it("imports valid CSV transactions with explicit categories and dates", async () => {
    const store = createTestStore();
    const controller = new TransactionsController(store);
    const result = await controller.importCsv(authUser, {
      csv: "occurredAt,merchant,amount,categoryId,type,paymentMethod,currency,tags\n2026-05-10,\"Canli Market\",100.5,cat-market,expense,debit_card,TRY,manual;csv"
    });

    expect(result.imported).toBe(1);
    expect(result.rows[0]?.merchant).toBe("Canli Market");
    expect(result.rows[0]?.occurredAt).toBe("2026-05-10T12:00:00.000Z");
    expect(result.rows[0]?.tags).toEqual(["manual", "csv"]);
  });

  it("rejects statement previews with a clear error when Qwen is not configured", async () => {
    const statementRepository = createTestStatementRepository();
    const statementAgent = new StatementExpenseAgentService(createTestDocuments(unconfiguredQwen()), createTestStore(), statementRepository);
    await expectHttpException(statementAgent.previewStatement(authUser.id, { statementText: "StreamPlus 219 TL 2026-05-01" }), 503, {
      code: "STATEMENT_AI_NOT_CONFIGURED",
      message: "Ekstre analizi için QWEN_API_KEY tanımlı değil. Demo sonuç üretilmedi."
    });
  });

  it("creates dated reminders for detected subscriptions", async () => {
    const store = createTestStore();
    const controller = new ActionsController(store);
    const result = await controller.createSubscriptionReminder(authUser, { merchant: "StreamPlus", amount: 219, remindAt: "2026-06-01" });
    expect(result.scheduled).toBe(true);
    expect(result.action.type).toBe("calendar_bill");
    expect(result.action.dueAt).toBe("2026-06-01T09:00:00.000Z");
    expect(store.actions[0]?.id).toBe(result.action.id);
  });

  it("rejects missing actions and invalid reminder dates instead of returning soft errors", async () => {
    const store = createTestStore();
    const controller = new ActionsController(store);

    await expectHttpException(controller.approve(authUser, "missing-action"), 404, {
      message: "Action not found.",
      error: "Not Found",
      statusCode: 404
    });

    await expect(controller.createSubscriptionReminder(authUser, { merchant: "StreamPlus", amount: 219, remindAt: "2026-02-30" })).rejects.toThrow(
      "remindAt must be a valid date"
    );
  });

  it("rejects invalid notification tokens at runtime", async () => {
    const store = createTestStore();
    const controller = new NotificationsController(store);

    await expect(controller.saveToken(authUser, { token: "   ", platform: "web" })).rejects.toThrow("token is required");
    await expect(controller.saveToken(authUser, { token: "token-1", platform: "desktop" as "web" })).rejects.toThrow("platform must be ios, android or web");
    expect(store.fcmTokens).toEqual([]);
  });

  it("builds an investment portfolio with explicit market-data gaps", async () => {
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
      const portfolio = await controller.portfolio(authUser);
      const next = await controller.addHolding(authUser, {
        symbol: "USD/TRY",
        name: "US Dollar / Turkish Lira",
        assetType: "forex",
        quantity: 100,
        averageCost: 31,
        costCurrency: "TRY",
        marketCurrency: "TRY"
      });

      expect(portfolio.positions.length).toBeGreaterThan(0);
      expect(portfolio.hasMarketDataGap).toBe(true);
      expect(portfolio.positions.some((position) => position.assetType !== "cash" && !position.isPriced)).toBe(true);
      expect(next.positions.some((position) => position.symbol === "USD/TRY")).toBe(true);
      expect(next.positions.find((position) => position.symbol === "USD/TRY")?.isPriced).toBe(false);
      expect((await controller.symbols("akbank")).some((symbol) => symbol.symbol === "AKBNK")).toBe(true);
      await expect(controller.removeHolding(authUser, "missing-holding")).rejects.toThrow("Investment holding not found");
      await expect(
        controller.addHolding(authUser, {
          symbol: "AKBNK",
          assetType: "stock",
          quantity: "abc" as unknown as number,
          averageCost: 10,
          costCurrency: "TRY",
          marketCurrency: "TRY"
        })
      ).rejects.toThrow("quantity must be greater than zero");
      await expect(
        controller.addHolding(authUser, {
          symbol: "AKBNK",
          assetType: "stock",
          quantity: 1,
          averageCost: "" as unknown as number,
          costCurrency: "TRY",
          marketCurrency: "TRY"
        })
      ).rejects.toThrow("averageCost must be greater than zero");
    } finally {
      if (previousKey === undefined) {
        delete process.env.TWELVE_DATA_API_KEY;
      } else {
        process.env.TWELVE_DATA_API_KEY = previousKey;
      }
    }
  });

  it("creates KOBI business, customers, and cash events without seed mocks", async () => {
    const store = createTestStore();
    const controller = new BusinessController(store);
    const createdBusiness = await controller.create(authUser, {
      name: "Admin Studio",
      sector: "Danismanlik",
      cashBalance: 125000
    });
    const createdCustomer = await controller.createCustomer(authUser, createdBusiness.id, {
      name: "Yeni Musteri",
      averageDelayDays: 6,
      invoicesPaid: 3,
      invoicesLate: 1,
      outstandingAmount: 24000
    });
    const createdCashEvent = await controller.createCashEvent(authUser, createdBusiness.id, {
      title: "Yeni tahsilat",
      amount: 24000,
      type: "inflow",
      dueAt: "2026-05-20"
    });

    expect(createdBusiness.ownerUserId).toBe(authUser.id);
    expect(createdCustomer.businessId).toBe(createdBusiness.id);
    expect(createdCashEvent.businessId).toBe(createdBusiness.id);
    expect(controller.dashboard(authUser, createdBusiness.id).expectedCollections).toHaveLength(1);
  });

  it("rejects invalid cached statement documents before they can be imported", async () => {
    const repository = new StatementDocumentRepository({
      document: {
        findFirst: vi.fn(async () => ({
          id: "doc-invalid",
          userId: authUser.id,
          kind: "statement",
          status: "extracted",
          fileName: null,
          statementMonth: "2026-05",
          sourceType: "pdf-text",
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          totalAmount: "0",
          rawResult: {
            statementMonth: "2026-05",
            totalAmount: 0,
            sourceType: "pdf-text",
            avgConfidence: 0.9,
            warnings: [],
            items: [{ merchant: "", amount: 0, occurredAt: "", categoryName: "", paymentMethod: "wire", confidence: 0.9, index: 0 }]
          },
          createdAt: new Date("2026-05-10T12:00:00.000Z")
        }))
      }
    } as unknown as ConstructorParameters<typeof StatementDocumentRepository>[0]);

    await expect(repository.getById("doc-invalid", authUser.id)).rejects.toThrow("Cached statement document is invalid");
  });
});

function createTestStore(): DataStoreService {
  const store = {
    categories: [...categories],
    budgets: [...budgets],
    goals: [...goals],
    subscriptions: [...subscriptions],
    business,
    businesses: [business],
    businessCustomers: [...businessCustomers],
    businessCashEvents: [...businessCashEvents],
    accounts: [...accounts],
    investmentHoldings: [...demoInvestmentHoldings],
    actions: [...actions],
    transactions: [...transactions],
    fcmTokens: [] as Array<{ userId: string; token: string; platform: string }>,
    users: [{ ...demoUser, passwordHash: "$2b$10$XUWXgP2dSqJbe1dTT4rC9O71yPUb4B3bVAeMzb7XHSc6uWXr6KI0m" }],
    getDemoUser() {
      return this.users[0]!;
    },
    getBusinessesForUser(userId: string) {
      return this.businesses.filter((item) => item.ownerUserId === userId);
    },
    getBusinessForUser(userId: string, businessId: string) {
      return this.businesses.find((item) => item.id === businessId && item.ownerUserId === userId);
    },
    getBusinessCustomers(businessId: string) {
      return this.businessCustomers.filter((customer) => customer.businessId === businessId);
    },
    getBusinessCashEvents(businessId: string) {
      return this.businessCashEvents.filter((event) => event.businessId === businessId);
    },
    async createBusiness(userId: string, input: { name: string; sector: string; cashBalance?: number }) {
      const created = {
        id: `business-${this.businesses.length + 1}`,
        ownerUserId: userId,
        name: input.name,
        sector: input.sector,
        cashBalance: input.cashBalance ?? 0
      };
      this.businesses.push(created);
      return created;
    },
    async addBusinessCustomer(businessId: string, input: Omit<BusinessCustomer, "id" | "businessId">) {
      const created = {
        id: `cus-${this.businessCustomers.length + 1}`,
        businessId,
        ...input
      };
      this.businessCustomers.push(created);
      return created;
    },
    async addBusinessCashEvent(businessId: string, input: Omit<BusinessCashEvent, "id" | "businessId">) {
      const created = {
        id: `be-${this.businessCashEvents.length + 1}`,
        businessId,
        ...input
      };
      this.businessCashEvents.push(created);
      return created;
    },
    getPersonalData(userId: string) {
      return {
        user: this.users.find((user) => user.id === userId),
        categories: this.categories,
        accounts: this.accounts.filter((account) => account.userId === userId),
        budgets: this.budgets.filter((budget) => budget.userId === userId),
        goals: this.goals.filter((goal) => goal.userId === userId),
        subscriptions: this.subscriptions.filter((subscription) => subscription.userId === userId),
        actions: this.actions.filter((action) => action.userId === userId),
        transactions: this.transactions.filter((transaction) => transaction.userId === userId),
        investmentHoldings: this.investmentHoldings.filter((holding) => holding.userId === userId)
      };
    },
    defaultAccountIdFor(userId: string, paymentMethod: Transaction["paymentMethod"]) {
      const userAccounts = this.accounts.filter((account) => account.userId === userId);
      return (paymentMethod === "credit_card" ? userAccounts.find((account) => account.type === "credit") : userAccounts.find((account) => account.type === "debit"))?.id ?? userAccounts[0]?.id ?? "acc-main";
    },
    accountIdFor(userId: string, paymentMethod: Transaction["paymentMethod"], requestedAccountId?: string) {
      return requestedAccountId ?? this.defaultAccountIdFor(userId, paymentMethod);
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
    async removeInvestmentHolding(id: string, userId: string) {
      const existing = this.investmentHoldings.find((holding) => holding.id === id && holding.userId === userId);
      this.investmentHoldings = this.investmentHoldings.filter((holding) => holding.id !== id);
      return existing;
    },
    async approveAction(id: string, userId: string) {
      const existing = this.actions.find((action) => action.id === id && action.userId === userId);
      if (!existing) return undefined;
      existing.status = "approved";
      return existing;
    },
    async dismissAction(id: string, userId: string) {
      const existing = this.actions.find((action) => action.id === id && action.userId === userId);
      if (!existing) return undefined;
      existing.status = "dismissed";
      return existing;
    },
    async saveFcmToken(input: { userId: string; token: string; platform: string }) {
      this.fcmTokens.unshift(input);
      return input;
    }
  };
  return store as unknown as DataStoreService;
}

async function expectHttpException(promise: Promise<unknown>, status: number, response: unknown) {
  try {
    await promise;
    throw new Error("Expected promise to reject.");
  } catch (error) {
    expect((error as HttpException).getStatus()).toBe(status);
    expect((error as HttpException).getResponse()).toEqual(response);
  }
}

function createTestDocuments(qwen: QwenService): DocumentsService {
  const pdfExtractor = {
    extractText: vi.fn()
  } as unknown as PdfExtractorService;
  return new DocumentsService(qwen, new StatementExtractorService(qwen, pdfExtractor));
}

function createTestStatementRepository(): StatementDocumentRepository {
  type CreateInput = Parameters<StatementDocumentRepository["create"]>[0];
  type PreviewDocument = Awaited<ReturnType<StatementDocumentRepository["create"]>>;
  const documents = new Map<string, PreviewDocument>();
  return {
    findCachedExtraction: vi.fn(async () => undefined),
    create: vi.fn(async (input: CreateInput): Promise<PreviewDocument> => {
      const document: PreviewDocument = {
        id: "doc-statement-test",
        userId: input.userId,
        status: "extracted",
        fileName: input.fileName,
        createdAt: new Date("2026-05-10T12:00:00.000Z"),
        items: input.items,
        warnings: input.warnings,
        statementMonth: input.statementMonth,
        totalAmount: input.totalAmount,
        sourceType: input.sourceType,
        avgConfidence: input.avgConfidence,
        tokenUsage: input.tokenUsage
      };
      documents.set(document.id, document);
      return document;
    }),
    getById: vi.fn(async (id: string, userId: string): Promise<PreviewDocument | undefined> => {
      const document = documents.get(id);
      return document?.userId === userId ? document : undefined;
    }),
    markImported: vi.fn(async (id: string): Promise<void> => {
      const document = documents.get(id);
      if (document) documents.set(id, { ...document, status: "imported" });
    })
  } as unknown as StatementDocumentRepository;
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

const receiptWithoutDateJson = JSON.stringify({
  merchant: "Canli Market",
  totalAmount: 1249.9,
  taxAmount: 113.63,
  occurredAt: "",
  categoryName: "Market",
  paymentMethod: "credit_card",
  confidence: 0.62,
  lineItems: [{ name: "Temel gida", amount: 1249.9 }]
});

const receiptUnknownCategoryJson = JSON.stringify({
  merchant: "Belirsiz Magaza",
  totalAmount: 429.9,
  taxAmount: 39.08,
  occurredAt: "2026-05-08",
  categoryName: "Hobi",
  paymentMethod: "debit_card",
  confidence: 0.82,
  lineItems: [{ name: "Urun", amount: 429.9 }]
});

const receiptInvalidPaymentJson = JSON.stringify({
  merchant: "Canli Market",
  totalAmount: 1249.9,
  taxAmount: 113.63,
  occurredAt: "2026-05-08",
  categoryName: "Market",
  paymentMethod: "wire",
  confidence: 0.91,
  lineItems: [{ name: "Temel gida", amount: 1249.9 }]
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

function unconfiguredQwen(): QwenService {
  return {
    isConfigured: () => false,
    chat: vi.fn()
  } as unknown as QwenService;
}
