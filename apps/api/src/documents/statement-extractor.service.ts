import { Inject, Injectable, HttpStatus } from "@nestjs/common";
import type { StatementLineItem } from "@fintwin/shared";
import { QwenService } from "../ai/qwen.service.js";
import { isTextExtractionWeak, PdfExtractorService } from "./pdf-extractor.service.js";
import { StatementImportException } from "./statement-import.exception.js";
import { cleanStatementText } from "./statement-line-cleaner.js";
import { chunkLines } from "./statement-chunker.js";
import { validateItems } from "./statement-validator.js";

const STATEMENT_CHUNK_INSTRUCTION = `Türkçe ekstre satırlarından gider kalemlerini çıkar. SADECE bu JSON dön, açıklama/markdown yok:
{"items":[{"merchant":"","amount":0,"occurredAt":"YYYY-MM-DD","categoryName":"","paymentMethod":"credit_card","confidence":0}],"warnings":[]}
Kurallar:
- Yalnızca harcama; kart ödemesi/iade/limit/asgari ödeme/dönem borcu satırlarını DAHIL ETME.
- amount pozitif TL, virgül yerine nokta.
- categoryName: Market|Yemek|Ulaşım|Teknoloji|Giyim|Abonelik|Kira|Sağlık|Diğer.
- paymentMethod: credit_card|debit_card|cash|transfer.
- confidence 0-1 arası.
- Anlamsız/şüpheli satırları items'a koyma, kısa not olarak warnings'a ekle.`;

export interface RawExtraction {
  items: StatementLineItem[];
  warnings: string[];
  statementMonth: string;
  totalAmount: number;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  avgConfidence: number;
}

type ChunkExtraction = {
  items?: unknown[];
  warnings?: unknown[];
};

@Injectable()
export class StatementExtractorService {
  constructor(
    @Inject(QwenService) private readonly qwen: QwenService,
    @Inject(PdfExtractorService) private readonly pdfExtractor: PdfExtractorService
  ) {}

  async extractFromText(text: string): Promise<RawExtraction> {
    this.ensureQwenConfigured();

    const { candidateLines, droppedCount } = cleanStatementText(text);
    const chunks = chunkLines(candidateLines);
    if (chunks.length === 0) {
      throw new StatementImportException("STATEMENT_NO_VALID_ITEMS", "Ekstre metninden işlenebilir harcama satırı bulunamadı.");
    }

    const rawItems: unknown[] = [];
    const warnings: string[] = droppedCount > 0 ? [`Ekstre temizleme sırasında ${droppedCount} satır atıldı.`] : [];
    const tokenUsage = emptyTokenUsage();
    let parsedChunkCount = 0;

    for (const [index, chunk] of chunks.entries()) {
      console.log(`[StatementExtractor] Extracting statement chunk ${index + 1}/${chunks.length}`);
      try {
        const response = await this.qwen.chat(
          [
            { role: "system", content: STATEMENT_CHUNK_INSTRUCTION },
            { role: "user", content: chunk.join("\n") }
          ],
          { temperature: 0 }
        );
        addUsage(tokenUsage, response.usage);

        const parsed = parseChunkExtraction(response.content);
        parsedChunkCount += 1;
        rawItems.push(...(Array.isArray(parsed.items) ? parsed.items : []));
        warnings.push(...normalizeWarnings(parsed.warnings));
      } catch (error) {
        if (error instanceof SyntaxError) {
          warnings.push(`Chunk parse başarısız: ${index + 1}`);
          continue;
        }
        throw error;
      }
    }

    if (parsedChunkCount === 0) {
      throw new StatementImportException("STATEMENT_JSON_PARSE_FAILED", "Qwen ekstre yanıtı JSON olarak ayrıştırılamadı.");
    }

    const validated = validateItems(rawItems);
    warnings.push(...validated.warnings);
    return buildRawExtraction(validated.valid, warnings, tokenUsage);
  }

