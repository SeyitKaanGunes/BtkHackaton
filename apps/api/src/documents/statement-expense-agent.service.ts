import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  type StatementConfirmResult,
  type StatementLineItem,
  type StatementPreviewItem,
  type StatementPreviewResult,
  type StatementSubscriptionCandidate,
  type Transaction
} from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";
import { mapCategoryNameToId } from "./category-mapper.js";
import { DocumentsService } from "./documents.service.js";
import { computeFileHash } from "./file-hash.js";
import { analyzeConsistency } from "./statement-consistency.js";
import { StatementDocumentRepository } from "./statement-document.repository.js";
import { markDuplicates } from "./statement-duplicate-detector.js";

const CACHE_HIT_WARNING = "Aynı dosyadan önbelleklenmiş sonuç kullanıldı.";

@Injectable()
export class StatementExpenseAgentService {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(DataStoreService) private readonly store: DataStoreService,
    @Inject(StatementDocumentRepository) private readonly documentRepository: StatementDocumentRepository
  ) {}

  async previewStatement(
    userId: string,
    input: {
      fileBase64?: string;
      mimeType?: string;
      fileName?: string;
      imageBase64?: string;
      statementText?: string;
    }
  ): Promise<StatementPreviewResult> {
    const fileBase64 = input.fileBase64 ?? input.imageBase64;
    const fileHash = fileBase64 ? computeFileHash(fileBase64) : null;
    const cached = fileHash ? await this.documentRepository.findCachedExtraction(userId, fileHash) : undefined;
    const extraction = cached
      ? {
          ...cached,
          items: cached.items.map(stripExistingTransactionId),
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          warnings: [...cached.warnings.filter((warning) => warning !== CACHE_HIT_WARNING), CACHE_HIT_WARNING]
        }
      : await this.documents.extractStatement(input);
    const uniqueItems = dedupeItems(extraction.items);
    const userTransactions = this.store.getPersonalData(userId).transactions;
    const items = markDuplicates(uniqueItems, userId, userTransactions);
    const consistency = analyzeConsistency(items, extraction.avgConfidence, extraction.statementMonth);
    const warnings = [...extraction.warnings, ...consistency.warnings];
    const totalAmount = Number(items.reduce((total, item) => total + item.amount, 0).toFixed(2));
    const document = await this.documentRepository.create({
      userId,
      fileHash,
      fileName: input.fileName,
      statementMonth: extraction.statementMonth,
      totalAmount,
      items,
      warnings,
      sourceType: extraction.sourceType,
      avgConfidence: extraction.avgConfidence,
      tokenUsage: extraction.tokenUsage
    });

    return {
      agentName: "Statement Agent",
      documentId: document.id,
      statementMonth: document.statementMonth,
      totalAmount: document.totalAmount,
      items: document.items,
      warnings: document.warnings,
      sourceType: document.sourceType,
      lowConfidenceCount: consistency.lowConfidenceCount,
      sumMismatch: consistency.sumMismatch,
      avgConfidence: document.avgConfidence,
      duplicateCount: document.items.filter((item) => item.existingTransactionId).length
    };
  }

  async confirmStatement(
    userId: string,
    input: {
      documentId: string;
      selectedItemIndexes?: number[];
      skipDuplicates?: boolean;
    }
  ): Promise<StatementConfirmResult> {
    const document = await this.documentRepository.getById(input.documentId, userId);
    if (!document) {
      throw new BadRequestException("Belge bulunamadı");
    }
    if (document.status === "imported") {
      throw new BadRequestException("Bu belge zaten içe aktarıldı");
    }

    const selectedIndexSet = resolveSelectedIndexSet(input.selectedItemIndexes, document.items);
    const userTransactions = this.store.getPersonalData(userId).transactions;
    const freshItems = markDuplicates(document.items.map(stripExistingTransactionId), userId, userTransactions);
    const selectedItems = freshItems.filter((item) => selectedIndexSet.has(item.index));
    if (selectedItems.length === 0) {
      throw new BadRequestException("İçe aktarılacak ekstre kalemi seçilmedi.");
    }
    const skipDuplicates = input.skipDuplicates ?? true;
    const duplicateItems = selectedItems.filter((item) => item.existingTransactionId);
    const itemsToImport = skipDuplicates ? selectedItems.filter((item) => !item.existingTransactionId) : selectedItems;
    if (itemsToImport.length === 0) {
      throw new BadRequestException("Seçilen ekstre kalemleri zaten kayıtlı; içe aktarılacak yeni kalem yok.");
    }

    const transactions: Transaction[] = [];
    for (const item of itemsToImport) {
      transactions.push(await this.store.addTransaction(this.toTransaction(userId, item)));
    }

    await this.documentRepository.markImported(document.id, new Date());
    const recurringSubscriptions = this.detectRecurringSubscriptions(userId, itemsToImport);

    return {
      agentName: "Statement Agent",
      documentId: document.id,
      importedCount: transactions.length,
      skippedCount: Math.max(0, document.items.length - selectedItems.length),
      duplicateCount: skipDuplicates ? duplicateItems.length : 0,
      transactions,
      recurringSubscriptions,
      statementMonth: document.statementMonth,
      totalAmount: Number(itemsToImport.reduce((total, item) => total + item.amount, 0).toFixed(2))
    };
  }

  private toTransaction(userId: string, item: StatementLineItem): Transaction {
    const categoryId = mapCategoryNameToId(item.categoryName, item.merchant, this.store.categories);
    return {
      id: `tx-statement-${randomUUID()}`,
      userId,
      accountId: this.store.defaultAccountIdFor(userId, item.paymentMethod),
      categoryId,
      merchant: item.merchant,
      amount: item.amount,
      currency: "TRY",
      type: "expense",
      occurredAt: `${item.occurredAt}T12:00:00.000Z`,
      paymentMethod: item.paymentMethod,
      tags: ["statement_agent", item.categoryName]
    };
  }

  private detectRecurringSubscriptions(userId: string, items: StatementLineItem[]): StatementSubscriptionCandidate[] {
    const sourceTransactions = this.store.getPersonalData(userId).transactions;
    const candidates = items
      .filter((item) => isSubscriptionLike(item))
      .map((item) => {
        const merchantKey = normalizeMerchant(item.merchant);
        const matchingHistory = sourceTransactions.filter((transaction) => normalizeMerchant(transaction.merchant) === merchantKey);
        const occurrenceCount = Math.max(1, matchingHistory.length);
        const lastChargedAt = latestDate([item.occurredAt, ...matchingHistory.map((transaction) => transaction.occurredAt)]);
        return {
          id: `recurring-${merchantKey || item.merchant}-${Math.round(item.amount)}`.replace(/[^a-z0-9-]/gi, "-"),
          merchant: item.merchant,
          amount: item.amount,
          categoryName: item.categoryName,
          occurrenceCount,
          lastChargedAt,
          nextEstimatedAt: addOneMonth(lastChargedAt),
          confidence: Math.max(item.confidence, occurrenceCount > 1 ? 0.92 : 0.78)
        };
      });

    const unique = new Map<string, StatementSubscriptionCandidate>();
    for (const candidate of candidates) {
      const key = normalizeMerchant(candidate.merchant);
      const previous = unique.get(key);
      if (!previous || candidate.confidence > previous.confidence) unique.set(key, candidate);
    }
    return [...unique.values()].sort((left, right) => right.confidence - left.confidence);
  }
}

