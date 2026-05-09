import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import type { Transaction } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("transactions")
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.store.getPersonalData(user.id).transactions;
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: Partial<Transaction>) {
    const paymentMethod = body.paymentMethod ?? "debit_card";
    const transaction: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      accountId: this.store.accountIdFor(user.id, paymentMethod, body.accountId),
      categoryId: body.categoryId ?? "cat-market",
      merchant: body.merchant ?? "Manuel işlem",
      amount: Number(body.amount ?? 0),
      currency: body.currency ?? "TRY",
      type: body.type ?? "expense",
      occurredAt: body.occurredAt ?? new Date().toISOString(),
      paymentMethod,
      tags: body.tags ?? [],
      recurring: Boolean(body.recurring)
    };
    return this.store.addTransaction(transaction);
  }

  @Post("import-csv")
  async importCsv(@CurrentUser() user: AuthUser, @Body() body: { csv: string }) {
    const parsedRows = body.csv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .filter(Boolean)
      .map((line, index) => {
        const [occurredAt, merchant, amount, categoryId, type = "expense"] = line.split(",").map((item) => item.trim());
        return {
          id: `tx-csv-${Date.now()}-${index}`,
          userId: user.id,
          accountId: this.store.defaultAccountIdFor(user.id, "debit_card"),
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
