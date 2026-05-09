import { Body, Controller, Inject, Post, UseFilters, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
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
    @Inject(ReceiptExpenseAgentService) private readonly receiptAgent: ReceiptExpenseAgentService,
    @Inject(StatementExpenseAgentService) private readonly statementAgent: StatementExpenseAgentService
  ) {}

  @Post("receipt-scan")
  scanReceipt(@Body() body: { imageBase64?: string; mimeType?: string; textHint?: string }) {
    return this.documents.scanReceipt(body);
  }

  @Post("receipt-agent/import")
  importReceipt(@CurrentUser() user: AuthUser, @Body() body: { imageBase64?: string; mimeType?: string; textHint?: string }) {
    return this.receiptAgent.importReceipt(user.id, body);
  }

  @Post("statement-agent/import")
  importStatement(
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
    return this.statementAgent.importStatement(user.id, body);
  }

  @Post("statement-agent/preview")
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
  confirmStatement(
    @CurrentUser() user: AuthUser,
    @Body() body: { documentId: string; selectedItemIndexes?: number[]; skipDuplicates?: boolean }
  ) {
    return this.statementAgent.confirmStatement(user.id, body);
  }
}
