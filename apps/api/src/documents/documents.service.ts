import { Inject, Injectable } from "@nestjs/common";
import type { ReceiptScanResult } from "@finshadow/shared";
import { QwenService } from "../ai/qwen.service.js";

const receiptSchema = {
  type: "object",
  properties: {
    merchant: { type: "string", description: "Satıcı/işletme adı" },
    totalAmount: { type: "number", description: "Toplam tutar" },
    taxAmount: { type: "number", description: "KDV veya vergi tutarı" },
    occurredAt: { type: "string", description: "ISO tarih" },
    categoryName: { type: "string", description: "Finans kategorisi" },
    paymentMethod: { type: "string", enum: ["cash", "debit_card", "credit_card", "transfer"] },
    confidence: { type: "number" },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" }
        },
        required: ["name", "amount"]
      }
    }
  },
  required: ["merchant", "totalAmount", "taxAmount", "occurredAt", "categoryName", "paymentMethod", "confidence", "lineItems"]
};

@Injectable()
export class DocumentsService {
  constructor(@Inject(QwenService) private readonly qwen: QwenService) {}

  async scanReceipt(input: { imageBase64?: string; mimeType?: string; textHint?: string }): Promise<ReceiptScanResult> {
    const fallback = this.fallbackReceipt();
    if (!this.qwen.isConfigured()) return fallback;

    const instruction =
      "Bu fiş/fatura içeriğinden finans kaydı için JSON çıkar. Sadece JSON dön. " +
      "Alanlar: merchant, totalAmount, taxAmount, occurredAt, categoryName, paymentMethod, confidence, lineItems. " +
      `JSON schema: ${JSON.stringify(receiptSchema)}. ` +
      (input.textHint ? `Kullanıcı notu: ${input.textHint}` : "");

    return this.qwen.chatJson<ReceiptScanResult>(
      [
        { role: "system", content: "Finansal OCR asistanısın. Yanıtın geçerli JSON olmalı." },
        {
          role: "user",
          content: input.imageBase64
            ? [
                { type: "text", text: instruction },
                { type: "image_url", image_url: { url: `data:${input.mimeType ?? "image/jpeg"};base64,${input.imageBase64}` } }
              ]
            : instruction
        }
      ],
      fallback
    );
  }

  private fallbackReceipt(): ReceiptScanResult {
    return {
      merchant: "Demo Market",
      totalAmount: 1249.9,
      taxAmount: 113.63,
      occurredAt: "2026-05-08",
      categoryName: "Market",
      paymentMethod: "credit_card",
      confidence: 0.91,
      lineItems: [
        { name: "Temel gıda", amount: 720.4 },
        { name: "Temizlik", amount: 529.5 }
      ]
    };
  }
}
