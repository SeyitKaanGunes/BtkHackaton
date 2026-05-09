import { Inject, Injectable } from "@nestjs/common";
import { DEMO_USER_ID, type ReceiptExpenseImportResult, type Transaction } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";
import { mapCategoryNameToId } from "./category-mapper.js";
import { DocumentsService } from "./documents.service.js";

@Injectable()
export class ReceiptExpenseAgentService {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(DataStoreService) private readonly store: DataStoreService
  ) {}

  async importReceipt(input: { imageBase64?: string; mimeType?: string; textHint?: string }): Promise<ReceiptExpenseImportResult> {
    const receipt = await this.documents.scanReceipt(input);
    const categoryId = mapCategoryNameToId(receipt.categoryName, receipt.merchant, this.store.categories);
    const transaction: Transaction = {
      id: `tx-receipt-${Date.now()}`,
      userId: DEMO_USER_ID,
      accountId: receipt.paymentMethod === "credit_card" ? "acc-card" : "acc-main",
      categoryId,
      merchant: receipt.merchant,
      amount: receipt.totalAmount,
      currency: "TRY",
      type: "expense",
      occurredAt: toIsoDate(receipt.occurredAt),
      paymentMethod: receipt.paymentMethod,
      tags: ["receipt_agent"]
    };

    return {
      agentName: "Receipt Agent",
      receipt,
      transaction: await this.store.addTransaction(transaction),
      addedToExpenses: true,
      evidence: [
        `Satıcı: ${receipt.merchant}`,
        `Kategori: ${receipt.categoryName} -> ${categoryId}`,
        `Güven skoru: ${Math.round(receipt.confidence * 100)}%`
      ]
    };
  }
}

function toIsoDate(date: string) {
  const normalized = date.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? new Date().toISOString().slice(0, 10);
  return `${normalized}T12:00:00.000Z`;
}