  async extractFromImage(base64: string, mimeType: string): Promise<RawExtraction> {
    this.ensureQwenConfigured();

    try {
      const extracted = await this.extractImageItems(base64, mimeType, "Ekstre görselindeki harcama satırlarını çıkar.");
      return buildRawExtraction(extracted.items, extracted.warnings, extracted.tokenUsage);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new StatementImportException("STATEMENT_JSON_PARSE_FAILED", "Qwen ekstre görseli yanıtı JSON olarak ayrıştırılamadı.");
      }
      throw error;
    }
  }

  async extractFromPdfVision(base64: string): Promise<RawExtraction> {
    this.ensureQwenConfigured();

    const { images, pageCount } = await this.pdfExtractor.renderPageImages(base64);
    const tokenUsage = emptyTokenUsage();
    const items: StatementLineItem[] = [];
    const warnings = ["PDF metni zayıf olduğu için vision OCR fallback kullanıldı."];
    let parsedPageCount = 0;

    for (const image of images) {
      try {
        const extracted = await this.extractImageItems(
          image.base64,
          image.mimeType,
          `Ekstre PDF sayfası ${image.pageNumber}/${pageCount} içindeki harcama satırlarını çıkar.`
        );
        parsedPageCount += 1;
        mergeUsage(tokenUsage, extracted.tokenUsage);
        items.push(...extracted.items);
        warnings.push(...extracted.warnings.map((warning) => `Sayfa ${image.pageNumber}: ${warning}`));
      } catch (error) {
        if (error instanceof SyntaxError) {
          warnings.push(`Sayfa ${image.pageNumber}: Qwen vision yanıtı JSON olarak ayrıştırılamadı.`);
          continue;
        }
        throw error;
      }
    }

    if (parsedPageCount === 0) {
      throw new StatementImportException("STATEMENT_JSON_PARSE_FAILED", "Qwen PDF vision yanıtı JSON olarak ayrıştırılamadı.");
    }

    return buildRawExtraction(items, warnings, tokenUsage);
  }

  private async extractImageItems(
    base64: string,
    mimeType: string,
    userText: string
  ): Promise<{ items: StatementLineItem[]; warnings: string[]; tokenUsage: RawExtraction["tokenUsage"] }> {
    const response = await this.qwen.chat(
      [
        { role: "system", content: STATEMENT_CHUNK_INSTRUCTION },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
          ]
        }
      ],
      { model: getVisionModel(), temperature: 0 }
    );

    const tokenUsage = emptyTokenUsage();
    addUsage(tokenUsage, response.usage);
    const parsed = parseChunkExtraction(response.content);
    const validated = validateItems(Array.isArray(parsed.items) ? parsed.items : []);
    return {
      items: validated.valid,
      warnings: [...normalizeWarnings(parsed.warnings), ...validated.warnings],
      tokenUsage
    };
  }

  async extract(input: {
    fileBase64: string;
    mimeType: string;
    fileName?: string;
  }): Promise<RawExtraction & { sourceType: "pdf-text" | "pdf-vision" | "image" }> {
    if (input.mimeType === "application/pdf") {
      const { text } = await this.pdfExtractor.extractText(input.fileBase64);
      if (isTextExtractionWeak(text)) {
        return {
          ...(await this.extractFromPdfVision(input.fileBase64)),
          sourceType: "pdf-vision"
        };
      }
      return {
        ...(await this.extractFromText(text)),
        sourceType: "pdf-text"
      };
    }

    if (input.mimeType.startsWith("image/")) {
      return {
        ...(await this.extractFromImage(input.fileBase64, input.mimeType)),
        sourceType: "image"
      };
    }

    throw new StatementImportException("STATEMENT_UNSUPPORTED_FILE_TYPE", "Desteklenmeyen ekstre dosya tipi.");
  }

  private ensureQwenConfigured() {
    if (!this.qwen.isConfigured()) {
      throw new StatementImportException(
        "STATEMENT_AI_NOT_CONFIGURED",
        "Ekstre analizi için QWEN_API_KEY tanımlı değil. Demo sonuç üretilmedi.",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}

function parseChunkExtraction(content: string): ChunkExtraction {
  return JSON.parse(extractJsonObject(content)) as ChunkExtraction;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new SyntaxError("No JSON object found.");
  return match[0];
}

function normalizeWarnings(warnings: unknown): string[] {
  if (!Array.isArray(warnings)) return [];
  return warnings.map((warning) => String(warning).trim()).filter(Boolean);
}

function buildRawExtraction(
  items: StatementLineItem[],
  warnings: string[],
  tokenUsage: RawExtraction["tokenUsage"]
): RawExtraction {
  if (items.length === 0) {
    throw new StatementImportException("STATEMENT_NO_VALID_ITEMS", "Ekstre içinde geçerli harcama kalemi bulunamadı.");
  }

  return {
    items,
    warnings,
    statementMonth: detectStatementMonth(items),
    totalAmount: Number(items.reduce((total, item) => total + item.amount, 0).toFixed(2)),
    tokenUsage,
    avgConfidence: Number((items.reduce((total, item) => total + item.confidence, 0) / items.length).toFixed(3))
  };
}

function detectStatementMonth(items: StatementLineItem[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const month = item.occurredAt.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([leftMonth, leftCount], [rightMonth, rightCount]) => rightCount - leftCount || rightMonth.localeCompare(leftMonth))
    .at(0)?.[0] ?? new Date().toISOString().slice(0, 7);
}

function emptyTokenUsage(): RawExtraction["tokenUsage"] {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addUsage(target: RawExtraction["tokenUsage"], usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
  target.promptTokens += usage?.prompt_tokens ?? 0;
  target.completionTokens += usage?.completion_tokens ?? 0;
  target.totalTokens += usage?.total_tokens ?? 0;
}

function mergeUsage(target: RawExtraction["tokenUsage"], usage: RawExtraction["tokenUsage"]) {
  target.promptTokens += usage.promptTokens;
  target.completionTokens += usage.completionTokens;
  target.totalTokens += usage.totalTokens;
}

function getVisionModel(): string {
  return process.env.QWEN_VISION_MODEL ?? "qwen3.6-flash-2026-04-16";
}