function resolveSelectedIndexSet(value: unknown, items: StatementPreviewItem[]) {
  const validIndexes = new Set(items.map((item) => item.index));
  if (value === undefined) return validIndexes;
  if (!Array.isArray(value)) {
    throw new BadRequestException("selectedItemIndexes sayı dizisi olmalı.");
  }
  if (value.length === 0) {
    throw new BadRequestException("En az bir ekstre kalemi seçilmeli.");
  }

  const selected = new Set<number>();
  for (const index of value) {
    if (!Number.isInteger(index)) {
      throw new BadRequestException("selectedItemIndexes sadece tam sayı içermeli.");
    }
    if (!validIndexes.has(index)) {
      throw new BadRequestException(`selectedItemIndexes geçersiz kalem içeriyor: ${index}`);
    }
    if (selected.has(index)) {
      throw new BadRequestException(`selectedItemIndexes tekrar eden kalem içeriyor: ${index}`);
    }
    selected.add(index);
  }
  return selected;
}

function dedupeItems(items: StatementLineItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.occurredAt}|${item.merchant.toLocaleLowerCase("tr-TR")}|${item.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripExistingTransactionId(item: StatementPreviewItem): StatementLineItem {
  return {
    merchant: item.merchant,
    amount: item.amount,
    occurredAt: item.occurredAt,
    categoryName: item.categoryName,
    paymentMethod: item.paymentMethod,
    confidence: item.confidence
  };
}

function isSubscriptionLike(item: StatementLineItem) {
  const text = `${item.categoryName} ${item.merchant}`.toLocaleLowerCase("tr-TR");
  return /abonelik|subscription|üyelik|stream|cloud|netflix|spotify|youtube|apple|google|prime|gain|tod|exxen|blutv|digital/i.test(text);
}

function normalizeMerchant(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function latestDate(values: string[]) {
  return values
    .map((value) => value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? value.slice(0, 10))
    .sort()
    .at(-1) ?? new Date().toISOString().slice(0, 10);
}

function addOneMonth(dateText: string) {
  const date = new Date(`${dateText}T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}
