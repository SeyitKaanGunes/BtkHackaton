import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { StatementPreviewItem } from "@fintwin/shared";
import { PrismaService } from "../prisma/prisma.service.js";

type StatementSourceType = "pdf-text" | "pdf-vision" | "image";
type StatementDocumentStatus = "extracted" | "imported";
type TokenUsage = { promptTokens: number; completionTokens: number; totalTokens: number };

export interface StatementCachedExtraction {
  items: StatementPreviewItem[];
  warnings: string[];
  statementMonth: string;
  totalAmount: number;
  candidateLineCount?: number;
  expectedTotalAmount?: number;
  sourceType: StatementSourceType;
  avgConfidence: number;
  tokenUsage: TokenUsage;
}

export interface StatementPreviewDocument extends StatementCachedExtraction {
  id: string;
  userId: string;
  status: StatementDocumentStatus;
  fileName?: string;
  createdAt: Date;
}

export interface CreateDocumentInput {
  userId: string;
  fileHash: string | null;
  fileName?: string;
  statementMonth: string;
  totalAmount: number;
  candidateLineCount?: number;
  expectedTotalAmount?: number;
  items: StatementPreviewItem[];
  warnings: string[];
  sourceType: StatementSourceType;
  avgConfidence: number;
  tokenUsage: TokenUsage;
}

type StatementDocumentRecord = {
  id: string;
  userId: string;
  status: string;
  fileName: string | null;
  statementMonth: string | null;
  sourceType: string | null;
  tokenUsage: unknown;
  totalAmount: unknown;
  rawResult: unknown;
  createdAt: Date;
};

@Injectable()
export class StatementDocumentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCachedExtraction(userId: string, fileHash: string): Promise<StatementCachedExtraction | undefined> {
    const document = await this.prisma.document.findFirst({
      where: { userId, kind: "statement", fileHash },
      orderBy: { createdAt: "desc" }
    });
    if (!document) return undefined;

    const mapped = mapDocument(document);
    return {
      items: mapped.items.map(stripExistingTransactionId),
      warnings: mapped.warnings,
      statementMonth: mapped.statementMonth,
      totalAmount: mapped.totalAmount,
      candidateLineCount: mapped.candidateLineCount,
      expectedTotalAmount: mapped.expectedTotalAmount,
      sourceType: mapped.sourceType,
      avgConfidence: mapped.avgConfidence,
      tokenUsage: mapped.tokenUsage
    };
  }

  async create(input: CreateDocumentInput): Promise<StatementPreviewDocument> {
    const rawResult = {
      items: input.items,
      warnings: input.warnings,
      statementMonth: input.statementMonth,
      totalAmount: input.totalAmount,
      candidateLineCount: input.candidateLineCount,
      expectedTotalAmount: input.expectedTotalAmount,
      sourceType: input.sourceType,
      avgConfidence: input.avgConfidence
    };

    const document = await this.prisma.document.create({
      data: {
        userId: input.userId,
        kind: "statement",
        status: "extracted",
        fileHash: input.fileHash,
        fileName: input.fileName,
        statementMonth: input.statementMonth,
        sourceType: input.sourceType,
        tokenUsage: input.tokenUsage as Prisma.InputJsonObject,
        totalAmount: String(input.totalAmount),
        rawResult: rawResult as unknown as Prisma.InputJsonObject
      }
    });

    return mapDocument(document);
  }

  async getById(id: string, userId: string): Promise<StatementPreviewDocument | undefined> {
    const document = await this.prisma.document.findFirst({
      where: { id, userId, kind: "statement" }
    });
    return document ? mapDocument(document) : undefined;
  }

  async markImported(id: string, importedAt: Date): Promise<void> {
    await this.prisma.document.update({
      where: { id },
      data: { status: "imported", importedAt }
    });
  }
}

