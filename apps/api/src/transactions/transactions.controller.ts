import { BadRequestException, Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import type { Currency, Transaction } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

const CURRENCIES = new Set<Currency>(["TRY", "USD", "EUR"]);
const PAYMENT_METHODS = new Set<Transaction["paymentMethod"]>(["cash", "debit_card", "credit_card", "transfer"]);
const TRANSACTION_TYPES = new Set<Transaction["type"]>(["income", "expense"]);
const CSV_HEADERS = ["occurredAt", "merchant", "amount", "categoryId", "type", "paymentMethod", "currency", "accountId", "tags", "recurring"];

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
    const transaction = this.toTransaction(user.id, body, `tx-${Date.now()}`);
    return this.store.addTransaction(transaction);
  }

  @Post("import-csv")
  async importCsv(@CurrentUser() user: AuthUser, @Body() body: { csv: string }) {
    const parsedRows = parseCsv(body.csv).map((row, index) => this.toTransaction(user.id, row, `tx-csv-${Date.now()}-${index}`));
    const rows: Transaction[] = [];
    for (const row of parsedRows) {
      rows.push(await this.store.addTransaction(row));
    }
    return { imported: rows.length, rows };
  }

  private toTransaction(userId: string, body: Partial<Transaction>, id: string): Transaction {
    const type = requireTransactionType(body.type);
    const paymentMethod = requirePaymentMethod(body.paymentMethod);
    const currency = requireCurrency(body.currency);
    const categoryId = this.requireCategory(body.categoryId, type);
    return {
      id,
      userId,
      accountId: this.store.accountIdFor(userId, paymentMethod, requireOptionalText(body.accountId, "accountId")),
      categoryId,
      merchant: requireText(body.merchant, "merchant"),
      amount: requirePositiveNumber(body.amount, "amount"),
      currency,
      type,
      occurredAt: requireIsoDateTime(body.occurredAt),
      paymentMethod,
      tags: normalizeTags(body.tags),
      recurring: body.recurring === true
    };
  }

  private requireCategory(categoryId: unknown, type: Transaction["type"]) {
    const id = requireText(categoryId, "categoryId");
    const category = this.store.categories.find((item) => item.id === id);
    if (!category) {
      throw new BadRequestException(`categoryId geçersiz: ${id}`);
    }
    if (category.kind !== type) {
      throw new BadRequestException(`categoryId ${id} ${type} işlemiyle uyumlu değil.`);
    }
    return category.id;
  }
}

function parseCsv(csv: string): Array<Partial<Transaction>> {
  if (typeof csv !== "string" || !csv.trim()) {
    throw new BadRequestException("CSV içeriği boş olamaz.");
  }

  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new BadRequestException("CSV en az başlık ve bir veri satırı içermeli.");
  }

  const headers = parseCsvLine(lines[0]!).map((header) => header.trim());
  const unexpectedHeader = headers.find((header) => !CSV_HEADERS.includes(header));
  if (unexpectedHeader) {
    throw new BadRequestException(`CSV başlığı desteklenmiyor: ${unexpectedHeader}`);
  }
  for (const required of ["occurredAt", "merchant", "amount", "categoryId", "type", "paymentMethod", "currency"]) {
    if (!headers.includes(required)) {
      throw new BadRequestException(`CSV başlığı eksik: ${required}`);
    }
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) {
      throw new BadRequestException(`CSV ${rowIndex + 2}. satır sütun sayısı başlıkla eşleşmiyor.`);
    }
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? "";
    });
    return {
      occurredAt: row.occurredAt,
      merchant: row.merchant,
      amount: Number(row.amount),
      categoryId: row.categoryId,
      type: row.type as Transaction["type"],
      paymentMethod: row.paymentMethod as Transaction["paymentMethod"],
      currency: row.currency as Currency,
      accountId: row.accountId || undefined,
      tags: row.tags ? row.tags.split(";").map((tag) => tag.trim()).filter(Boolean) : [],
      recurring: row.recurring === "true"
    };
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  if (inQuotes) {
    throw new BadRequestException("CSV satırında kapanmamış tırnak var.");
  }

  result.push(current);
  return result;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} zorunlu.`);
  }
  return value.trim();
}

function requireOptionalText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} metin olmalı.`);
  }
  return value.trim();
}

function requirePositiveNumber(value: unknown, field: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new BadRequestException(`${field} pozitif sayı olmalı.`);
  }
  return Number(numberValue.toFixed(2));
}

function requireCurrency(value: unknown): Currency {
  const currency = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!CURRENCIES.has(currency as Currency)) {
    throw new BadRequestException("currency TRY, USD veya EUR olmalı.");
  }
  return currency as Currency;
}

function requirePaymentMethod(value: unknown): Transaction["paymentMethod"] {
  if (typeof value !== "string" || !PAYMENT_METHODS.has(value as Transaction["paymentMethod"])) {
    throw new BadRequestException("paymentMethod cash, debit_card, credit_card veya transfer olmalı.");
  }
  return value as Transaction["paymentMethod"];
}

function requireTransactionType(value: unknown): Transaction["type"] {
  if (typeof value !== "string" || !TRANSACTION_TYPES.has(value as Transaction["type"])) {
    throw new BadRequestException("type income veya expense olmalı.");
  }
  return value as Transaction["type"];
}

function requireIsoDateTime(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException("occurredAt zorunlu.");
  }
  const trimmed = value.trim();
  const datePart = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!datePart) {
    throw new BadRequestException("occurredAt geçerli ISO tarih olmalı.");
  }
  const calendarDate = new Date(`${datePart}T12:00:00.000Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== datePart) {
    throw new BadRequestException("occurredAt geçerli takvim tarihi olmalı.");
  }
  const parsed = trimmed === datePart ? calendarDate : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("occurredAt geçerli ISO tarih olmalı.");
  }
  return parsed.toISOString();
}

function normalizeTags(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === "string")) {
    throw new BadRequestException("tags metin dizisi olmalı.");
  }
  return value.map((tag) => tag.trim()).filter(Boolean);
}
