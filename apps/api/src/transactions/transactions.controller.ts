import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import type { Transaction } from "@fintwin/shared";
import { DEMO_USER_ID } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("transactions")
export class TransactionsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  list() {
    return this.store.transactions;
  }

  @Post()
  async create(@Body() body: Partial<Transaction>) {
    const transaction: Transaction = {
      id: `tx-${Date.now()}`,
      userId: body.userId ?? DEMO_USER_ID,
      accountId: body.accountId ?? "acc-main",
      categoryId: body.categoryId ?? "cat-market",
      merchant: body.merchant ?? "Manuel işlem",
      amount: Number(body.amount ?? 0),
      currency: body.currency ?? "TRY",
      type: body.type ?? "expense",
      occurredAt: body.occurredAt ?? new Date().toISOString(),
      paymentMethod: body.paymentMethod ?? "debit_card",
      tags: body.tags ?? [],
      recurring: Boolean(body.recurring)
    };
    return this.store.addTransaction(transaction);
  }

  @Post("import-csv")
  async importCsv(@Body() body: { csv: string }) {
    const parsedRows = body.csv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .filter(Boolean)
      .map((line, index) => {
        const [occurredAt, merchant, amount, categoryId, type = "expense"] = line.split(",").map((item) => item.trim());
        return {
          id: `tx-csv-${Date.now()}-${index}`,
          userId: DEMO_USER_ID,
          accountId: "acc-main",
          categoryId: categoryId || "cat-market",
          merchant: merchant || "CSV işlem",
          amount: Number(amount || 0),
          currency: "TRY",
          type: type === "income" ? "income" : "expense",
          occurredAt: occurredAt || new Date().toISOString(),
          paymentMethod: "debit_card"
        } satisfies Transaction;
      });
    const rows: Transaction[] = [];
    for (const row of parsedRows) {
      rows.push(await this.store.addTransaction(row));
    }
    return { imported: rows.length, rows };
  }
}
