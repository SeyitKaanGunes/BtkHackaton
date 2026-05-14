import { BadGatewayException, BadRequestException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { ReceiptScanResult } from "@fintwin/shared";
import { QwenService } from "../ai/qwen.service.js";
import { StatementExtractorService, type RawExtraction } from "./statement-extractor.service.js";

const QWEN_PRIMARY_MODEL = "qwen3.6-flash-2026-04-16";

const RECEIPT_INSTRUCTION = `Sen bir Türkçe fiş/fatura çıkarıcı asistansın. Yalnızca aşağıdaki şemada saf JSON döndür, başka hiçbir metin/markdown/açıklama ekleme:
{
  "merchant": string,
  "totalAmount": number,
  "taxAmount": number,
  "occurredAt": string,
  "categoryName": string,
  "paymentMethod": "cash" | "debit_card" | "credit_card" | "transfer",
  "confidence": number,
  "lineItems": [{ "name": string, "amount": number }]
}
Kurallar:
- occurredAt ISO formatında (YYYY-MM-DD); görselde tarih okunmuyorsa boş string döndür, tarih tahmin etme.
- totalAmount ve taxAmount sayı (TL), virgül yerine nokta.
- categoryName Türkçe finans kategorisi (Market, Yemek, Ulaşım, Sağlık vb.).
- confidence 0 ile 1 arası ondalık.
- Tüm alanlar zorunlu; lineItems en az bir öğe içerir.`;

type StatementExtraction = RawExtraction & { sourceType: "pdf-text" | "pdf-vision" | "image" };

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(QwenService) private readonly qwen: QwenService,
    @Inject(StatementExtractorService) private readonly statementExtractor: StatementExtractorService
  ) {}

  async scanReceipt(input: { imageBase64?: string; mimeType?: string; textHint?: string }): Promise<ReceiptScanResult> {
    if (!input.imageBase64) {
      throw new BadRequestException("imageBase64 is required for receipt scanning.");
    }
    if (!this.qwen.isConfigured()) {
      throw new HttpException(
        {
          code: "RECEIPT_AI_NOT_CONFIGURED",
          message: "Fiş analizi için QWEN_API_KEY tanımlı değil. Demo sonuç üretilmedi."
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    const dataUrl = `data:${input.mimeType ?? "image/jpeg"};base64,${input.imageBase64}`;
    const userText =
      "Bu fiş/fatura görselinden alanları çıkar." +
      (input.textHint ? ` Kullanıcı notu: ${input.textHint}` : "");

    const response = await this.qwen.chat(
      [
        { role: "system", content: RECEIPT_INSTRUCTION },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      { model: process.env.QWEN_VISION_MODEL ?? QWEN_PRIMARY_MODEL, temperature: 0, maxTokens: 900 }
    ).catch(() => {
      throw new BadGatewayException({
        code: "RECEIPT_AI_REQUEST_FAILED",
        message: "Receipt OCR request failed."
      });
    });

    try {
      return JSON.parse(extractJson(response.content)) as ReceiptScanResult;
    } catch {
      throw new BadGatewayException({
        code: "RECEIPT_JSON_PARSE_FAILED",
        message: "Receipt OCR response could not be parsed."
      });
    }
  }

  async extractStatement(input: {
    fileBase64?: string;
    mimeType?: string;
    fileName?: string;
    imageBase64?: string;
    statementText?: string;
  }): Promise<StatementExtraction> {
    if (input.fileBase64) {
      return this.statementExtractor.extract({
        fileBase64: input.fileBase64,
        mimeType: input.mimeType ?? inferMimeType(input.fileName),
        fileName: input.fileName
      });
    }

    if (input.imageBase64) {
      return this.statementExtractor.extract({
        fileBase64: input.imageBase64,
        mimeType: input.mimeType ?? "image/jpeg",
        fileName: input.fileName
      });
    }

    if (input.statementText) {
      return {
        ...(await this.statementExtractor.extractFromText(input.statementText)),
        sourceType: "pdf-text"
      };
    }

    throw new BadRequestException("fileBase64, imageBase64 or statementText is required for statement extraction.");
  }
}

function extractJson(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  if (trimmed.startsWith("{")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}

function inferMimeType(fileName?: string): string {
  return fileName?.toLocaleLowerCase("tr-TR").endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
}
