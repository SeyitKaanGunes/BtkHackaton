import { describe, expect, it } from "vitest";
import { AgentService } from "../src/agent/agent.service.js";
import { QwenService } from "../src/ai/qwen.service.js";
import { ActionsController } from "../src/actions/actions.controller.js";
import { DataStoreService } from "../src/data/data-store.service.js";
import { DocumentsService } from "../src/documents/documents.service.js";
import { ReceiptExpenseAgentService } from "../src/documents/receipt-expense-agent.service.js";
import { StatementExpenseAgentService } from "../src/documents/statement-expense-agent.service.js";

describe("API feature services", () => {
  it("routes agent questions through LangGraph and returns explainability", async () => {
    const agent = new AgentService(new DataStoreService(), new QwenService());
    const result = await agent.chat("10000 TL harcarsam ne olur?");
    expect(result.routedAgents).toContain("Simulation Agent");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.suggestedActions[0]?.type).toBe("delay_purchase");
  });

  it("returns deterministic receipt OCR fallback without Qwen key", async () => {
    const documents = new DocumentsService(new QwenService());
    const result = await documents.scanReceipt({});
    expect(result.merchant).toBe("Demo Market");
    expect(result.totalAmount).toBeGreaterThan(0);
  });

  it("imports a scanned receipt as an expense transaction", async () => {
    const store = new DataStoreService();
    const receiptAgent = new ReceiptExpenseAgentService(new DocumentsService(new QwenService()), store);
    const before = store.transactions.length;
    const result = await receiptAgent.importReceipt({});
    expect(result.agentName).toBe("Receipt Agent");
    expect(result.transaction.type).toBe("expense");
    expect(result.transaction.tags).toContain("receipt_agent");
    expect(store.transactions.length).toBe(before + 1);
  });

  it("imports statement line items as categorized expense transactions", async () => {
    const store = new DataStoreService();
    const statementAgent = new StatementExpenseAgentService(new DocumentsService(new QwenService()), store);
    const before = store.transactions.length;
    const result = await statementAgent.importStatement({});
    expect(result.agentName).toBe("Statement Agent");
    expect(result.importedCount).toBeGreaterThan(1);
    expect(result.recurringSubscriptions.length).toBeGreaterThan(0);
    expect(result.transactions.every((transaction) => transaction.type === "expense")).toBe(true);
    expect(store.transactions.length).toBe(before + result.importedCount);
  });

  it("creates dated reminders for detected subscriptions", () => {
    const store = new DataStoreService();
    const controller = new ActionsController(store);
    const result = controller.createSubscriptionReminder({ merchant: "StreamPlus", amount: 219, remindAt: "2026-06-01" });
    expect(result.scheduled).toBe(true);
    expect(result.action.type).toBe("calendar_bill");
    expect(result.action.dueAt).toBe("2026-06-01T09:00:00.000Z");
    expect(store.actions[0]?.id).toBe(result.action.id);
  });
});
