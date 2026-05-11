import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { ReceiptExpenseImportResult, Transaction } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";
import { mapCategoryNameToId } from "./category-mapper.js";
import { DocumentsService } from "./documents.service.js";

@Injectable()
export class ReceiptExpenseAgentService {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(DataStoreService) private readonly store: DataStoreService
  ) {}

  async importReceipt(userId: string, input: { imageBase64?: string; mimeType?: string; textHint?: string }): Promise<ReceiptExpenseImportResult> {
    const receipt = await this.documents.scanReceipt(input);
    const occurredAt = parseReceiptDate(receipt.occurredAt);
    if (!receipt.merchant.trim()) {
      throw new BadRequestException({ code: "RECEIPT_INVALID_MERCHANT", message: "Fiş satıcısı okunamadı; işlem DB'ye yazılmadı." });
    }
    if (!Number.isFinite(receipt.totalAmount) || receipt.totalAmount <= 0) {
      throw new BadRequestException({ code: "RECEIPT_INVALID_AMOUNT", message: "Fiş tutarı okunamadı; işlem DB'ye yazılmadı." });
    }
    const categoryId = mapCategoryNameToId(receipt.categoryName, receipt.merchant, this.store.categories);
    const transaction: Transaction = {
      id: `tx-receipt-${Date.now()}`,
      userId,
      accountId: this.store.defaultAccountIdFor(userId, receipt.paymentMethod),
      categoryId,
      merchant: receipt.merchant.trim(),
      amount: receipt.totalAmount,
      currency: "TRY",
      type: "expense",
      occurredAt,
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

function parseReceiptDate(date: string) {
  const normalized = typeof date === "string" ? date.match(/\d{4}-\d{2}-\d{2}/)?.[0] : undefined;
  if (!normalized) {
    throw new BadRequestException({ code: "RECEIPT_INVALID_DATE", message: "Fiş tarihi okunamadı; bugüne çekilmeden işlem reddedildi." });
  }
  const parsed = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new BadRequestException({ code: "RECEIPT_INVALID_DATE", message: "Fiş tarihi geçerli değil; işlem DB'ye yazılmadı." });
  }
  return parsed.toISOString();
}
