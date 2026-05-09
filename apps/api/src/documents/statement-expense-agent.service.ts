import { Inject, Injectable } from "@nestjs/common";
import { DEMO_USER_ID, type StatementImportResult, type StatementLineItem, type Transaction } from "@fintwin/shared";
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
    const transactions = uniqueItems.map((item, index) => this.store.addTransaction(this.toTransaction(item, index)));

    return {
      agentName: "Statement Agent",
      statementMonth: extraction.statementMonth,
      totalAmount: transactions.reduce((total, transaction) => total + transaction.amount, 0),
      importedCount: transactions.length,
      skippedCount: Math.max(0, extraction.items.length - uniqueItems.length),
      items: uniqueItems,
      transactions,
      evidence: [
        `Ekstre ayı: ${extraction.statementMonth}`,
        `Ayrıştırılan kalem: ${extraction.items.length}`,
        `Giderlere eklenen kalem: ${transactions.length}`
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
