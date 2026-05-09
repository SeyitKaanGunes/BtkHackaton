import { Inject, Injectable } from "@nestjs/common";
import { DEMO_USER_ID, type StatementImportResult, type StatementLineItem, type StatementSubscriptionCandidate, type Transaction } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";
import { mapCategoryNameToId } from "./category-mapper.js";
import { DocumentsService } from "./documents.service.js";

@Injectable()
export class StatementExpenseAgentService {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(DataStoreService) private readonly store: DataStoreService
  ) {}

  async importStatement(input: { statementText?: string; imageBase64?: string; mimeType?: string; fileName?: string }): Promise<StatementImportResult> {
    const extraction = await this.documents.extractStatement(input);
    const uniqueItems = dedupeItems(extraction.items);
    const transactions: Transaction[] = [];
    for (const [index, item] of uniqueItems.entries()) {
      transactions.push(await this.store.addTransaction(this.toTransaction(item, index)));
    }
    const recurringSubscriptions = this.detectRecurringSubscriptions(uniqueItems);

    return {
      agentName: "Statement Agent",
      statementMonth: extraction.statementMonth,
      totalAmount: transactions.reduce((total, transaction) => total + transaction.amount, 0),
      importedCount: transactions.length,
      skippedCount: Math.max(0, extraction.items.length - uniqueItems.length),
      items: uniqueItems,
      transactions,
      recurringSubscriptions,
      evidence: [
        `Ekstre ayı: ${extraction.statementMonth}`,
        `Ayrıştırılan kalem: ${extraction.items.length}`,
        `Giderlere eklenen kalem: ${transactions.length}`,
        `Tekrar eden abonelik adayı: ${recurringSubscriptions.length}`
      ]
    };
  }

  private toTransaction(item: StatementLineItem, index: number): Transaction {
    const categoryId = mapCategoryNameToId(item.categoryName, item.merchant, this.store.categories);
    return {
      id: `tx-statement-${Date.now()}-${index}`,
      userId: DEMO_USER_ID,
      accountId: item.paymentMethod === "credit_card" ? "acc-card" : "acc-main",
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

  private detectRecurringSubscriptions(items: StatementLineItem[]): StatementSubscriptionCandidate[] {
    const sourceTransactions = this.store.transactions;
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

function dedupeItems(items: StatementLineItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.occurredAt}|${item.merchant.toLocaleLowerCase("tr-TR")}|${item.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isSubscriptionLike(item: StatementLineItem) {
  const text = `${item.categoryName} ${item.merchant}`.toLocaleLowerCase("tr-TR");
  return /abonelik|subscription|üyelik|stream|cloud|netflix|spotify|youtube|apple|google|prime|gain|tod|exxen|blutv|digital/i.test(text);
}

function normalizeMerchant(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
