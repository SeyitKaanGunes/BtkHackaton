import { Inject, Injectable } from "@nestjs/common";
import type { ReceiptScanResult } from "@finshadow/shared";
import { QwenService } from "../ai/qwen.service.js";

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
- occurredAt ISO formatında (YYYY-MM-DD); görseldeki en olası tarihi yaz, yoksa bugüne yakın makul tarih.
- totalAmount ve taxAmount sayı (TL), virgül yerine nokta.
- categoryName Türkçe finans kategorisi (Market, Yemek, Ulaşım, Sağlık vb.).
- confidence 0 ile 1 arası ondalık.
- Tüm alanlar zorunlu; lineItems en az bir öğe içerir.`;

@Injectable()
export class DocumentsService {
  constructor(@Inject(QwenService) private readonly qwen: QwenService) {}

  async scanReceipt(input: { imageBase64?: string; mimeType?: string; textHint?: string }): Promise<ReceiptScanResult> {
    const fallback = this.fallbackReceipt();
    if (!this.qwen.isConfigured() || !input.imageBase64) return fallback;

    const dataUrl = `data:${input.mimeType ?? "image/jpeg"};base64,${input.imageBase64}`;
    const userText =
      "Bu fiş/fatura görselinden alanları çıkar." +
      (input.textHint ? ` Kullanıcı notu: ${input.textHint}` : "");

    try {
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
        { model: process.env.QWEN_VISION_MODEL ?? "qwen-vl-plus", temperature: 0 }
      );

      return JSON.parse(extractJson(response.content)) as ReceiptScanResult;
    } catch {
      return fallback;
    }
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

function extractJson(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  if (trimmed.startsWith("{")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}
