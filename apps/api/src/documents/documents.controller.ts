import { Body, Controller, Get, Inject, Post, UseFilters, UseGuards } from "@nestjs/common";
import type { DocumentHistoryItem } from "@fintwin/shared";
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
      const raw = asRecord(document.rawResult);
      const items = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.lineItems) ? raw.lineItems : [];
      const warnings = Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === "string") : [];
      const lowConfidenceCount = items.filter((item) => {
        const confidence = Number(asRecord(item).confidence);
        return Number.isFinite(confidence) && confidence < 0.75;
      }).length;
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
    });
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
