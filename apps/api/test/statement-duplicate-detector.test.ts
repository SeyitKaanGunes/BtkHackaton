import { describe, expect, it } from "vitest";
import type { StatementLineItem, Transaction } from "@fintwin/shared";
import { markDuplicates } from "../src/documents/statement-duplicate-detector.js";

const item: StatementLineItem = {
  merchant: "Migros",
  amount: 250.75,
  occurredAt: "2026-05-15",
  categoryName: "Market",
  paymentMethod: "credit_card",
  confidence: 0.8
};

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    userId: "user-1",
    accountId: "acc-card",
    categoryId: "cat-market",
    merchant: "migros",
    amount: 250.75,
    currency: "TRY",
    type: "expense",
    occurredAt: "2026-05-15T12:00:00.000Z",
    paymentMethod: "credit_card",
    ...overrides
  };
}

describe("markDuplicates", () => {
  it("marks same user merchant amount and date as duplicate", () => {
    const result = markDuplicates([item], "user-1", [transaction()]);
    expect(result[0]?.existingTransactionId).toBe("tx-1");
  });

  it("does not match a different user", () => {
    const result = markDuplicates([item], "user-1", [transaction({ userId: "user-2" })]);
    expect(result[0]?.existingTransactionId).toBeUndefined();
  });

  it("matches within 0.01 amount tolerance", () => {
    const result = markDuplicates([item], "user-1", [transaction({ amount: 250.755 })]);
    expect(result[0]?.existingTransactionId).toBe("tx-1");
  });

  it("does not match outside amount tolerance", () => {
    const result = markDuplicates([item], "user-1", [transaction({ amount: 250.77 })]);
    expect(result[0]?.existingTransactionId).toBeUndefined();
  });

  it("assigns zero-based indexes", () => {
    const result = markDuplicates([item, { ...item, merchant: "BİM" }], "user-1", []);
    expect(result.map((previewItem) => previewItem.index)).toEqual([0, 1]);
  });
});
