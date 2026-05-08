import { Injectable } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import type { ReceiptScanResult } from "@finshadow/shared";

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
  async scanReceipt(input: { imageBase64?: string; mimeType?: string; textHint?: string }): Promise<ReceiptScanResult> {
    if (!process.env.GOOGLE_API_KEY || !input.imageBase64) {
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

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Bu fiş/fatura görselinden finans kaydı için alanları çıkar. " +
                "Tarih yoksa bugüne yakın makul tarih değil, null yerine görüntüdeki en olası tarihi yaz. " +
                (input.textHint ? `Kullanıcı notu: ${input.textHint}` : "")
            },
            { inlineData: { mimeType: input.mimeType ?? "image/jpeg", data: input.imageBase64 } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: receiptSchema
      }
    } as never);
    return JSON.parse(response.text ?? "{}") as ReceiptScanResult;
  }
}
