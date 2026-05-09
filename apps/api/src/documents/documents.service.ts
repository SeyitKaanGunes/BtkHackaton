import { BadGatewayException, BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { ReceiptScanResult, StatementLineItem } from "@fintwin/shared";
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

const STATEMENT_INSTRUCTION = `Sen bir Türkçe kredi kartı/banka ekstresi ayrıştırma agentısın. Yalnızca saf JSON döndür:
{
  "statementMonth": "YYYY-MM",
  "items": [
    {
      "merchant": string,
      "amount": number,
      "occurredAt": "YYYY-MM-DD",
      "categoryName": string,
      "paymentMethod": "cash" | "debit_card" | "credit_card" | "transfer",
      "confidence": number
    }
  ]
}
Kurallar:
- Yalnızca harcama/gider kalemlerini çıkar; kart ödemesi, borç ödeme, dönem borcu özeti, limit, iade ve gelir kalemlerini alma.
- amount TL cinsinden pozitif sayı olsun; virgül yerine nokta kullan.
- categoryName Türkçe finans kategorisi olsun: Market, Yemek, Ulaşım, Teknoloji, Giyim, Abonelik, Kira veya Diğer.
- Tarih eksikse ekstre ayını kullanarak en olası günü yaz.
- Aynı satırı iki kez ekleme.`;

interface StatementExtraction {
  statementMonth: string;
  items: StatementLineItem[];
}

@Injectable()
export class DocumentsService {
  constructor(@Inject(QwenService) private readonly qwen: QwenService) {}

  async scanReceipt(input: { imageBase64?: string; mimeType?: string; textHint?: string }): Promise<ReceiptScanResult> {
    if (!input.imageBase64) {
      throw new BadRequestException("imageBase64 is required for receipt scanning.");
    }
    if (!this.qwen.isConfigured()) {
      throw new ServiceUnavailableException("QWEN_API_KEY is not configured for receipt scanning.");
    }

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
      throw new BadGatewayException("Receipt OCR response could not be parsed.");
    }
  }

  async extractStatement(input: { statementText?: string; imageBase64?: string; mimeType?: string; fileName?: string }): Promise<StatementExtraction> {
    if (!input.statementText && !input.imageBase64) {
      throw new BadRequestException("statementText or imageBase64 is required for statement extraction.");
    }
    if (!this.qwen.isConfigured()) {
      throw new ServiceUnavailableException("QWEN_API_KEY is not configured for statement extraction.");
    }

    const prompt =
      "Bu ay sonu ekstresinden harcama kalemlerini çıkar ve kategorize et." +
      (input.fileName ? ` Dosya adı: ${input.fileName}.` : "") +
      (input.statementText ? ` Ekstre metni:\n${input.statementText.slice(0, 24000)}` : "");

    try {
      const userContent = input.imageBase64
        ? [
            { type: "text" as const, text: prompt },
            { type: "image_url" as const, image_url: { url: `data:${input.mimeType ?? "image/jpeg"};base64,${input.imageBase64}` } }
          ]
        : prompt;
      const response = await this.qwen.chat(
        [
          { role: "system", content: STATEMENT_INSTRUCTION },
          { role: "user", content: userContent }
        ],
        { model: input.imageBase64 ? process.env.QWEN_VISION_MODEL ?? "qwen-vl-plus" : undefined, temperature: 0 }
      );
      const parsed = JSON.parse(extractJson(response.content)) as Partial<StatementExtraction>;
      return {
        statementMonth: sanitizeMonth(parsed.statementMonth),
        items: sanitizeStatementItems(parsed.items)
      };
    } catch {
      throw new BadGatewayException("Statement extraction response could not be parsed.");
    }
  }
}

function extractJson(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  if (trimmed.startsWith("{")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}

function sanitizeMonth(value?: string) {
  const match = value?.match(/\d{4}-\d{2}/);
  return match?.[0] ?? "2026-05";
}

function sanitizeStatementItems(items?: StatementLineItem[]) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && Number(item.amount) > 0 && item.merchant)
    .map((item) => ({
      merchant: String(item.merchant).trim(),
      amount: Number(item.amount),
      occurredAt: normalizeDate(item.occurredAt),
      categoryName: String(item.categoryName || "Diğer").trim(),
      paymentMethod: normalizePaymentMethod(item.paymentMethod),
      confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.75)))
    }));
}

function normalizeDate(value?: string) {
  const text = String(value ?? "");
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? new Date().toISOString().slice(0, 10);
}

function normalizePaymentMethod(value?: string): StatementLineItem["paymentMethod"] {
  return value === "cash" || value === "debit_card" || value === "transfer" ? value : "credit_card";
}
