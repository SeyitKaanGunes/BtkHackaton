import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ReceiptExpenseImportResult, Transaction } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";
import { mapCategoryNameToId } from "./category-mapper.js";
import { DocumentsService } from "./documents.service.js";

const PAYMENT_METHODS = new Set<Transaction["paymentMethod"]>(["cash", "debit_card", "credit_card", "transfer"]);

@Injectable()
export class ReceiptExpenseAgentService {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(DataStoreService) private readonly store: DataStoreService
  ) {}

  async importReceipt(userId: string, input: { imageBase64?: string; mimeType?: string; textHint?: string }): Promise<ReceiptExpenseImportResult> {
    const receipt = validateReceipt(await this.documents.scanReceipt(input));
    const occurredAt = parseReceiptDate(receipt.occurredAt);
    const categoryId = mapCategoryNameToId(receipt.categoryName, receipt.merchant, this.store.categories);
    const transaction: Transaction = {
      id: `tx-receipt-${randomUUID()}`,
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

function validateReceipt(receipt: ReceiptExpenseImportResult["receipt"]): ReceiptExpenseImportResult["receipt"] {
  const merchant = requiredText(receipt.merchant, "RECEIPT_INVALID_MERCHANT", "Fiş satıcısı okunamadı; işlem DB'ye yazılmadı.");
  const totalAmount = positiveNumber(receipt.totalAmount, "RECEIPT_INVALID_AMOUNT", "Fiş tutarı okunamadı; işlem DB'ye yazılmadı.");
  const taxAmount = nonNegativeNumber(receipt.taxAmount, "RECEIPT_INVALID_AMOUNT", "Fiş KDV tutarı okunamadı; işlem DB'ye yazılmadı.");
  const categoryName = requiredText(receipt.categoryName, "RECEIPT_INVALID_CATEGORY", "Fiş kategorisi okunamadı; işlem DB'ye yazılmadı.");
  const paymentMethod = requiredPaymentMethod(receipt.paymentMethod);
  const confidence = confidenceNumber(receipt.confidence);
  const lineItems = requiredLineItems(receipt.lineItems);
  return { ...receipt, merchant, totalAmount, taxAmount, categoryName, paymentMethod, confidence, lineItems };
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

function requiredText(value: unknown, code: string, message: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw receiptValidationError(code, message);
  return text;
}

function positiveNumber(value: unknown, code: string, message: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw receiptValidationError(code, message);
  return number;
}

function nonNegativeNumber(value: unknown, code: string, message: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw receiptValidationError(code, message);
  return number;
}

function confidenceNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw receiptValidationError("RECEIPT_INVALID_CONFIDENCE", "Fiş güven skoru geçersiz; işlem DB'ye yazılmadı.");
  }
  return number;
}

function requiredPaymentMethod(value: unknown): Transaction["paymentMethod"] {
  if (typeof value === "string" && PAYMENT_METHODS.has(value as Transaction["paymentMethod"])) {
    return value as Transaction["paymentMethod"];
  }
  throw receiptValidationError("RECEIPT_INVALID_PAYMENT_METHOD", "Fiş ödeme yöntemi geçersiz; işlem DB'ye yazılmadı.");
}

function requiredLineItems(value: unknown): ReceiptExpenseImportResult["receipt"]["lineItems"] {
  if (!Array.isArray(value) || value.length === 0) {
    throw receiptValidationError("RECEIPT_INVALID_LINE_ITEMS", "Fiş kalemleri okunamadı; işlem DB'ye yazılmadı.");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw receiptValidationError("RECEIPT_INVALID_LINE_ITEMS", `Fiş kalemi ${index + 1} geçersiz; işlem DB'ye yazılmadı.`);
    }
    const record = item as Record<string, unknown>;
    return {
      name: requiredText(record.name, "RECEIPT_INVALID_LINE_ITEMS", `Fiş kalemi ${index + 1} adı okunamadı; işlem DB'ye yazılmadı.`),
      amount: positiveNumber(record.amount, "RECEIPT_INVALID_LINE_ITEMS", `Fiş kalemi ${index + 1} tutarı geçersiz; işlem DB'ye yazılmadı.`)
    };
  });
}

function receiptValidationError(code: string, message: string) {
  return new BadRequestException({ code, message });
}
