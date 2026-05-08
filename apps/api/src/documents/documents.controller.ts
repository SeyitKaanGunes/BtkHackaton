import { Body, Controller, Inject, Post } from "@nestjs/common";
import { DocumentsService } from "./documents.service.js";

@Controller("documents")
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documents: DocumentsService) {}

  @Post("receipt-scan")
  scanReceipt(@Body() body: { imageBase64?: string; mimeType?: string; textHint?: string }) {
    return this.documents.scanReceipt(body);
  }
}
