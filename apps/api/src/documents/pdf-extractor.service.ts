import { Injectable } from "@nestjs/common";
import { PDFParse } from "pdf-parse";
import { StatementImportException } from "./statement-import.exception.js";

@Injectable()
export class PdfExtractorService {
  async extractText(base64: string): Promise<{ text: string; pageCount: number }> {
    const parser = new PDFParse({ data: Buffer.from(base64, "base64") });
    try {
      const data = await parser.getText();
      return {
        text: data.text ?? "",
        pageCount: data.total ?? 0
      };
    } catch {
      throw new StatementImportException("STATEMENT_TEXT_EXTRACTION_FAILED", "PDF metni çıkarılamadı.");
    } finally {
      await parser.destroy();
    }
  }
}

export function isTextExtractionWeak(text: string): boolean {
  return text.trim().length < 200;
}
