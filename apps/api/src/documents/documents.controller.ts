import { Body, Controller, Get, Inject, NotFoundException, Param, Post, UseFilters, UseGuards } from "@nestjs/common";
import type { DocumentDetail, DocumentDetailItem, DocumentHistoryItem, Transaction } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { DocumentsService } from "./documents.service.js";
import { ReceiptExpenseAgentService } from "./receipt-expense-agent.service.js";
import { StatementImportFilter } from "./statement-import.filter.js";
import { StatementExpenseAgentService } from "./statement-expense-agent.service.js";

@Controller("documents")
@UseGuards(JwtAuthGuard)
@UseFilters(StatementImportFilter)
export class DocumentsController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReceiptExpenseAgentService) private readonly receiptAgent: ReceiptExpenseAgentService,
    @Inject(StatementExpenseAgentService) private readonly statementAgent: StatementExpenseAgentService
  ) {}

  @Get()
  async history(@CurrentUser() user: AuthUser): Promise<DocumentHistoryItem[]> {
    const documents = await this.prisma.document.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40
    });
    return documents.map((document) => {
      return toDocumentHistoryItem(document);
    });
  }

  @Get(":id")
  async detail(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<DocumentDetail> {
    const document = await this.prisma.document.findFirst({ where: { id, userId: user.id } });
    if (!document) throw new NotFoundException("Document not found.");
    const raw = asRecord(document.rawResult);
    return {
      ...toDocumentHistoryItem(document),
      items: extractDocumentItems(raw),
      tokenUsage: asOptionalRecord(document.tokenUsage)
    };
  }

  @Post("receipt-scan")
  @RateLimit({ limit: 15, windowMs: 60_000, scope: "credential" })
  scanReceipt(@Body() body: { imageBase64?: string; mimeType?: string; textHint?: string }) {
    return this.documents.scanReceipt(body);
  }

  @Post("receipt-agent/import")
  @RateLimit({ limit: 10, windowMs: 60_000, scope: "credential" })
  importReceipt(@CurrentUser() user: AuthUser, @Body() body: { imageBase64?: string; mimeType?: string; textHint?: string }) {
    return this.receiptAgent.importReceipt(user.id, body);
  }

  @Post("statement-agent/preview")
  @RateLimit({ limit: 8, windowMs: 60_000, scope: "credential" })
  previewStatement(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      fileBase64?: string;
      mimeType?: string;
      fileName?: string;
      imageBase64?: string;
      statementText?: string;
    }
  ) {
    return this.statementAgent.previewStatement(user.id, body);
  }

  @Post("statement-agent/confirm")
  @RateLimit({ limit: 20, windowMs: 60_000, scope: "credential" })
  confirmStatement(
    @CurrentUser() user: AuthUser,
    @Body() body: { documentId: string; selectedItemIndexes?: number[]; skipDuplicates?: boolean }
  ) {
    return this.statementAgent.confirmStatement(user.id, body);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function toDocumentHistoryItem(document: {
  id: string;
  kind: string;
  merchant: string | null;
  totalAmount: unknown | null;
  taxAmount: unknown | null;
  occurredAt: Date | null;
  rawResult: unknown;
  status: string;
  fileName: string | null;
  statementMonth: string | null;
  sourceType: string | null;
  importedAt: Date | null;
  createdAt: Date;
}): DocumentHistoryItem {
  const raw = asRecord(document.rawResult);
  const items = extractDocumentItems(raw);
  const warnings = extractWarnings(raw);
  const lowConfidenceCount = items.filter((item) => item.confidence !== undefined && item.confidence < 0.75).length;
  return {
    id: document.id,
    kind: document.kind,
    merchant: document.merchant ?? undefined,
    totalAmount: document.totalAmount === null ? undefined : Number(document.totalAmount),
    taxAmount: document.taxAmount === null ? undefined : Number(document.taxAmount),
    occurredAt: document.occurredAt ? document.occurredAt.toISOString().slice(0, 10) : undefined,
    status: document.status,
    fileName: document.fileName ?? undefined,
    statementMonth: document.statementMonth ?? undefined,
    sourceType: document.sourceType ?? undefined,
    importedAt: document.importedAt?.toISOString(),
    createdAt: document.createdAt.toISOString(),
    warnings,
    itemCount: items.length,
    lowConfidenceCount
  };
}

function extractDocumentItems(raw: Record<string, unknown>): DocumentDetailItem[] {
  const items = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.lineItems) ? raw.lineItems : [];
  return items.map((item, index) => normalizeDocumentItem(asRecord(item), index));
}

function normalizeDocumentItem(item: Record<string, unknown>, index: number): DocumentDetailItem {
  const name = text(item.name) ?? text(item.label);
  const merchant = text(item.merchant);
  return {
    label: name ?? merchant ?? `Kalem ${index + 1}`,
    merchant,
    amount: numberOrUndefined(item.amount),
    occurredAt: text(item.occurredAt),
    categoryName: text(item.categoryName),
    paymentMethod: paymentMethodOrUndefined(item.paymentMethod),
    confidence: numberOrUndefined(item.confidence),
    duplicate: typeof item.duplicate === "boolean" ? item.duplicate : undefined
  };
}

function extractWarnings(raw: Record<string, unknown>) {
  return Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === "string") : [];
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOrUndefined(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function paymentMethodOrUndefined(value: unknown): Transaction["paymentMethod"] | undefined {
  return value === "cash" || value === "debit_card" || value === "credit_card" || value === "transfer" ? value : undefined;
}
