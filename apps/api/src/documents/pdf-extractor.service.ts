import { Injectable } from "@nestjs/common";
import { PDFParse } from "pdf-parse";
import { StatementImportException } from "./statement-import.exception.js";

export interface PdfPageImage {
  pageNumber: number;
  mimeType: "image/png";
  base64: string;
  width: number;
  height: number;
}

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

  async renderPageImages(base64: string, maxPages = 3): Promise<{ images: PdfPageImage[]; pageCount: number }> {
    const parser = new PDFParse({ data: Buffer.from(base64, "base64") });
    try {
      const info = await parser.getInfo();
      if (info.total < 1) {
        throw new StatementImportException("STATEMENT_PDF_RENDER_FAILED", "PDF içinde işlenecek sayfa bulunamadı.");
      }
      if (info.total > maxPages) {
        throw new StatementImportException(
          "STATEMENT_PDF_VISION_PAGE_LIMIT",
          `PDF ${info.total} sayfa; vision OCR fallback en fazla ${maxPages} sayfa işler.`
        );
      }

      const screenshots = await parser.getScreenshot({
        first: info.total,
        desiredWidth: 1600,
        imageBuffer: true,
        imageDataUrl: false
      });
      const images = screenshots.pages.map((page) => ({
        pageNumber: page.pageNumber,
        mimeType: "image/png" as const,
        base64: Buffer.from(page.data).toString("base64"),
        width: page.width,
        height: page.height
      }));
      if (images.length === 0) {
        throw new StatementImportException("STATEMENT_PDF_RENDER_FAILED", "PDF sayfaları görsele çevrilemedi.");
      }
      return { images, pageCount: info.total };
    } catch (error) {
      if (error instanceof StatementImportException) throw error;
      throw new StatementImportException("STATEMENT_PDF_RENDER_FAILED", "PDF sayfaları görsele çevrilemedi.");
    } finally {
      await parser.destroy();
    }
  }
}

export function isTextExtractionWeak(text: string): boolean {
  return text.trim().length < 200;
}
