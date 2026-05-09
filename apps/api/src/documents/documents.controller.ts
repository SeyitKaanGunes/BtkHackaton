import { Body, Controller, Inject, Post } from "@nestjs/common";
import { DocumentsService } from "./documents.service.js";
import { ReceiptExpenseAgentService } from "./receipt-expense-agent.service.js";
import { StatementExpenseAgentService } from "./statement-expense-agent.service.js";

@Controller("documents")
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
  importReceipt(@Body() body: { imageBase64?: string; mimeType?: string; textHint?: string }) {
    return this.receiptAgent.importReceipt(body);
  }

  @Post("statement-agent/import")
  importStatement(@Body() body: { statementText?: string; imageBase64?: string; mimeType?: string; fileName?: string }) {
    return this.statementAgent.importStatement(body);
  }
}
