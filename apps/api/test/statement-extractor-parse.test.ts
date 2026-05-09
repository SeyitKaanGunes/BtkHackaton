import { describe, expect, it, vi } from "vitest";
import type { QwenService } from "../src/ai/qwen.service.js";
import type { PdfExtractorService } from "../src/documents/pdf-extractor.service.js";
import { StatementExtractorService } from "../src/documents/statement-extractor.service.js";
import { StatementImportException } from "../src/documents/statement-import.exception.js";

const validChunk = JSON.stringify({
  items: [
    {
      merchant: "MIGROS",
      amount: 250.75,
      occurredAt: "2026-05-15",
      categoryName: "Market",
      paymentMethod: "credit_card",
      confidence: 0.88
    }
  ],
  warnings: []
});

describe("StatementExtractorService extractFromText parsing", () => {
  it("parses valid JSON responses", async () => {
    const extractor = createExtractor(validChunk);
    const result = await extractor.extractFromText("15/05/2026 MIGROS 250,75 TL");
    expect(result.items[0]?.merchant).toBe("MIGROS");
    expect(result.totalAmount).toBe(250.75);
  });

  it("parses markdown fenced JSON responses", async () => {
    const extractor = createExtractor(`\`\`\`json\n${validChunk}\n\`\`\``);
    const result = await extractor.extractFromText("15/05/2026 MIGROS 250,75 TL");
    expect(result.items).toHaveLength(1);
  });

  it("continues when one chunk has invalid JSON", async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce({ content: "not-json", model: "mock", usage: {} })
      .mockResolvedValueOnce({ content: validChunk, model: "mock", usage: {} });
    const extractor = createExtractorFromChat(chat);
    const text = Array.from({ length: 81 }, (_, index) => `15/05/2026 MERCHANT-${index} 10,00 TL`).join("\n");

    const result = await extractor.extractFromText(text);
    expect(result.items).toHaveLength(1);
    expect(result.warnings).toContain("Chunk parse başarısız: 1");
  });

  it("throws STATEMENT_JSON_PARSE_FAILED when all chunks fail", async () => {
    const extractor = createExtractor("not-json");
    await expect(extractor.extractFromText("15/05/2026 MIGROS 250,75 TL")).rejects.toMatchObject({
      code: "STATEMENT_JSON_PARSE_FAILED"
    } satisfies Partial<StatementImportException>);
  });

  it("throws STATEMENT_NO_VALID_ITEMS when parsed items are empty", async () => {
    const extractor = createExtractor(JSON.stringify({ items: [], warnings: [] }));
    await expect(extractor.extractFromText("15/05/2026 MIGROS 250,75 TL")).rejects.toMatchObject({
      code: "STATEMENT_NO_VALID_ITEMS"
    } satisfies Partial<StatementImportException>);
  });
});

function createExtractor(content: string): StatementExtractorService {
  return createExtractorFromChat(vi.fn().mockResolvedValue({ content, model: "mock", usage: {} }));
}

function createExtractorFromChat(chat: ReturnType<typeof vi.fn>): StatementExtractorService {
  const mockQwen = {
    isConfigured: () => true,
    chat
  } as unknown as QwenService;
  return new StatementExtractorService(mockQwen, {} as PdfExtractorService);
}
