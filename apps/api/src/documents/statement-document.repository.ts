import { Inject, Injectable } from "@nestjs/common";
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
    try {
      const document = await this.prisma.document.findFirst({
        where: { userId, kind: "statement", fileHash },
        orderBy: { createdAt: "desc" }
      });
      if (!document) return undefined;

      const mapped = mapDocument(document);
      if (!mapped) return undefined;
      return {
        items: mapped.items.map(stripExistingTransactionId),
        warnings: mapped.warnings,
        statementMonth: mapped.statementMonth,
        totalAmount: mapped.totalAmount,
        sourceType: mapped.sourceType,
        avgConfidence: mapped.avgConfidence,
        tokenUsage: mapped.tokenUsage
      };
    } catch (error) {
      console.warn("Statement cache lookup failed", error);
      return undefined;
    }
  }

  async create(input: CreateDocumentInput): Promise<StatementPreviewDocument> {
    const rawResult = {
      items: input.items,
      warnings: input.warnings,
      statementMonth: input.statementMonth,
      totalAmount: input.totalAmount,
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

    const mapped = mapDocument(document);
    if (!mapped) {
      throw new Error("Created statement document could not be mapped.");
    }
    return mapped;
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

function mapDocument(document: StatementDocumentRecord): StatementPreviewDocument | undefined {
  const rawResult = asRecord(document.rawResult);
  if (!rawResult) return undefined;

  const statementMonth = normalizeString(rawResult.statementMonth) ?? document.statementMonth;
  const sourceType = normalizeSourceType(rawResult.sourceType) ?? normalizeSourceType(document.sourceType);
  if (!statementMonth || !sourceType) return undefined;

  return {
    id: document.id,
    userId: document.userId,
    status: normalizeStatus(document.status),
    fileName: document.fileName ?? undefined,
    createdAt: document.createdAt,
    items: normalizeItems(rawResult.items),
    warnings: normalizeWarnings(rawResult.warnings),
    statementMonth,
    totalAmount: normalizeNumber(rawResult.totalAmount, normalizeNumber(document.totalAmount, 0)),
    sourceType,
    avgConfidence: normalizeNumber(rawResult.avgConfidence, 0),
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
  if (!Array.isArray(value)) return [];
  return value.map((item, fallbackIndex) => {
    const record = asRecord(item);
    return {
      merchant: normalizeString(record?.merchant) ?? "",
      amount: normalizeNumber(record?.amount, 0),
      occurredAt: normalizeString(record?.occurredAt) ?? "",
      categoryName: normalizeString(record?.categoryName) ?? "Diğer",
      paymentMethod: normalizePaymentMethod(record?.paymentMethod),
      confidence: normalizeNumber(record?.confidence, 0),
      index: Number.isInteger(record?.index) ? Number(record?.index) : fallbackIndex,
      existingTransactionId: normalizeString(record?.existingTransactionId)
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

function normalizePaymentMethod(value: unknown): StatementPreviewItem["paymentMethod"] {
  return value === "cash" || value === "debit_card" || value === "credit_card" || value === "transfer" ? value : "credit_card";
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

function normalizeNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