function mapDocument(document: StatementDocumentRecord): StatementPreviewDocument {
  const rawResult = asRecord(document.rawResult);
  if (!rawResult) throw invalidStatementDocument("rawResult is missing.");

  const statementMonth = normalizeString(rawResult.statementMonth) ?? document.statementMonth;
  const sourceType = normalizeSourceType(rawResult.sourceType) ?? normalizeSourceType(document.sourceType);
  if (!statementMonth || !/^\d{4}-\d{2}$/.test(statementMonth)) throw invalidStatementDocument("statementMonth is invalid.");
  if (!sourceType) throw invalidStatementDocument("sourceType is invalid.");
  const items = normalizeItems(rawResult.items);
  if (items.length === 0) throw invalidStatementDocument("items are empty.");

  return {
    id: document.id,
    userId: document.userId,
    status: normalizeStatus(document.status),
    fileName: document.fileName ?? undefined,
    createdAt: document.createdAt,
    items,
    warnings: normalizeWarnings(rawResult.warnings),
    statementMonth,
    totalAmount: requiredNonNegativeNumber(rawResult.totalAmount ?? document.totalAmount, "totalAmount"),
    candidateLineCount: optionalNonNegativeInteger(rawResult.candidateLineCount, "candidateLineCount"),
    expectedTotalAmount: optionalNonNegativeNumber(rawResult.expectedTotalAmount, "expectedTotalAmount"),
    sourceType,
    avgConfidence: requiredConfidence(rawResult.avgConfidence, "avgConfidence"),
    tokenUsage: normalizeTokenUsage(document.tokenUsage)
  };
}

function stripExistingTransactionId(item: StatementPreviewItem): StatementPreviewItem {
  return {
    merchant: item.merchant,
    amount: item.amount,
    occurredAt: item.occurredAt,
    categoryName: item.categoryName,
    paymentMethod: item.paymentMethod,
    confidence: item.confidence,
    index: item.index
  };
}

function normalizeItems(value: unknown): StatementPreviewItem[] {
  if (!Array.isArray(value)) throw invalidStatementDocument("items must be an array.");
  return value.map((item, fallbackIndex) => {
    const record = asRecord(item);
    if (!record) throw invalidStatementDocument(`item ${fallbackIndex + 1} must be an object.`);
    const occurredAt = requiredDateOnly(record.occurredAt, `item ${fallbackIndex + 1} occurredAt`);
    return {
      merchant: requiredString(record.merchant, `item ${fallbackIndex + 1} merchant`),
      amount: requiredPositiveNumber(record.amount, `item ${fallbackIndex + 1} amount`),
      occurredAt,
      categoryName: requiredString(record.categoryName, `item ${fallbackIndex + 1} categoryName`),
      paymentMethod: requiredPaymentMethod(record.paymentMethod, `item ${fallbackIndex + 1} paymentMethod`),
      confidence: requiredConfidence(record.confidence, `item ${fallbackIndex + 1} confidence`),
      index: Number.isInteger(record.index) ? Number(record.index) : fallbackIndex,
      existingTransactionId: normalizeString(record.existingTransactionId)
    };
  });
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((warning) => String(warning).trim()).filter(Boolean);
}

function normalizeTokenUsage(value: unknown): TokenUsage {
  const record = asRecord(value);
  return {
    promptTokens: normalizeNumber(record?.promptTokens, 0),
    completionTokens: normalizeNumber(record?.completionTokens, 0),
    totalTokens: normalizeNumber(record?.totalTokens, 0)
  };
}

function normalizeStatus(value: string): StatementDocumentStatus {
  return value === "imported" ? "imported" : "extracted";
}

function normalizeSourceType(value: unknown): StatementSourceType | undefined {
  return value === "pdf-text" || value === "pdf-vision" || value === "image" ? value : undefined;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredString(value: unknown, field: string): string {
  const text = normalizeString(value);
  if (!text) throw invalidStatementDocument(`${field} is required.`);
  return text;
}

function normalizeNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function requiredPositiveNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw invalidStatementDocument(`${field} must be positive.`);
  return number;
}

function requiredNonNegativeNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw invalidStatementDocument(`${field} must be zero or greater.`);
  return number;
}

function optionalNonNegativeNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw invalidStatementDocument(`${field} must be zero or greater.`);
  return number;
}

function optionalNonNegativeInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw invalidStatementDocument(`${field} must be a non-negative integer.`);
  return number;
}

function requiredConfidence(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw invalidStatementDocument(`${field} must be between 0 and 1.`);
  return number;
}

function requiredDateOnly(value: unknown, field: string): string {
  const text = requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw invalidStatementDocument(`${field} must be YYYY-MM-DD.`);
  const date = new Date(`${text}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw invalidStatementDocument(`${field} must be a valid date.`);
  }
  return text;
}

function requiredPaymentMethod(value: unknown, field: string): StatementPreviewItem["paymentMethod"] {
  if (value === "cash" || value === "debit_card" || value === "credit_card" || value === "transfer") return value;
  throw invalidStatementDocument(`${field} is invalid.`);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function invalidStatementDocument(reason: string): BadRequestException {
  return new BadRequestException(`Cached statement document is invalid: ${reason}`);
}
