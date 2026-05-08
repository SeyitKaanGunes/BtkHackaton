import { describe, expect, it } from "vitest";
import { AgentService } from "../src/agent/agent.service.js";
import { QwenService } from "../src/ai/qwen.service.js";
import { DataStoreService } from "../src/data/data-store.service.js";
import { DocumentsService } from "../src/documents/documents.service.js";

describe("API feature services", () => {
  it("routes agent questions through LangGraph and returns explainability", async () => {
    const agent = new AgentService(new DataStoreService(), new QwenService());
    const result = await agent.chat("10000 TL harcarsam ne olur?");
    expect(result.routedAgents).toContain("Simulation Agent");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.suggestedActions[0]?.type).toBe("delay_purchase");
  });

  it("returns deterministic receipt OCR fallback without Qwen key", async () => {
    const documents = new DocumentsService(new QwenService());
    const result = await documents.scanReceipt({});
    expect(result.merchant).toBe("Demo Market");
    expect(result.totalAmount).toBeGreaterThan(0);
  });
});
